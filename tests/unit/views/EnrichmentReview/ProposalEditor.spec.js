import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposal: vi.fn(),
  GET_Task: vi.fn(),
  GET_ProposalRevisions: vi.fn(),
  POST_ReviseProposal: vi.fn(),
  POST_RestoreRevision: vi.fn(),
  PATCH_Proposal: vi.fn(),
  PUT_ProposalRules: vi.fn(),
  POST_PromoteRule: vi.fn(),
  POST_AcceptProposal: vi.fn(),
  POST_RejectProposal: vi.fn(),
}));
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/api/pim/api", () => ({ GET_Features: () => Promise.resolve({ data: { results: [] } }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import ProposalEditor from "@/views/EnrichmentReview/ProposalEditor.vue";

const PROPOSAL = {
  id: 9, status: "pending", task_id: 4, subject_ref: "ENT-1", subject_label: "Orion sofa", source: "worker:pim.writer@v1",
  target_kind: "attribute_value", target_locator: { language: "pl", feature_idx: "description" },
  proposed_value: { text: "<p>A red sofa</p>" }, current_snapshot: { text: "" }, rules: [],
};

const PageLayout = { template: "<div><slot name='header' /><slot /></div>" };
const PageHeader = { name: "PageHeader", props: ["title", "crumbs", "back"], template: "<header><slot name='meta' /><slot name='actions' /></header>" };
const ActionBar = { name: "ActionBar", props: ["actions"], template: "<div />" };
const BasicTextarea = {
  name: "BasicTextarea",
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: "<textarea :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
};
const CorrectionBar = { name: "CorrectionBar", props: ["shape", "selection", "busy"], emits: ["submit"], template: "<div />", methods: { reset() {} } };
const SegmentedControl = { name: "SegmentedControl", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" };
const ConfirmDialog = { name: "ConfirmDialog", props: ["open", "title"], emits: ["confirm", "discard", "cancel"], template: "<div />" };
const leaveDialog = (w) => w.findAllComponents(ConfirmDialog).find((d) => d.props("title") === "unsaved.title");
const stubs = {
  ConfirmDialog,
  PageLayout, PageHeader, ActionBar, BasicTextarea, CorrectionBar, SegmentedControl,
  BasicCard: { template: "<section><slot /></section>" }, FormField: { template: "<div><slot /></div>" }, Tag: true, VariantPicker: true, RuleChips: true,
  CorrectionThread: { name: "CorrectionThread", props: ["revisions", "restorable", "landed"], template: "<div />" }, DriftModal: true, TextDiff: true,
};
const push = vi.fn();
const back = vi.fn();

async function mountEditor(proposal = PROPOSAL) {
  api.GET_Proposal.mockResolvedValue({ data: proposal });
  api.GET_Task.mockResolvedValue({ data: { id: 4, params: { template: "description" } } });
  api.GET_ProposalRevisions.mockResolvedValue({ data: [{ number: 1 }] });
  const w = mount(ProposalEditor, {
    global: { stubs, mocks: { $route: { params: { proposalId: "9" }, query: {} }, $router: { push, back } } },
  });
  await flushPromises();
  return w;
}

const action = (w, key) => w.findComponent({ name: "ActionBar" }).props("actions").find((a) => a.key === key);

describe("ProposalEditor", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
    push.mockReset();
  });

  it("loads the proposal as editable text with its versions", async () => {
    const w = await mountEditor();
    expect(api.GET_Proposal).toHaveBeenCalledWith("9");
    expect(w.find("textarea").element.value).toBe("<p>A red sofa</p>");
    expect(w.findComponent({ name: "CorrectionThread" }).props()).toMatchObject({ revisions: [{ number: 1 }], restorable: true });
    expect(action(w, "save").disabled).toBe(true);
  });

  it("a selection in the text scopes the correction", async () => {
    const w = await mountEditor();
    const textarea = w.find("textarea").element;
    textarea.setSelectionRange(5, 8);
    await w.find("textarea").trigger("mouseup");
    expect(w.findComponent({ name: "CorrectionBar" }).props("selection")).toBe("red");
  });

  it("an unsaved edit becomes a version before the AI corrects", async () => {
    api.PATCH_Proposal.mockResolvedValue({ data: { ...PROPOSAL, proposed_value: { text: "<p>A blue sofa</p>" } } });
    api.POST_ReviseProposal.mockResolvedValue({ data: { number: 3, value: { text: "<p>A sofa</p>" } } });
    const w = await mountEditor();
    await w.find("textarea").setValue("<p>A blue sofa</p>");
    expect(w.find("[data-testid='editor-dirty']").exists()).toBe(true);
    w.findComponent({ name: "CorrectionBar" }).vm.$emit("submit", { instruction: "", quickAction: "shorten", selection: "" });
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(9, { proposed_value: { text: "<p>A blue sofa</p>" } });
    expect(api.POST_ReviseProposal).toHaveBeenCalledWith(9, { quick_action: "shorten" });
    expect(w.find("textarea").element.value).toBe("<p>A sofa</p>");
  });

  it("Apply writes the value and goes back", async () => {
    api.POST_AcceptProposal.mockResolvedValue({ data: { ...PROPOSAL, status: "applied" } });
    const w = await mountEditor();
    await action(w, "apply").onClick();
    await flushPromises();
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
    expect(api.POST_AcceptProposal).toHaveBeenCalledWith(9);
    expect(push).toHaveBeenCalledWith("/enrichment");
  });

  it("a drifted field asks again before writing", async () => {
    api.POST_AcceptProposal.mockResolvedValue({ data: { ...PROPOSAL, status: "drifted" } });
    const w = await mountEditor();
    await action(w, "apply").onClick();
    await flushPromises();
    expect(w.findComponent({ name: "DriftModal" }).props("visible")).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("an applied proposal is read only; a missing one says so", async () => {
    const applied = await mountEditor({ ...PROPOSAL, status: "applied" });
    expect(applied.findComponent({ name: "ActionBar" }).props("actions")).toEqual([]);
    expect(applied.findComponent({ name: "CorrectionBar" }).exists()).toBe(false);
    api.GET_Proposal.mockRejectedValue({ error: "NOT_FOUND", httpStatus: 404 });
    const missing = mount(ProposalEditor, {
      global: { stubs, mocks: { $route: { params: { proposalId: "1" }, query: {} }, $router: { push, back } } },
    });
    await flushPromises();
    expect(missing.find("textarea").exists()).toBe(false);
    const video = await mountEditor({ ...PROPOSAL, target_kind: "video", proposed_value: { duration_s: 5 } });
    expect(video.find("textarea").exists()).toBe(false);
  });

  it("a load failure other than 404 is reported, not shown as a gone proposal", async () => {
    api.GET_Proposal.mockRejectedValue({ error: "PERMISSION_DENIED", message: "No access", httpStatus: 403 });
    const w = mount(ProposalEditor, {
      global: { stubs, mocks: { $route: { params: { proposalId: "9" }, query: {} }, $router: { push, back } } },
    });
    await flushPromises();
    expect(w.find("[data-testid='editor-load-error']").exists()).toBe(true);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
    api.GET_Proposal.mockRejectedValue({ error: "NOT_FOUND", httpStatus: 404 });
    const gone = mount(ProposalEditor, {
      global: { stubs, mocks: { $route: { params: { proposalId: "9" }, query: {} }, $router: { push, back } } },
    });
    await flushPromises();
    expect(gone.find("[data-testid='editor-load-error']").exists()).toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("a missing task only hides the template promotion", async () => {
    api.GET_Proposal.mockResolvedValue({ data: PROPOSAL });
    api.GET_ProposalRevisions.mockResolvedValue({ data: [] });
    api.GET_Task.mockRejectedValue({ error: "NOT_FOUND", httpStatus: 404 });
    const w = mount(ProposalEditor, {
      global: { stubs, mocks: { $route: { params: { proposalId: "9" }, query: {} }, $router: { push, back } } },
    });
    await flushPromises();
    expect(w.find("textarea").exists()).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });

  it("a fragment that occurs twice is no scope; a new version drops the selection", async () => {
    const w = await mountEditor({ ...PROPOSAL, proposed_value: { text: "red sofa, red chair" } });
    const textarea = w.find("textarea").element;
    textarea.setSelectionRange(0, 3);
    await w.find("textarea").trigger("mouseup");
    expect(w.findComponent({ name: "CorrectionBar" }).props("selection")).toBe("");
    textarea.setSelectionRange(4, 8);
    await w.find("textarea").trigger("mouseup");
    expect(w.findComponent({ name: "CorrectionBar" }).props("selection")).toBe("sofa");
    w.vm.setProposal({ ...PROPOSAL, proposed_value: { text: "red couch" } });
    await w.vm.$nextTick();
    expect(w.findComponent({ name: "CorrectionBar" }).props("selection")).toBe("");
  });

  it("leaving with no manual edit asks nothing", async () => {
    const w = await mountEditor();
    const next = vi.fn();
    ProposalEditor.beforeRouteLeave.call(w.vm, {}, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("leaving with a manual edit asks first; Save and leave keeps it as a version, then leaves", async () => {
    const w = await mountEditor();
    await w.find("textarea").setValue("<p>A blue sofa</p>");
    const next = vi.fn();
    ProposalEditor.beforeRouteLeave.call(w.vm, {}, {}, next);
    await w.vm.$nextTick();
    expect(next).not.toHaveBeenCalled();
    expect(leaveDialog(w).props("open")).toBe(true);
    api.PATCH_Proposal.mockResolvedValue({ data: { ...PROPOSAL, proposed_value: { text: "<p>A blue sofa</p>" } } });
    leaveDialog(w).vm.$emit("confirm");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(9, { proposed_value: { text: "<p>A blue sofa</p>" } });
    expect(next).toHaveBeenCalledWith();
  });
});
