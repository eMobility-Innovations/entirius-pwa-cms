import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";

const mockAccept = vi.fn();
const mockReject = vi.fn();
const notify = vi.fn();
const ai = vi.hoisted(() => ({}));
vi.mock("@/api/enrichment/api", () => ({
  POST_AcceptProposal: (...a) => mockAccept(...a),
  POST_RejectProposal: (...a) => mockReject(...a),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/views/Pim/components/enrichment/useProductAi", () => ({ useProductAi: () => ai }));
vi.mock("@/components/ConfigHealth/AiToolboxHint.vue", () => ({ default: { name: "AiToolboxHint", render: () => null } }));

import ProductAiResults from "@/views/Pim/components/enrichment/ProductAiResults.vue";

const proposal = (id, over = {}) => ({ id, task_id: 5, status: "pending", target_locator: { feature_idx: "meta_description" }, ...over });

const stubs = {
  SideDrawer: { name: "SideDrawer", props: ["visible", "title"], template: "<div v-if='visible'><slot /></div>" },
  ProposalPanel: { name: "ProposalPanel", props: ["proposal", "task", "product"], template: "<div />" },
  AiTaskList: { name: "AiTaskList", props: ["tasks", "workers", "selected"], emits: ["select"], template: "<div />" },
  DriftModal: { name: "DriftModal", props: ["visible", "proposal"], template: "<div />" },
  IconButton: { name: "IconButton", props: ["icon", "label"], template: "<button :aria-label='label' />" },
  BasicButton: { props: ["disabled"], template: "<button :disabled='disabled'><slot /></button>" },
  RouterLink: { props: ["to"], template: "<a><slot /></a>" },
  BatchCorrection: { name: "BatchCorrection", props: ["taskId", "count"], emits: ["queued"], template: "<div />" },
};

function mountResults({ proposals = [], tasks = [], running = false, usable = true } = {}) {
  Object.assign(ai, {
    proposals: ref(proposals),
    tasks: ref(tasks),
    loading: ref(false),
    running: ref(running),
    refresh: vi.fn(),
    track: vi.fn(),
    syncTasks: vi.fn(),
  });
  return mount(ProductAiResults, {
    props: {
      sku: "ENT-1", product: { sku: "ENT-1" }, usable,
      workers: [{ key: "pim.meta_description", label: "Write meta description" }],
    },
    global: { stubs },
  });
}

describe("ProductAiResults", () => {
  beforeEach(() => {
    mockAccept.mockReset();
    mockReject.mockReset();
    notify.mockReset();
  });

  it("one Enricher icon: the pending count as a badge, a pulsing dot while a task runs", () => {
    const w = mountResults({ proposals: [proposal(1), proposal(2)], tasks: [{ id: 5, status: "in_progress" }], running: true });
    const trigger = w.findComponent({ name: "IconButton" });
    expect(trigger.props("icon")).toBe("enrich");
    expect(trigger.props("label")).toContain("enrichment.ai.trigger");
    expect(w.find("[data-testid='ai-results-count']").text()).toBe("2");
    expect(w.find("[data-testid='ai-results-running']").exists()).toBe(true);
  });

  it("a product with nothing waiting shows the bare icon; a failed latest run a warning dot", () => {
    const idle = mountResults();
    expect(idle.find("[data-testid='ai-results']").exists()).toBe(true);
    expect(idle.find("[data-testid='ai-results-count']").exists()).toBe(false);
    const failed = mountResults({ tasks: [{ id: 3, type: "pim.translate", status: "failed", errors: [] }] });
    expect(failed.find("[data-testid='ai-results-failed']").exists()).toBe(true);
  });

  it("Run AI lists the workers; a click closes the drawer and asks the page to run it", async () => {
    const w = mountResults();
    await w.find("[data-testid='ai-results']").trigger("click");
    await w.find("[data-testid='ai-worker-pim.meta_description']").trigger("click");
    expect(w.emitted("run")[0]).toEqual(["pim.meta_description"]);
    expect(w.find("[data-testid='ai-results-drawer']").exists()).toBe(false);
  });

  it("with the toolbox unusable the run buttons are disabled under the hint", async () => {
    const w = mountResults({ usable: false });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.find("[data-testid='ai-worker-pim.meta_description']").attributes("disabled")).toBeDefined();
    expect(w.findComponent({ name: "AiToolboxHint" }).exists()).toBe(true);
  });

  it("the drawer hands the tasks to the task list and each proposal, with its task and the product, to a card", async () => {
    const tasks = [{ id: 5, type: "pim.meta_description", status: "done" }];
    const w = mountResults({ proposals: [proposal(1)], tasks });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.findComponent({ name: "AiTaskList" }).props("tasks")).toEqual(tasks);
    expect(w.findComponent({ name: "ProposalPanel" }).props()).toMatchObject({
      proposal: proposal(1), task: tasks[0], product: { sku: "ENT-1" },
    });
  });

  it("picking a task shows only its proposals, with a way back", async () => {
    const w = mountResults({ proposals: [proposal(1), proposal(2, { task_id: 6 })], tasks: [{ id: 6, type: "pim.meta_description" }] });
    await w.find("[data-testid='ai-results']").trigger("click");
    w.findComponent({ name: "AiTaskList" }).vm.$emit("select", 6);
    await flushPromises();
    expect(w.findAllComponents({ name: "ProposalPanel" }).map((c) => c.props("proposal").id)).toEqual([2]);
    expect(w.find("[data-testid='ai-results-filter']").text()).toContain("Write meta description");
  });

  it("Apply all applies each shown proposal and leaves a drifted one for its re-confirm", async () => {
    mockAccept
      .mockResolvedValueOnce({ data: proposal(1, { status: "applied" }) })
      .mockResolvedValueOnce({ data: proposal(2, { status: "drifted" }) });
    const w = mountResults({ proposals: [proposal(1), proposal(2)] });
    await w.find("[data-testid='ai-results']").trigger("click");
    await w.find("[data-testid='ai-results-apply-all']").trigger("click");
    await flushPromises();

    expect(mockAccept.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(ai.proposals.value.map((p) => [p.id, p.status])).toEqual([[2, "drifted"]]);
    expect(w.emitted("applied")).toHaveLength(1);
    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ type: "warning" }));
  });

  it("accept drops the proposal and emits it as applied", async () => {
    const applied = proposal(1, { status: "applied" });
    mockAccept.mockResolvedValue({ data: applied });
    const w = mountResults({ proposals: [proposal(1), proposal(2)] });
    await w.vm.accept(proposal(1));

    expect(mockAccept).toHaveBeenCalledWith(1);
    expect(ai.proposals.value.map((p) => p.id)).toEqual([2]);
    expect(w.emitted("applied")[0][0]).toEqual(applied);
    expect(ai.syncTasks).toHaveBeenCalled(); // the task rows recount what is left to review
  });

  it("a drifted accept opens the drift modal; confirming writes through", async () => {
    const drifted = proposal(1, { status: "drifted" });
    mockAccept.mockResolvedValueOnce({ data: drifted }).mockResolvedValueOnce({ data: proposal(1, { status: "applied" }) });
    const w = mountResults({ proposals: [proposal(1)] });
    await w.vm.accept(proposal(1));
    await flushPromises();
    expect(w.findComponent({ name: "DriftModal" }).props("proposal")).toEqual(drifted);
    expect(w.emitted("applied")).toBeUndefined();

    await w.vm.confirmDrift(drifted);
    expect(w.vm.drifted).toBeNull();
    expect(w.emitted("applied")).toHaveLength(1);
  });

  it("reject drops the proposal; a failed action is toasted and keeps it", async () => {
    mockReject.mockResolvedValueOnce({}).mockRejectedValueOnce({ detail: "boom" });
    const w = mountResults({ proposals: [proposal(1), proposal(2)] });
    await w.vm.reject({ proposal: proposal(1), reason: "" });
    expect(ai.proposals.value.map((p) => p.id)).toEqual([2]);

    await w.vm.reject({ proposal: proposal(2), reason: "off" });
    expect(mockReject).toHaveBeenLastCalledWith(2, { reason: "off" });
    expect(ai.proposals.value.map((p) => p.id)).toEqual([2]);
    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ type: "negative" }));
  });

  it("exposes track for the page", () => {
    const w = mountResults();
    w.vm.track({ id: 9 });
    expect(ai.track).toHaveBeenCalledWith({ id: 9 });
  });

  it("a picked task offers Correct all for its pending proposals", async () => {
    const w = mountResults({ proposals: [proposal(1, { task_id: 6 }), proposal(2, { task_id: 6 }), proposal(3)], tasks: [{ id: 6 }] });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.findComponent({ name: "BatchCorrection" }).exists()).toBe(false);
    w.findComponent({ name: "AiTaskList" }).vm.$emit("select", 6);
    await w.vm.$nextTick();
    const batch = w.findComponent({ name: "BatchCorrection" });
    expect(batch.props()).toEqual({ taskId: 6, count: 2 });
    batch.vm.$emit("queued", 2);
    expect(ai.refresh).toHaveBeenCalled();
  });
});
