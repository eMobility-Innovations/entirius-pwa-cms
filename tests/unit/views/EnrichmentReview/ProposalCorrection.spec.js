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
const RuleChips = { name: "RuleChips", props: ["rules", "hasTemplate", "hasWorker", "busy"], emits: ["change", "promote"], template: "<div />" };
const CorrectionThread = {
  name: "CorrectionThread",
  props: ["revisions", "busy", "asking", "candidates", "landed"],
  emits: ["restore", "pick", "dismiss"],
  template: "<div />",
};
const BasicButton = { props: ["disabled"], emits: ["click"], template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>" };
const BasicModal = { name: "BasicModal", props: ["open", "title", "persistent", "actions"], template: "<div v-if='open'><slot /></div>" };
const stubs = { CorrectionBar, RuleChips, CorrectionThread, BasicButton, BasicModal, CountBadge: true, RouterLink: { props: ["to"], template: "<a><slot /></a>" } };

const PROPOSAL = { id: 7, status: "pending", source: "worker:pim.writer@v2", proposed_value: { text: "A red sofa" }, rules: ["No prices"] };

function mountCorrection(props = {}) {
  return mount(ProposalCorrection, { props: { proposal: PROPOSAL, ...props }, global: { stubs } });
}

async function openBar(w) {
  await w.find("[data-testid='correction-toggle']").trigger("click");
  await flushPromises();
  return w.findComponent({ name: "CorrectionBar" });
}

const thread = (w) => w.findComponent({ name: "CorrectionThread" });

describe("ProposalCorrection", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
    api.GET_ProposalRevisions.mockResolvedValue({ data: [{ number: 1 }] });
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
    expect(w.emitted("busy").map(([b]) => b)).toEqual([true, false, true, false]);
  });

  it("the thread shows the request while the AI writes, then the new version with its changes", async () => {
    let answer;
    api.POST_ReviseProposal.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const w = mountCorrection();
    const bar = await openBar(w);
    expect(api.GET_ProposalRevisions).toHaveBeenCalledWith(7);
    const request = { instruction: "Say crimson", quickAction: null, selection: "" };
    bar.vm.$emit("submit", request);
    await flushPromises();
    expect(thread(w).props()).toMatchObject({ asking: request, busy: true });
    answer({ data: { number: 2, value: { text: "A crimson sofa" } } });
    await flushPromises();
    expect(thread(w).props("asking")).toBeNull();
    expect(thread(w).props("landed")).toBe(2);
    expect(thread(w).props("revisions").map((r) => r.number)).toEqual([1, 2]);
  });

  it("REVISION_NOT_APPLICABLE is told in plain words and nothing changes", async () => {
    api.POST_ReviseProposal.mockRejectedValue({ error: "REVISION_NOT_APPLICABLE", message: "x", httpStatus: 400 });
    const w = mountCorrection();
    (await openBar(w)).vm.$emit("submit", { instruction: "Swap", quickAction: null, selection: "" });
    await flushPromises();
    expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "enrichment.correct.error.not_applicable" });
    expect(w.emitted("updated")).toBeUndefined();
  });

  it("a new version brings its own QA warnings: stale ones go, new ones show", async () => {
    const stale = { code: "NUMBER_NOT_IN_FACTS", message: "120 cm" };
    const fresh = { code: "TOO_LONG", message: "over 160" };
    api.POST_ReviseProposal.mockResolvedValue({ data: { number: 2, value: { text: "A sofa" }, warnings: [] } });
    api.POST_RestoreRevision.mockResolvedValue({ data: { number: 3, value: { text: "A red sofa, 120 cm" }, warnings: [fresh] } });
    const w = mountCorrection({ proposal: { ...PROPOSAL, warnings: [stale] } });
    (await openBar(w)).vm.$emit("submit", { instruction: "", quickAction: "shorten", selection: "" });
    await flushPromises();
    expect(w.emitted("updated")[0][0].warnings).toEqual([]);
    thread(w).vm.$emit("restore", 1);
    await flushPromises();
    expect(w.emitted("updated")[1][0]).toMatchObject({ proposed_value: { text: "A red sofa, 120 cm" }, warnings: [fresh] });
  });

  it("3 variants wait for a pick, which is saved as a manual version", async () => {
    api.POST_ReviseProposal.mockResolvedValue({ data: { candidates: [{ text: "A" }, { text: "B" }, { text: "C" }] } });
    api.PATCH_Proposal.mockResolvedValue({ data: { ...PROPOSAL, proposed_value: { text: "B" } } });
    const w = mountCorrection();
    (await openBar(w)).vm.$emit("submit", { instruction: "", quickAction: "variants", selection: "" });
    await flushPromises();
    expect(thread(w).props("candidates")).toHaveLength(3);
    thread(w).vm.$emit("pick", { text: "B" });
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(7, { proposed_value: { text: "B" } });
    expect(thread(w).props("candidates")).toEqual([]);
    expect(thread(w).props("landed")).toBe("latest");
    expect(w.emitted("updated")[0][0].proposed_value).toEqual({ text: "B" });
  });

  it("versions load when opened, follow a new value and restore", async () => {
    api.POST_RestoreRevision.mockResolvedValue({ data: { number: 3, value: { text: "old" } } });
    const w = mountCorrection();
    expect(w.find("[data-testid='versions-toggle']").exists()).toBe(false);
    await openBar(w);
    expect(thread(w).props("revisions")).toEqual([{ number: 1 }]);
    thread(w).vm.$emit("restore", 1);
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

  it("the footer sends: Correct N proposals waits for an instruction or a picked suggestion", async () => {
    api.POST_ReviseTask.mockResolvedValue({ data: { queued: 4 } });
    const w = await mountBatch(4);
    await w.find("[data-testid='batch-correct']").trigger("click");
    const send = () => w.findComponent({ name: "BasicModal" }).props("actions").find((a) => a.key === "send");
    expect(send().label).toBe('enrichment.correct.send_all::{"count":4}');
    w.findComponent({ name: "CorrectionBar" }).vm.$emit("draft", { instruction: "", quickAction: null, ready: false });
    await flushPromises();
    expect(send().disabled).toBe(true);
    w.findComponent({ name: "CorrectionBar" }).vm.$emit("draft", { instruction: "", quickAction: "formal", selection: "", ready: true });
    await flushPromises();
    expect(send().disabled).toBe(false);
    send().onClick();
    await flushPromises();
    expect(api.POST_ReviseTask).toHaveBeenCalledWith(5, { quick_action: "formal" });
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
    api.GET_Proposals.mockRejectedValue({ error: "INTERNAL_ERROR", httpStatus: 500 });
    const w = mount(BatchCorrection, { props: { taskId: 5 }, global: { stubs } });
    await flushPromises();
    expect(w.find("[data-testid='batch-correct']").attributes("disabled")).toBeDefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });
});
