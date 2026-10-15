import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Workflows: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));

import StartWorkDialog from "@/views/EnrichmentStudio/StartWorkDialog.vue";
import { studioTasks } from "@/views/EnrichmentStudio/startLogic";

const STEPS = ["article.questions", "article.outline", "article.compose"];
const WORKFLOWS = [{ key: "article", label: "Article", steps: STEPS.map((template, i) => ({ key: `s${i}`, template })) }];
const TEMPLATES = [
  { key: "description", label: "Opis produktu" },
  { key: "article.outline", label: "Article: outline" },
  { key: "meta", label: "Meta opisy" },
  { key: "tags", label: "Otaguj produkt" },
];
const stubs = {
  BasicModal: { props: ["open", "actions"], template: "<div v-if='open'><slot /></div>" },
  BasicButton: { emits: ["click"], template: "<button @click=\"$emit('click')\"><slot /></button>" },
};

async function openDialog(templates = TEMPLATES) {
  const w = mount(StartWorkDialog, { props: { open: true, templates }, global: { stubs } });
  await flushPromises();
  return w;
}

describe("studioTasks", () => {
  it("keeps the templates no workflow uses as a step, in their order", () => {
    expect(studioTasks(TEMPLATES, WORKFLOWS).map((t) => t.key)).toEqual(["description", "meta", "tags"]);
    expect(studioTasks(TEMPLATES, []).map((t) => t.key)).toHaveLength(4);
  });
});

describe("StartWorkDialog", () => {
  beforeEach(() => {
    api.GET_Workflows.mockReset();
    api.GET_Workflows.mockResolvedValue({ data: WORKFLOWS });
  });

  it("shows Tasks (workflow steps left out) and Guided work", async () => {
    const w = await openDialog();
    const tasks = w.find("[data-testid='start-work-tasks']");
    expect(tasks.findAll("button").map((b) => b.text())).toEqual(["Opis produktu", "Meta opisy", "Otaguj produkt"]);
    expect(w.find("[data-testid='start-work-guided']").findAll("button").map((b) => b.text())).toEqual(["Article"]);
  });

  it("picking closes it and says what was picked", async () => {
    const w = await openDialog();
    await w.find("[data-testid='start-task-meta']").trigger("click");
    await w.find("[data-testid='start-guided-article']").trigger("click");
    expect(w.emitted("task")).toEqual([["meta"]]);
    expect(w.emitted("guided")).toEqual([["article"]]);
    expect(w.emitted("update:open")).toEqual([[false], [false]]);
  });

  it("without templates (AI off or no write access) only Guided shows; with nothing at all, a note", async () => {
    const guidedOnly = await openDialog([]);
    expect(guidedOnly.find("[data-testid='start-work-tasks']").exists()).toBe(false);
    expect(guidedOnly.find("[data-testid='start-work-guided']").exists()).toBe(true);
    api.GET_Workflows.mockResolvedValue({ data: [] });
    const empty = await openDialog([]);
    expect(empty.find("[data-testid='start-work-empty']").exists()).toBe(true);
  });
});
