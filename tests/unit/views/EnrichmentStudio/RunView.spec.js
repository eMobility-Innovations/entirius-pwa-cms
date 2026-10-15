import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Run: vi.fn(), POST_CancelRun: vi.fn(), GET_ProfileStatus: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import RunView from "@/views/EnrichmentStudio/RunView.vue";

const replace = vi.fn();
const StepPanel = { name: "StepPanel", props: ["run", "step"], emits: ["changed"], template: "<div />" };
const stubs = {
  PageHeader: { template: "<div><slot name='meta' /><slot name='actions' /></div>" },
  ActionBar: true, ConfirmDialog: true, CostLabel: true, StepRail: true, ProfileGate: true, StepPanel,
};
const step = (key, status) => ({ key, label: key, status, needs: [], proposal_id: null });
const run = (...steps) => ({ uid: "r1", status: "running", channel: "eu", inputs: { topic: "Sofas" }, current_step: "a", steps });

function mountRun(query = {}) {
  return mount(RunView, {
    global: { stubs, mocks: { $route: { params: { uid: "r1" }, query }, $router: { replace, push: vi.fn() } } },
  });
}

describe("RunView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.GET_Run.mockReset();
    replace.mockReset();
    notify.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("a missing run shows quietly as gone; another failure is told", async () => {
    // The client rejects with the bare v2 body (createClient rejectWithBody).
    api.GET_Run.mockRejectedValue({ error: "NOT_FOUND", httpStatus: 404 });
    mountRun();
    await flushPromises();
    expect(notify).not.toHaveBeenCalled();
    api.GET_Run.mockRejectedValue({ error: "INTERNAL_ERROR", message: "boom", httpStatus: 500 });
    mountRun();
    await flushPromises();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });

  it("refreshes itself while a step works and stops once it waits for review", async () => {
    api.GET_Run.mockResolvedValueOnce({ data: run(step("a", "running")) });
    api.GET_Run.mockResolvedValueOnce({ data: run(step("a", "review")) });
    const w = mountRun();
    await flushPromises();
    expect(w.findComponent(StepPanel).props("step").key).toBe("a");
    await vi.advanceTimersByTimeAsync(4000);
    expect(api.GET_Run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8000);
    expect(api.GET_Run).toHaveBeenCalledTimes(2);
    expect(w.findComponent(StepPanel).props("step").status).toBe("review");
  });

  it("a cancelled run with a running step schedules no refresh", async () => {
    api.GET_Run.mockResolvedValue({ data: { ...run(step("a", "running")), status: "cancelled" } });
    mountRun();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(12000);
    expect(api.GET_Run).toHaveBeenCalledTimes(1);
  });

  it("a running step stops refreshing once the run has gone quiet", async () => {
    const quiet = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    api.GET_Run.mockResolvedValue({ data: { ...run(step("a", "running")), modified_at: quiet } });
    mountRun();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(12000);
    expect(api.GET_Run).toHaveBeenCalledTimes(1);
  });

  it("an approval moves the selection to the next step that needs attention", async () => {
    api.GET_Run.mockResolvedValue({ data: run(step("a", "review"), step("b", "waiting")) });
    const w = mountRun({ step: "a" });
    await flushPromises();
    const next = run(step("a", "approved"), step("b", "running"));
    w.findComponent(StepPanel).vm.$emit("changed", next, { advance: true });
    expect(replace).toHaveBeenCalledWith({ query: { step: "b" } });
    w.unmount();
  });
});
