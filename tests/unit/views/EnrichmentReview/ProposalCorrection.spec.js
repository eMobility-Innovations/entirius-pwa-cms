import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_ProposalRevisions: vi.fn(),
  POST_ReviseProposal: vi.fn(),
  POST_RestoreRevision: vi.fn(),
  PATCH_Proposal: vi.fn(),
  PUT_ProposalRules: vi.fn(),
  POST_PromoteRule: vi.fn(),
  POST_ReviseTask: vi.fn(),
  GET_Proposals: vi.fn(),
}));
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/i18n", async (importOriginal) => ({ ...(await importOriginal()), t: (key) => key }));

import ProposalCorrection from "@/views/EnrichmentReview/ProposalCorrection.vue";
import BatchCorrection from "@/views/EnrichmentReview/BatchCorrection.vue";

const CorrectionBar = { name: "CorrectionBar", props: { shape: String, selection: String, busy: Boolean, batch: Boolean }, emits: ["submit"], template: "<div />", methods: { reset() {} } };
const VariantPicker = { name: "VariantPicker", props: ["candidates", "busy"], emits: ["pick", "cancel"], template: "<div />" };
const RuleChips = { name: "RuleChips", props: ["rules", "hasTemplate", "hasWorker", "busy"], emits: ["change", "promote"], template: "<div />" };
const VersionTimeline = { name: "VersionTimeline", props: ["revisions", "busy"], emits: ["restore"], template: "<div />" };
const BasicButton = { props: ["disabled"], emits: ["click"], template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>" };
const BasicModal = { name: "BasicModal", props: ["open", "title", "persistent"], template: "<div v-if='open'><slot /></div>" };
const stubs = { CorrectionBar, VariantPicker, RuleChips, VersionTimeline, BasicButton, BasicModal, CountBadge: true, RouterLink: { props: ["to"], template: "<a><slot /></a>" } };

const PROPOSAL = { id: 7, status: "pending", source: "worker:pim.writer@v2", proposed_value: { text: "A red sofa" }, rules: ["No prices"] };

function mountCorrection(props = {}) {
  return mount(ProposalCorrection, { props: { proposal: PROPOSAL, ...props }, global: { stubs } });
}

async function openBar(w) {
  await w.find("[data-testid='correction-toggle']").trigger("click");
  return w.findComponent({ name: "CorrectionBar" });
}

describe("ProposalCorrection", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
  });

  it("an AI correction becomes the proposal's new value", async () => {
    api.POST_ReviseProposal.mockResolvedValue({ data: { number: 2, value: { text: "A sofa" } } });
    const w = mountCorrection({ selection: "red" });
    const bar = await openBar(w);
    expect(bar.props()).toMatchObject({ shape: "text", selection: "red" });
    bar.vm.$emit("submit", { instruction: "", quickAction: "shorten", selection: "red" });
    await flushPromises();
    expect(api.POST_ReviseProposal).toHaveBeenCalledWith(7, { quick_action: "shorten", scope: { type: "selection", text: "red" } });
    expect(w.emitted("updated")[0][0]).toMatchObject({ id: 7, proposed_value: { text: "A sofa" } });
    expect(w.emitted("busy").map(([b]) => b)).toEqual([true, false]);
  });

  it("REVISION_NOT_APPLICABLE is told in plain words and nothing changes", async () => {
    api.POST_ReviseProposal.mockRejectedValue({ response: { data: { error: "REVISION_NOT_APPLICABLE", message: "x" } } });
    const w = mountCorrection();
    (await openBar(w)).vm.$emit("submit", { instruction: "Swap", quickAction: null, selection: "" });
    await flushPromises();
    expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "enrichment.correct.error.not_applicable" });
    expect(w.emitted("updated")).toBeUndefined();
  });

  it("3 variants wait for a pick, which is saved as a manual version", async () => {
    api.POST_ReviseProposal.mockResolvedValue({ data: { candidates: [{ text: "A" }, { text: "B" }, { text: "C" }] } });
    api.PATCH_Proposal.mockResolvedValue({ data: { ...PROPOSAL, proposed_value: { text: "B" } } });
    const w = mountCorrection();
    (await openBar(w)).vm.$emit("submit", { instruction: "", quickAction: "variants", selection: "" });
    await flushPromises();
    const picker = w.findComponent({ name: "VariantPicker" });
    expect(picker.props("candidates")).toHaveLength(3);
    picker.vm.$emit("pick", { text: "B" });
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(7, { proposed_value: { text: "B" } });
    expect(w.findComponent({ name: "VariantPicker" }).exists()).toBe(false);
    expect(w.emitted("updated")[0][0].proposed_value).toEqual({ text: "B" });
  });

  it("versions load when opened, follow a new value and restore", async () => {
    api.GET_ProposalRevisions.mockResolvedValue({ data: [{ number: 1 }] });
    api.POST_RestoreRevision.mockResolvedValue({ data: { number: 3, value: { text: "old" } } });
    const w = mountCorrection();
    await w.find("[data-testid='versions-toggle']").trigger("click");
    await flushPromises();
    expect(w.findComponent({ name: "VersionTimeline" }).props("revisions")).toEqual([{ number: 1 }]);
    w.findComponent({ name: "VersionTimeline" }).vm.$emit("restore", 1);
    await flushPromises();
    expect(api.POST_RestoreRevision).toHaveBeenCalledWith(7, 1);
    await w.setProps({ proposal: w.emitted("updated")[0][0] });
    await flushPromises();
    expect(api.GET_ProposalRevisions).toHaveBeenCalledTimes(2);
  });

  it("rules: saved as a list, promoted to the worker", async () => {
    api.PUT_ProposalRules.mockResolvedValue({ data: { ...PROPOSAL, rules: [] } });
    api.POST_PromoteRule.mockResolvedValue({ data: { target: "worker", rules: ["No prices"] } });
    const w = mountCorrection({ task: { params: { template: "meta" } } });
    await openBar(w);
    const chips = w.findComponent({ name: "RuleChips" });
    expect(chips.props()).toMatchObject({ rules: ["No prices"], hasTemplate: true, hasWorker: true });
    chips.vm.$emit("change", []);
    chips.vm.$emit("promote", { rule: "No prices", target: "worker" });
    await flushPromises();
    expect(api.PUT_ProposalRules).toHaveBeenCalledWith(7, []);
    expect(api.POST_PromoteRule).toHaveBeenCalledWith(7, { rule: "No prices", target: "worker" });
    expect(notify).toHaveBeenCalledWith({ type: "positive", msg: "enrichment.rules.kept_worker" });
  });

  it("a select value gets the bar without the editor link", async () => {
    const w = mountCorrection({ proposal: { ...PROPOSAL, proposed_value: { option: "red" } } });
    expect(w.find("[data-testid='open-editor']").exists()).toBe(false);
    expect((await openBar(w)).props("shape")).toBe("select");
  });
});

describe("BatchCorrection", () => {
  beforeEach(() => {
    notify.mockReset();
    api.GET_Proposals.mockReset();
  });

  async function mountBatch(count) {
    api.GET_Proposals.mockResolvedValue({ data: { count, results: [] } });
    const w = mount(BatchCorrection, { props: { taskId: 5 }, global: { stubs } });
    await flushPromises();
    return w;
  }

  it("Correct all N queues one instruction for the task's pending proposals", async () => {
    api.POST_ReviseTask.mockResolvedValue({ data: { queued: 4 } });
    const w = await mountBatch(4);
    expect(w.find("[data-testid='batch-correct']").text()).toBe('enrichment.correct.all::{"count":4}');
    await w.find("[data-testid='batch-correct']").trigger("click");
    const bar = w.findComponent({ name: "CorrectionBar" });
    expect(bar.props("batch")).toBe(true);
    bar.vm.$emit("submit", { instruction: "Use 'you'", quickAction: null, selection: "" });
    await flushPromises();
    expect(api.POST_ReviseTask).toHaveBeenCalledWith(5, { instruction: "Use 'you'" });
    expect(w.emitted("queued")[0]).toEqual([4]);
    expect(w.findComponent({ name: "CorrectionBar" }).exists()).toBe(false);
  });

  it("N is the task-wide pending count, re-read when the dialog opens", async () => {
    const w = await mountBatch(240);
    expect(api.GET_Proposals).toHaveBeenCalledWith({ task: 5, status: "pending", page_size: 1 });
    expect(w.find("[data-testid='batch-correct']").text()).toBe('enrichment.correct.all::{"count":240}');
    api.GET_Proposals.mockResolvedValue({ data: { count: 241 } });
    await w.find("[data-testid='batch-correct']").trigger("click");
    await flushPromises();
    expect(w.find("[data-testid='batch-correct']").text()).toBe('enrichment.correct.all::{"count":241}');
  });

  it("a failed count disables the button and says so", async () => {
    api.GET_Proposals.mockRejectedValue({ response: { status: 500 } });
    const w = mount(BatchCorrection, { props: { taskId: 5 }, global: { stubs } });
    await flushPromises();
    expect(w.find("[data-testid='batch-correct']").attributes("disabled")).toBeDefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });
});
