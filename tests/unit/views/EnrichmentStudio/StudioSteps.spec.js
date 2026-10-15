import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposal: vi.fn(),
  GET_Run: vi.fn(),
  GET_Task: vi.fn(),
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
import EmptyState from "@/boots/EmptyState/index.vue";
import SegmentedControl from "@/boots/SegmentedControl/index.vue";

const FormField = {
  name: "FormField",
  props: ["label", "hint", "required", "error"],
  template: "<div><slot name='label' /><slot /></div>",
};
const StatusBadge = { name: "StatusBadge", props: ["label", "tone"], template: "<span class='badge'>{{ label }}</span>" };
const BasicTextarea = { name: "BasicTextarea", props: ["modelValue", "disabled"], emits: ["update:modelValue"], template: "<textarea />" };
const BasicButton = { name: "BasicButton", props: ["disabled"], emits: ["click"], template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>" };
const ActionBar = { name: "ActionBar", props: ["actions"], template: "<div />" };
const BasicModal = { name: "BasicModal", props: ["open", "actions"], template: "<div v-if='open'><slot /></div>" };
const stubs = {
  FormField, BasicTextarea, BasicButton, ActionBar, BasicModal, StatusBadge,
  BasicCard: { template: "<div><slot /></div>" },
  BasicRadioGroup: true, BasicSelect: true, CostLabel: true, TextArtifact: true, MetaCards: true, DocumentSummary: true,
  ProposalCorrection: true, Tag: true, RouterLink: { props: ["to"], template: "<a><slot /></a>" },
  // Real (setup.js stubs them): the waiting state's text and the search-phrase control are under test.
  EmptyState: false,
};
const components = { EmptyState, SegmentedControl };

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

  it("shows each question with why it is asked and a Required mark only where it applies", () => {
    const w = mount(QuestionsForm, { props: { proposal: QUESTIONS }, global: { stubs, components } });
    const fields = w.findAllComponents({ name: "FormField" });
    expect(fields.map((f) => f.props("required"))).toEqual([true, false]);
    expect(fields[0].text()).toContain("Since when?");
    expect(fields[0].text()).toContain("Facts");
    expect(fields[0].findAllComponents(StatusBadge)).toHaveLength(1);
    expect(fields[1].findAllComponents(StatusBadge)).toHaveLength(0);
  });

  it("saves the answers when a field is left and reports its progress", async () => {
    const saved = { ...QUESTIONS, proposed_value: { ...QUESTIONS.proposed_value, answers: { since: "2019" } } };
    api.PATCH_Proposal.mockResolvedValue({ data: saved });
    const w = mount(QuestionsForm, { props: { proposal: QUESTIONS }, global: { stubs, components } });
    w.findAllComponents({ name: "BasicTextarea" })[0].vm.$emit("update:modelValue", "2019");
    await w.vm.$nextTick();
    expect(w.emitted("state").at(-1)[0]).toMatchObject({ answered: 1, total: 2, dirty: true });
    await w.find("form").trigger("focusout");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledTimes(1);
    expect(w.emitted("state").at(-1)[0]).toMatchObject({ dirty: false, saving: false, saved: true });
    await w.find("form").trigger("focusout");
    expect(api.PATCH_Proposal).toHaveBeenCalledTimes(1);
  });

  it("an approved step reads its answers as text, an empty one as left to the AI", () => {
    const approved = { ...QUESTIONS, status: "accepted", proposed_value: { ...QUESTIONS.proposed_value, answers: { since: "2019" } } };
    const w = mount(QuestionsForm, { props: { proposal: approved }, global: { stubs, components } });
    expect(w.findComponent({ name: "BasicTextarea" }).exists()).toBe(false);
    const answers = w.find("[data-testid='questions-answers']").text();
    expect(answers).toContain("2019");
    expect(answers).toContain("enrichment.studio.questions.not_answered");
  });

  it("refuses an approval while a required answer is missing", async () => {
    const w = mount(QuestionsForm, { props: { proposal: QUESTIONS }, global: { stubs, components } });
    expect(await w.vm.prepare()).toBe(false);
    await w.vm.$nextTick();
    expect(w.findAllComponents({ name: "FormField" })[0].props("error")).toBe("enrichment.studio.questions.required");
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
  });

  it("saves unsaved answers before an approval", async () => {
    api.PATCH_Proposal.mockResolvedValue({ data: { ...QUESTIONS, proposed_value: { ...QUESTIONS.proposed_value, answers: { since: "2019" } } } });
    const w = mount(QuestionsForm, { props: { proposal: QUESTIONS }, global: { stubs, components } });
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
    const w = mount(KeywordsTable, { props: { proposal: KEYWORDS }, global: { stubs, components } });
    await w.find("[data-testid='keyword-row-linen sofa'] [data-testid='keyword-secondary']").trigger("click");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(12, {
      proposed_value: { data: { ...KEYWORDS.proposed_value.data, secondary: ["linen sofa"] } },
    });
    expect(w.emitted("updated")[0][0]).toBe(KEYWORDS);
  });

  it("the main phrase cannot be supporting or skipped, and a no-op pick saves nothing", async () => {
    const w = mount(KeywordsTable, { props: { proposal: KEYWORDS }, global: { stubs, components } });
    const row = "[data-testid='keyword-row-sofa care']";
    expect(w.find(`${row} [data-testid='keyword-secondary']`).attributes("disabled")).toBeDefined();
    expect(w.find(`${row} [data-testid='keyword-skip']`).attributes("disabled")).toBeDefined();
    expect(w.find(`${row} [data-testid='keyword-primary']`).attributes("aria-pressed")).toBe("true");
    await w.find(`${row} [data-testid='keyword-primary']`).trigger("click");
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
  });

  it("a full supporting set takes no more; an approved step shows each role as a badge", async () => {
    const full = { ...KEYWORDS, proposed_value: { data: { ...KEYWORDS.proposed_value.data, secondary: ["a", "b"] } } };
    const w = mount(KeywordsTable, { props: { proposal: full }, global: { stubs, components } });
    expect(w.find("[data-testid='keyword-row-linen sofa'] [data-testid='keyword-secondary']").attributes("disabled")).toBeDefined();
    const approved = mount(KeywordsTable, { props: { proposal: { ...KEYWORDS, status: "accepted" } }, global: { stubs, components } });
    expect(approved.findComponent(SegmentedControl).exists()).toBe(false);
    expect(approved.find("[data-testid='keyword-row-sofa care']").text()).toContain("enrichment.studio.keywords.as_primary");
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
    const w = mount(StepPanel, { props: { run: RUN, step: RUN.steps[index] }, global: { stubs, components } });
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
    await w.find("[data-testid='step-regenerate']").trigger("click");
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
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs, components } });
    await flushPromises();
    expect(w.findComponent({ name: "ActionBar" }).exists()).toBe(false);
  });

  it("a cancelled run says its open steps stopped instead of working", async () => {
    const run = { ...RUN, status: "cancelled", steps: [RUN.steps[0], { ...RUN.steps[1], status: "running" }] };
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs, components } });
    await flushPromises();
    expect(w.find("[data-testid='step-stopped']").exists()).toBe(true);
    expect(w.find("[data-testid='step-running']").exists()).toBe(false);
  });

  it("a running step gone quiet says so and offers Try again", async () => {
    const quiet = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const run = { ...RUN, status: "running", modified_at: quiet, steps: [RUN.steps[0], { ...RUN.steps[1], status: "running" }] };
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs, components } });
    await flushPromises();
    expect(w.find("[data-testid='step-stale']").exists()).toBe(true);
    expect(w.find("[data-testid='step-running']").exists()).toBe(false);
    expect(action(w, "retry").role).toBe("primary");
    expect(action(w, "regenerate").role).toBe("secondary");
  });

  it("a running step still fresh shows the spinner and no Regenerate", async () => {
    const run = { ...RUN, status: "running", modified_at: new Date().toISOString(), steps: [RUN.steps[0], { ...RUN.steps[1], status: "running" }] };
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs, components } });
    await flushPromises();
    expect(w.find("[data-testid='step-running']").exists()).toBe(true);
    expect(w.findComponent({ name: "ActionBar" }).exists()).toBe(false);
  });

  it("a waiting step says what it waits for and offers no decision", async () => {
    const run = { ...RUN, steps: [RUN.steps[0], { ...RUN.steps[1], status: "waiting", proposal_id: null }] };
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs, components } });
    await flushPromises();
    expect(w.find("[data-testid='step-waiting']").text()).toContain("Questions");
    expect(w.findComponent({ name: "ActionBar" }).exists()).toBe(false);
    expect(api.GET_Proposal).not.toHaveBeenCalled();
  });

  it("the primary says where the approval leads; the document step creates the draft", async () => {
    const w = await mountStep(0);
    expect(action(w, "approve").label).toBe('enrichment.studio.approve_to::{"step":"Search phrases"}');
    const last = await mountStep(1);
    expect(action(last, "approve").label).toBe("enrichment.studio.approve");
    const doc = { ...RUN, steps: [{ ...RUN.steps[0], key: "compose", output: "document" }] };
    const compose = mount(StepPanel, { props: { run: doc, step: doc.steps[0] }, global: { stubs, components } });
    await flushPromises();
    expect(action(compose, "approve").label).toBe("enrichment.studio.create_draft");
  });

  it("a failed step says why in plain words and Try again starts it over without an instruction", async () => {
    api.GET_Task.mockResolvedValue({ data: { errors: [{ code: "SEO_BRIEF_TOOLBOX_HTTP_404" }] } });
    api.POST_RegenerateStep.mockResolvedValue({ data: RUN });
    const run = { ...RUN, steps: [RUN.steps[0], { ...RUN.steps[1], status: "failed", task_id: 37, proposal_id: null }] };
    const w = mount(StepPanel, { props: { run, step: run.steps[1] }, global: { stubs, components } });
    await flushPromises();
    expect(api.GET_Task).toHaveBeenCalledWith(37);
    expect(w.find("[data-testid='step-failed']").text()).toContain("enrichment.studio.failure_service");
    await action(w, "retry").onClick();
    await flushPromises();
    expect(api.POST_RegenerateStep).toHaveBeenCalledWith("r1", "keywords", {});
  });
});
