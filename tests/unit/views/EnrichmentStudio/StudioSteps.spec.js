import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
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
import { t, setLang } from "@/i18n";

const FormField = {
  name: "FormField",
  props: ["label", "hint", "required", "error"],
  template: "<div><slot name='label' /><slot /></div>",
};
const StatusBadge = { name: "StatusBadge", props: ["label", "tone"], template: "<span class='badge'>{{ label }}</span>" };
const BasicTextarea = { name: "BasicTextarea", props: ["modelValue", "disabled"], emits: ["update:modelValue"], template: "<textarea />" };
const BasicButton = { name: "BasicButton", props: ["disabled"], emits: ["click"], template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>" };
// Renders each action as a button, off while disabled or loading — as the real ActionBar's BasicButton.
const ActionBar = {
  name: "ActionBar",
  props: ["actions"],
  template: "<div><button v-for='a in actions' :key='a.key' :data-testid='a.testid' :disabled='a.disabled || a.loading' @click='a.onClick'>{{ a.label }}</button></div>",
};
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

  it("with a minimum of answers no question is required on its own: any one answer is enough", async () => {
    api.PATCH_Proposal.mockImplementation(async (id, body) => ({ data: { ...QUESTIONS, proposed_value: body.proposed_value } }));
    const proposal = { ...QUESTIONS, proposed_value: { ...QUESTIONS.proposed_value, answers: {}, min_answers: 1 } };
    const w = mount(QuestionsForm, { props: { proposal }, global: { stubs, components } });
    const fields = w.findAllComponents({ name: "FormField" });
    expect(fields.map((f) => f.props("required"))).toEqual([false, false]);
    expect(w.findAllComponents(StatusBadge)).toHaveLength(0);
    w.findAllComponents({ name: "BasicTextarea" })[1].vm.$emit("update:modelValue", "Only the second one");
    expect(await w.vm.prepare()).toBe(true);
  });

  describe("the minimum of answers", () => {
    const optional = QUESTIONS.proposed_value.questions.map((question) => ({ ...question, optional: true }));
    const withMinimum = { ...QUESTIONS, proposed_value: { questions: optional, answers: {}, min_answers: 1 } };
    const mountForm = (proposal) => mount(QuestionsForm, { props: { proposal }, global: { stubs, components } });

    it("shows the minimum above the questions", () => {
      const note = mountForm(withMinimum).find("[data-testid='questions-minimum']");
      expect(note.text()).toBe('enrichment.studio.questions.min_answers::{"count":1}');
      expect(note.classes()).toContain("type-caption");
      expect(note.classes()).not.toContain("questions-form__minimum--short");
    });

    it("refuses an approval below it, marks the note and scrolls it into view", async () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      const w = mountForm(withMinimum);
      expect(await w.vm.prepare()).toBe(false);
      await w.vm.$nextTick();
      const note = w.find("[data-testid='questions-minimum']");
      expect(note.classes()).toContain("questions-form__minimum--short");
      expect(note.attributes("role")).toBe("alert");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
      expect(api.PATCH_Proposal).not.toHaveBeenCalled();
      delete Element.prototype.scrollIntoView;
    });

    it("one answer meets it, optional questions included", async () => {
      api.PATCH_Proposal.mockResolvedValue({ data: withMinimum });
      const w = mountForm(withMinimum);
      w.findAllComponents({ name: "BasicTextarea" })[1].vm.$emit("update:modelValue", "No.");
      expect(await w.vm.prepare()).toBe(true);
    });

    it("an artifact without a minimum shows no note", () => {
      expect(mountForm(QUESTIONS).find("[data-testid='questions-minimum']").exists()).toBe(false);
    });
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

describe("KeywordsTable search intent", () => {
  // The real locale files, not the key-echo mock: the label an operator reads is what is under test.
  const mountReal = (proposal = KEYWORDS) =>
    mount(KeywordsTable, { props: { proposal }, global: { stubs, components, mocks: { $t: t } } });
  const intentOf = (w, phrase) => w.find(`[data-testid='keyword-row-${phrase}'] [data-testid='keyword-intent']`);

  beforeEach(() => api.PATCH_Proposal.mockReset());
  afterEach(() => setLang("EN"));

  it("reads in a row as a property, in plain text that is not clickable", async () => {
    const w = mountReal();
    const intent = intentOf(w, "sofa care");
    expect(intent.text()).toBe("Intent: learning");
    expect(intentOf(w, "linen sofa").text()).toBe("Intent: comparing before buying");
    expect(intent.element.tagName).toBe("SPAN");
    expect(intent.element.closest("a, button, [role], [tabindex]")).toBeNull();
    expect(w.find("[data-testid='keyword-row-sofa care']").text()).not.toContain("Learn something");
    await intent.trigger("click");
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
  });

  it("shows no intent in a row that has none, and keeps an unknown intent as it came", () => {
    const rows = [{ phrase: "bare", volume: 10 }, { phrase: "odd", volume: 20, intent: "Sponsored" }];
    const w = mountReal({ ...KEYWORDS, proposed_value: { data: { ...KEYWORDS.proposed_value.data, candidates: rows } } });
    expect(intentOf(w, "bare").exists()).toBe(false);
    expect(intentOf(w, "odd").text()).toBe("Intent: sponsored");
  });

  it("names the intent in the top tile by the same label, without the prefix", () => {
    expect(mountReal().find("tag-stub").attributes("label")).toBe("Learning");
  });

  it("reads the same way in Polish", () => {
    setLang("PL");
    const w = mountReal();
    expect(intentOf(w, "sofa care").text()).toBe("Intencja: szukanie informacji");
    expect(intentOf(w, "linen sofa").text()).toBe("Intencja: porównywanie przed zakupem");
    expect(w.find("tag-stub").attributes("label")).toBe("Szukanie informacji");
  });
});

describe("KeywordsTable SERP notes", () => {
  const NOTES = "Guides rank first\nShops fill the rest\nOne forum thread";
  const ROW_NOTES = "Care guides\nVideo tutorials";
  const withNotes = {
    ...KEYWORDS,
    proposed_value: {
      data: {
        ...KEYWORDS.proposed_value.data,
        serp_notes: NOTES,
        candidates: [{ phrase: "sofa care", volume: 900, intent: "informational", serp_notes: ROW_NOTES }],
      },
    },
  };
  const style = fs.readFileSync(path.resolve(__dirname, "../../../../src/views/EnrichmentStudio/KeywordsTable.vue"), "utf8");

  it("the step-level callout keeps the lines of the notes", () => {
    const notes = mount(KeywordsTable, { props: { proposal: withNotes }, global: { stubs, components } }).find(".keywords-table__notes");
    expect(notes.element.textContent).toBe(NOTES);
  });

  it("a row's notes keep their lines once the row is opened", async () => {
    const w = mount(KeywordsTable, { props: { proposal: withNotes }, global: { stubs, components } });
    expect(w.find(".keywords-table__serp").exists()).toBe(false);
    await w.find("[data-testid='keyword-serp-toggle']").trigger("click");
    expect(w.find(".keywords-table__serp").element.textContent).toBe(ROW_NOTES);
  });

  // happy-dom runs without the component CSS, so the rule is read from the source.
  it("both note classes break at a newline", () => {
    const rule = style.match(/\.keywords-table__notes,\s*\.keywords-table__serp\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/white-space:\s*pre-line/);
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

  describe("the step explainer", () => {
    const BasicTooltip = { name: "BasicTooltip", props: ["text", "variant", "placement"], template: "<span />" };
    const TEXTS = {
      "enrichment.studio.explainer.keywords": "Researches what people search for.",
      "enrichment.studio.explainer_output.artifact": "The AI wrote this; check it and approve.",
    };
    const $t = (key) => TEXTS[key] ?? key;
    const mountWith = async (step) => {
      const w = mount(StepPanel, {
        props: { run: { ...RUN, steps: [step] }, step },
        global: { stubs: { ...stubs, BasicTooltip }, components, mocks: { $t } },
      });
      await flushPromises();
      return w.findComponent(BasicTooltip);
    };

    it("explains the step in a help mark next to its title", async () => {
      const help = await mountWith(RUN.steps[1]);
      expect(help.props()).toMatchObject({ text: "Researches what people search for.", variant: "help", placement: "left" });
      expect(help.attributes("data-testid")).toBe("step-explainer");
    });

    it("falls back to what the step's output is", async () => {
      const help = await mountWith({ ...RUN.steps[1], key: "custom" });
      expect(help.props("text")).toBe("The AI wrote this; check it and approve.");
    });

    it("shows no help mark without an explainer", async () => {
      expect((await mountWith({ ...RUN.steps[0], key: "custom" })).exists()).toBe(false);
    });
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

  it("one tap approves typed answers: the save started by leaving the field keeps Approve on and runs first", async () => {
    let saved;
    api.PATCH_Proposal.mockReturnValue(new Promise((resolve) => (saved = resolve)));
    api.POST_AcceptProposal.mockResolvedValue({ data: {} });
    api.GET_Run.mockResolvedValue({ data: RUN });
    const w = await mountStep(0);
    w.findAllComponents({ name: "BasicTextarea" })[0].vm.$emit("update:modelValue", "2019");
    await w.find("[data-testid='questions-form']").trigger("focusout");
    await w.vm.$nextTick();
    const approve = action(w, "approve");
    expect(approve.disabled).toBe(false);
    const done = approve.onClick();
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    saved({ data: { ...QUESTIONS, proposed_value: { ...QUESTIONS.proposed_value, answers: { since: "2019" } } } });
    await done;
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledTimes(1);
    expect(api.POST_AcceptProposal).toHaveBeenCalledWith(11);
  });

  it("a double tap on Approve while the answers save sends one save and one approval", async () => {
    let saved;
    api.PATCH_Proposal.mockReturnValue(new Promise((resolve) => (saved = resolve)));
    api.POST_AcceptProposal.mockResolvedValue({ data: {} });
    api.GET_Run.mockResolvedValue({ data: RUN });
    const w = await mountStep(0);
    w.findAllComponents({ name: "BasicTextarea" })[0].vm.$emit("update:modelValue", "2019");
    await w.find("[data-testid='questions-form']").trigger("focusout");
    await w.find("[data-testid='step-approve']").trigger("click");
    await w.find("[data-testid='step-approve']").trigger("click");
    saved({ data: QUESTIONS });
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledTimes(1);
    expect(api.POST_AcceptProposal).toHaveBeenCalledTimes(1);
    expect(w.emitted("changed")).toHaveLength(1);
  });

  it("a double tap on Approve sends one approval", async () => {
    let accepted;
    api.POST_AcceptProposal.mockReturnValue(new Promise((resolve) => (accepted = resolve)));
    api.GET_Run.mockResolvedValue({ data: RUN });
    const w = await mountStep(1);
    await w.find("[data-testid='step-approve']").trigger("click");
    await w.find("[data-testid='step-approve']").trigger("click");
    accepted({ data: {} });
    await flushPromises();
    expect(api.POST_AcceptProposal).toHaveBeenCalledTimes(1);
  });

  it("Approve waits while a search-phrase pick saves: the step goes on with the picked set", async () => {
    let picked;
    api.PATCH_Proposal.mockReturnValue(new Promise((resolve) => (picked = resolve)));
    const w = await mountStep(1);
    await w.find("[data-testid='keyword-row-linen sofa'] [data-testid='keyword-secondary']").trigger("click");
    const approve = w.find("[data-testid='step-approve']");
    expect(approve.attributes("disabled")).toBeDefined();
    await approve.trigger("click");
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    picked({ data: KEYWORDS });
    await flushPromises();
    expect(w.find("[data-testid='step-approve']").attributes("disabled")).toBeUndefined();
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
