import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockSpawn = vi.fn();
const mockSaveTemplate = vi.fn();
const mockListTemplates = vi.fn();
const notify = vi.fn();
const catalog = vi.hoisted(() => ({ fields: [], languages: [] }));
vi.mock("@/api/enrichment/api", () => ({
  POST_SpawnTask: (...a) => mockSpawn(...a),
  POST_Template: (...a) => mockSaveTemplate(...a),
  GET_Templates: (...a) => mockListTemplates(...a),
}));
vi.mock("@/views/EnrichmentReview/fieldCatalog", async (importOriginal) => ({
  ...(await importOriginal()),
  loadCatalog: async () => ({ ...catalog }),
}));
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
import AiParamsForm from "@/views/Pim/components/enrichment/AiParamsForm.vue";

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
    key: "pim.writer",
    label: "Writer",
    kind: "write",
    params_schema: {
      properties: {
        channel: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
        languages: { type: "array", items: { type: "string" } },
        prompt: { type: "string", default: "" },
        rules: { type: "array", items: { type: "string" } },
      },
      required: ["channel", "fields", "languages"],
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

const TEMPLATES = [
  {
    key: "meta", label: "Meta descriptions", worker_key: "pim.writer", kind: "write", position: 10, active: true,
    params: { fields: ["meta_title", "meta_description"], languages: ["*"], augment: ["seo_brief"], seo_scope: "subject" },
    rules: ["Brand first."],
  },
];

const CATALOG_FIELDS = [
  { key: "meta_title", label: "Meta title", type: "text" },
  { key: "meta_description", label: "Meta description", type: "text" },
  { key: "description", label: "Description", type: "html" },
  { key: "badge", label: "Badge", type: "multiselect", options: [{ value: "new", label: "New" }] },
];

const stubs = {
  BasicModal: { name: "BasicModal", props: ["open", "actions"], template: "<div><slot /></div>" },
  BasicSelect: true,
  BasicTextarea: true,
  BasicCheckbox: true,
  BasicRadioGroup: true,
  FormField: { template: "<div><slot /></div>" },
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
};

async function openDialog(props = {}) {
  const w = mount(RunAiTaskDialog, {
    props: { open: false, workers: WORKERS, initialWorker: "pim.translate", skus: ["A", "B"], ...props },
    global: { stubs },
  });
  await w.setProps({ open: true });
  await flushPromises();
  return w;
}

const form = (w) => w.findComponent(AiParamsForm);

describe("RunAiTaskDialog", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    mockSaveTemplate.mockReset();
    notify.mockReset();
    health.aiUsable = true;
    Object.assign(catalog, { fields: [], languages: [] });
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
    form(w).findComponent("[data-testid='ai-task-param-source_language']").vm.$emit("update:modelValue", "en");
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
    w.vm.values = { ...w.vm.values, target_languages: [] };
    expect(w.vm.canRun).toBe(false);
    w.vm.values = { ...w.vm.values, target_languages: ["en"] };
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

  it("a template presets its worker, fields, languages and research; the run names it", async () => {
    Object.assign(catalog, { fields: CATALOG_FIELDS, languages: ["pl", "en"] });
    mockSpawn.mockResolvedValue({ data: { id: 7 } });
    const w = await openDialog({ templates: TEMPLATES, initialTemplate: "meta", initialWorker: "" });

    expect(w.find("[data-testid='ai-task-worker']").exists()).toBe(false);
    expect(w.vm.values).toEqual({ fields: ["meta_title", "meta_description"], languages: ["*"], prompt: "" });
    expect(w.vm.research).toEqual({ augment: ["seo_brief"], seo_scope: "subject" });
    // A writer picks among the text fields only.
    expect(w.vm.fieldChoices.map((o) => o.value)).toEqual(["meta_title", "meta_description", "description"]);

    await w.vm.run();
    expect(mockSpawn).toHaveBeenCalledWith({
      type: "pim.writer",
      template: "meta",
      params: {
        fields: ["meta_title", "meta_description"], languages: ["*"], prompt: "",
        augment: ["seo_brief"], seo_scope: "subject", channel: "default-europe",
      },
      scope_spec: { mode: "list", module: "pim", channel: "default-europe", refs: ["A", "B"] },
    });
  });

  it("Custom… asks for the worker; a writer starts on All languages with no field picked", async () => {
    Object.assign(catalog, { fields: CATALOG_FIELDS, languages: ["pl", "en"] });
    const w = await openDialog({ templates: TEMPLATES, initialTemplate: "", initialWorker: "pim.writer" });
    expect(w.find("[data-testid='ai-task-worker']").exists()).toBe(true);
    expect(w.vm.templateOptions.map((o) => o.value)).toEqual(["meta", ""]);
    expect(w.vm.values).toEqual({ fields: [], languages: ["*"], prompt: "" });
    expect(w.vm.canRun).toBe(false);
    form(w).vm.$emit("update:modelValue", { ...w.vm.values, fields: ["description"] });
    expect(w.vm.canRun).toBe(true);
    // Unticked research is sent as such, so a run can switch a template's preset off.
    expect(w.vm.params.augment).toEqual([]);
  });

  it("research shows only for kinds that take it", async () => {
    const translate = await openDialog();
    expect(translate.vm.researchKeys).toEqual([]);
    expect(translate.vm.params.augment).toBeUndefined();
    const writer = await openDialog({ initialWorker: "pim.writer" });
    expect(writer.vm.researchKeys).toEqual(["seo_brief"]);
  });

  it("Save as template keeps the run (no channel) and its template's rules under a key unique among all templates", async () => {
    mockSaveTemplate.mockResolvedValue({ data: { key: "my-meta-2" } });
    // A hidden template (not offered in the dialog) already holds the key the name makes.
    mockListTemplates.mockResolvedValue({ data: [...TEMPLATES, { key: "my-meta", position: 30, active: false }] });
    const w = await openDialog({ templates: TEMPLATES, initialTemplate: "meta", initialWorker: "" });
    w.vm.startSaving();
    w.vm.templateLabel = "My meta";
    await w.vm.saveTemplate();

    expect(mockListTemplates).toHaveBeenCalledWith();
    expect(mockSaveTemplate).toHaveBeenCalledWith({
      key: "my-meta-2",
      label: "My meta",
      worker_key: "pim.writer",
      params: { fields: ["meta_title", "meta_description"], languages: ["*"], prompt: "", augment: ["seo_brief"], seo_scope: "subject" },
      rules: ["Brand first."],
      position: 40,
      active: true,
    });
    expect(w.emitted("template-saved")[0][0]).toEqual({ key: "my-meta-2" });
    expect(w.vm.saving).toBe(false);
  });
});
