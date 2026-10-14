import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockSpawn = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({ POST_SpawnTask: (...a) => mockSpawn(...a) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({
    activeChannelIdx: "default-europe",
    activeChannel: { idx: "default-europe", default_language: "pl" },
    activeChannelLanguages: ["pl", "en", "de"],
  }),
}));
const health = vi.hoisted(() => ({ aiUsable: true }));
vi.mock("@/stores/configHealth", () => ({ useConfigHealthStore: () => health }));
vi.mock("@/components/ConfigHealth/AiToolboxHint.vue", () => ({ default: { name: "AiToolboxHint", render: () => null } }));

import RunAiTaskDialog from "@/views/Pim/components/enrichment/RunAiTaskDialog.vue";

const WORKERS = [
  {
    key: "pim.translate",
    label: "Translate",
    params_schema: {
      properties: {
        channel: { type: "string" },
        source_language: { type: "string", title: "Source Language" },
        target_languages: { type: "array", items: { type: "string" } },
        prompt: { type: "string", default: "" },
      },
      required: ["channel", "source_language", "target_languages"],
    },
  },
  {
    key: "pim.description",
    label: "Description",
    params_schema: {
      properties: { channel: { type: "string" }, languages: { type: "array", items: { type: "string" } } },
      required: ["channel", "languages"],
    },
  },
];

const stubs = {
  BasicModal: { name: "BasicModal", props: ["open", "actions"], template: "<div><slot /></div>" },
  BasicSelect: true,
  BasicTextarea: true,
  BasicCheckbox: true,
  FormField: { template: "<div><slot /></div>" },
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
};

async function openDialog(props = {}) {
  const w = mount(RunAiTaskDialog, {
    props: { open: false, workers: WORKERS, initialWorker: "pim.translate", skus: ["A", "B"], ...props },
    global: { stubs },
  });
  await w.setProps({ open: true });
  return w;
}

describe("RunAiTaskDialog", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    notify.mockReset();
    health.aiUsable = true;
  });

  it("generates the form from the picked worker with channel defaults", async () => {
    const w = await openDialog();
    expect(w.vm.fields.map((f) => f.name)).toEqual(["source_language", "target_languages", "prompt"]);
    expect(w.vm.values).toEqual({ source_language: "pl", target_languages: ["en", "de"], prompt: "" });
  });

  it("switching the worker rebuilds the form", async () => {
    const w = await openDialog();
    w.vm.workerKey = "pim.description";
    await flushPromises();
    expect(w.vm.values).toEqual({ languages: ["pl", "en", "de"] });
  });

  it("a new source language drops out of the targets", async () => {
    const w = await openDialog();
    w.vm.setSource("source_language", "en");
    expect(w.vm.values.target_languages).toEqual(["de"]);
  });

  it("runs one task over the SKUs and shows the link to it", async () => {
    mockSpawn.mockResolvedValue({ data: { id: 42, status: "open" } });
    const w = await openDialog();
    w.findComponent("[data-testid='ai-task-param-prompt']").vm.$emit("update:modelValue", "Formal tone");
    await w.vm.run();
    await flushPromises();

    expect(mockSpawn).toHaveBeenCalledWith({
      type: "pim.translate",
      params: { source_language: "pl", target_languages: ["en", "de"], prompt: "Formal tone", channel: "default-europe" },
      scope_spec: { mode: "list", module: "pim", channel: "default-europe", refs: ["A", "B"] },
    });
    expect(w.emitted("created")[0][0].id).toBe(42);
    expect(w.findComponent({ name: "RouterLink" }).props("to")).toEqual({
      name: "EnrichmentTasks",
      query: { status: "__all", task: "42" },
    });
  });

  it("in the background mode it closes at once with a toast instead of the task link", async () => {
    mockSpawn.mockResolvedValue({ data: { id: 43, status: "open" } });
    const w = await openDialog({ background: true });
    await w.vm.run();
    await flushPromises();

    expect(w.emitted("created")[0][0].id).toBe(43);
    expect(w.emitted("close")).toHaveLength(1);
    expect(w.vm.createdTask).toBeNull();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "positive" }));
  });

  it("cannot run while the AI toolbox is unusable or a required field is empty", async () => {
    const w = await openDialog();
    w.vm.toggleLanguage("target_languages", "en", false);
    w.vm.toggleLanguage("target_languages", "de", false);
    expect(w.vm.canRun).toBe(false);
    w.vm.toggleLanguage("target_languages", "en", true);
    expect(w.vm.canRun).toBe(true);
    health.aiUsable = false;
    const blocked = await openDialog();
    expect(blocked.vm.canRun).toBe(false);
  });

  it("a 400 keeps the dialog open; another error closes it", async () => {
    mockSpawn.mockRejectedValueOnce(Object.defineProperty({ detail: "bad" }, "httpStatus", { value: 400 }));
    const w = await openDialog();
    await w.vm.run();
    expect(w.emitted("close")).toBeUndefined();
    mockSpawn.mockRejectedValueOnce({ detail: "boom" });
    await w.vm.run();
    expect(w.emitted("close")).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
