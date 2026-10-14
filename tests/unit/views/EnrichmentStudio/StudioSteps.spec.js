import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposal: vi.fn(),
  GET_Run: vi.fn(),
  PATCH_Proposal: vi.fn(),
  POST_AcceptProposal: vi.fn(),
  POST_RegenerateStep: vi.fn(),
}));
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import QuestionsForm from "@/views/EnrichmentStudio/QuestionsForm.vue";
import KeywordsTable from "@/views/EnrichmentStudio/KeywordsTable.vue";
import StepPanel from "@/views/EnrichmentStudio/StepPanel.vue";

const FormField = { name: "FormField", props: ["label", "hint", "required", "error"], template: "<div><slot /></div>" };
const BasicTextarea = { name: "BasicTextarea", props: ["modelValue", "disabled"], emits: ["update:modelValue"], template: "<textarea />" };
const BasicButton = { props: ["disabled"], emits: ["click"], template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>" };
const ActionBar = { name: "ActionBar", props: ["actions"], template: "<div />" };
const BasicModal = { name: "BasicModal", props: ["open", "actions"], template: "<div v-if='open'><slot /></div>" };
const stubs = {
  FormField, BasicTextarea, BasicButton, ActionBar, BasicModal,
  BasicCard: { template: "<div><slot /></div>" },
  BasicRadioGroup: true, BasicSelect: true, CostLabel: true, TextArtifact: true, MetaCards: true, DocumentSummary: true,
};

const QUESTIONS = {
  id: 11,
  status: "pending",
  proposed_value: {
    questions: [
      { id: "since", question: "Since when?", why: "Facts", type: "text", choices: [], optional: false },
      { id: "extra", question: "Anything else?", why: "", type: "text", choices: [], optional: true },
    ],
    answers: {},
  },
};
const KEYWORDS = {
  id: 12,
  status: "pending",
  proposed_value: {
    data: {
      primary: "sofa care",
      secondary: [],
      intent: "informational",
      candidates: [
        { phrase: "sofa care", volume: 900, intent: "informational", serp_notes: "Guides" },
        { phrase: "linen sofa", volume: 300, intent: "commercial", serp_notes: "Shops" },
      ],
    },
  },
};

const actionsOf = (w) => w.findComponent({ name: "ActionBar" }).props("actions");
const action = (w, key) => actionsOf(w).find((a) => a.key === key);

describe("QuestionsForm", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
  });

  it("shows each question with its why-hint and required mark", () => {
    const w = mount(QuestionsForm, { props: { proposal: QUESTIONS }, global: { stubs } });
    const fields = w.findAllComponents({ name: "FormField" });
    expect(fields.map((f) => [f.props("label"), f.props("hint"), f.props("required")])).toEqual([
      ["1. Since when?", "Facts", true],
      ["2. Anything else?", "", false],
    ]);
  });

  it("refuses an approval while a required answer is missing", async () => {
    const w = mount(QuestionsForm, { props: { proposal: QUESTIONS }, global: { stubs } });
    expect(await w.vm.prepare()).toBe(false);
    await w.vm.$nextTick();
    expect(w.findAllComponents({ name: "FormField" })[0].props("error")).toBe("enrichment.studio.questions.required");
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
  });

  it("saves unsaved answers before an approval", async () => {
    api.PATCH_Proposal.mockResolvedValue({ data: { ...QUESTIONS, proposed_value: { ...QUESTIONS.proposed_value, answers: { since: "2019" } } } });
    const w = mount(QuestionsForm, { props: { proposal: QUESTIONS }, global: { stubs } });
    w.findAllComponents({ name: "BasicTextarea" })[0].vm.$emit("update:modelValue", "2019");
    expect(await w.vm.prepare()).toBe(true);
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(11, {
      proposed_value: { ...QUESTIONS.proposed_value, answers: { since: "2019" } },
    });
    expect(w.emitted("updated")).toHaveLength(1);
  });
});

describe("KeywordsTable", () => {
  beforeEach(() => api.PATCH_Proposal.mockReset());

  it("a pick writes the artifact value", async () => {
    api.PATCH_Proposal.mockResolvedValue({ data: KEYWORDS });
    const w = mount(KeywordsTable, { props: { proposal: KEYWORDS }, global: { stubs } });
    await w.find("[data-testid='keyword-linen sofa'] [data-testid='keyword-secondary']").trigger("click");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(12, {
      proposed_value: { data: { ...KEYWORDS.proposed_value.data, secondary: ["linen sofa"] } },
    });
    expect(w.emitted("updated")[0][0]).toBe(KEYWORDS);
  });

  it("the main phrase cannot be supporting and a no-op pick saves nothing", async () => {
    const w = mount(KeywordsTable, { props: { proposal: KEYWORDS }, global: { stubs } });
    const row = "[data-testid='keyword-sofa care']";
    expect(w.find(`${row} [data-testid='keyword-secondary']`).attributes("disabled")).toBeDefined();
    await w.find(`${row} [data-testid='keyword-primary']`).trigger("click");
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
  });
});

describe("StepPanel", () => {
  const RUN = {
    uid: "r1",
    channel: "eu",
    steps: [
      { key: "questions", label: "Questions", status: "review", output: "questions", needs: [], proposal_id: 11 },
      { key: "keywords", label: "Search phrases", status: "review", output: "artifact", needs: ["questions"], proposal_id: 12 },
    ],
  };

  async function mountStep(index) {
    const w = mount(StepPanel, { props: { run: RUN, step: RUN.steps[index] }, global: { stubs } });
    await flushPromises();
    return w;
  }

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
    api.GET_Proposal.mockImplementation(async (id) => ({ data: id === 11 ? QUESTIONS : KEYWORDS }));
  });

  it("approve accepts the step output and hands the refreshed run up to move on", async () => {
    const next = { ...RUN, current_step: "outline" };
    api.POST_AcceptProposal.mockResolvedValue({ data: {} });
    api.GET_Run.mockResolvedValue({ data: next });
    const w = await mountStep(1);
    expect(w.findComponent(KeywordsTable).exists()).toBe(true);
    await action(w, "approve").onClick();
    await flushPromises();
    expect(api.POST_AcceptProposal).toHaveBeenCalledWith(12);
    expect(w.emitted("changed")[0]).toEqual([next, { advance: true }]);
  });

  it("approving questions with a required answer missing sends nothing", async () => {
    const w = await mountStep(0);
    await action(w, "approve").onClick();
    await flushPromises();
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    expect(w.emitted("changed")).toBeUndefined();
  });

  it("regenerate sends the optional instruction and stays on the step", async () => {
    const working = { ...RUN, steps: [RUN.steps[0], { ...RUN.steps[1], status: "running" }] };
    api.POST_RegenerateStep.mockResolvedValue({ data: working });
    const w = await mountStep(1);
    action(w, "regenerate").onClick();
    await w.vm.$nextTick();
    await w.findComponent({ name: "BasicTextarea" }).vm.$emit("update:modelValue", "  Focus on linen ");
    const modal = w.findComponent({ name: "BasicModal" });
    await modal.props("actions").find((a) => a.key === "regenerate").onClick();
    await flushPromises();
    expect(api.POST_RegenerateStep).toHaveBeenCalledWith("r1", "keywords", { instruction: "Focus on linen" });
    expect(w.emitted("changed")[0]).toEqual([working, { advance: false }]);
  });

  it("a cancelled run offers no decision on its steps", async () => {
    const run = { ...RUN, status: "cancelled" };
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs } });
    await flushPromises();
    expect(w.findComponent({ name: "ActionBar" }).exists()).toBe(false);
  });

  it("a waiting step says what it waits for and offers no decision", async () => {
    const run = { ...RUN, steps: [RUN.steps[0], { ...RUN.steps[1], status: "waiting", proposal_id: null }] };
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs } });
    await flushPromises();
    expect(w.find("[data-testid='step-waiting']").text()).toContain("Questions");
    expect(w.findComponent({ name: "ActionBar" }).exists()).toBe(false);
    expect(api.GET_Proposal).not.toHaveBeenCalled();
  });
});
