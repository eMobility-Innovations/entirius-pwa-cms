import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Run: vi.fn(), POST_CancelRun: vi.fn(), GET_ProfileStatus: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
const channels = vi.hoisted(() => ({ channels: [{ idx: "eu", name: "Europe" }], fetchChannelsAndLanguages: vi.fn() }));
vi.mock("@/stores/contentDBChannel", () => ({ useContentDBChannelStore: () => channels }));

import RunView from "@/views/EnrichmentStudio/RunView.vue";

const replace = vi.fn();
const StepPanel = { name: "StepPanel", props: ["run", "step"], emits: ["changed"], template: "<div />" };
const PageHeader = { name: "PageHeader", props: ["title", "description"], template: "<div><slot name='meta' /><slot name='actions' /></div>" };
const BasicMenu = { name: "BasicMenu", props: ["items"], emits: ["select"], template: "<div><slot name='trigger' /></div>" };
const Badge = { name: "StatusBadge", props: ["label", "tone"], template: "<span>{{ label }}</span>" };
const stubs = {
  PageHeader, BasicMenu, StatusBadge: Badge,
  ActionBar: { template: "<div><slot /></div>" }, ConfirmDialog: true, CostLabel: true, StepRail: true, ProfileGate: true,
  RunBrief: true, StepCallout: true, Tag: true, IconButton: true, StepPanel,
  RouterLink: { props: ["to"], template: "<a><slot /></a>" },
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

  it("leaving while a refresh is on its way stops polling for good", async () => {
    api.GET_Run.mockResolvedValueOnce({ data: run(step("a", "running")) });
    let answer;
    api.GET_Run.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const w = mountRun();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(4000); // the second read is on its way
    w.unmount();
    answer({ data: run(step("a", "running")) });
    await flushPromises();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20000);
    expect(api.GET_Run).toHaveBeenCalledTimes(2);
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

  it("the header badge names the step waiting for the operator and links to it; the help line says what to do", async () => {
    api.GET_Run.mockResolvedValue({ data: { ...run(step("a", "approved"), step("b", "review")), status: "waiting" } });
    const w = mountRun();
    await flushPromises();
    expect(w.find("[data-testid='run-next']").exists()).toBe(true);
    expect(w.findComponent(Badge).props("label")).toBe('enrichment.studio.your_turn_on::{"step":"b"}');
    expect(w.findComponent(PageHeader).props("description")).toBe('enrichment.studio.next.your_turn::{"step":"b"}');
    expect(w.findComponent({ name: "Tag" }).attributes("label")).toBe("Europe");
    w.unmount();
  });

  it("while the AI writes, the badge only states it; cancel sits in the overflow menu", async () => {
    api.GET_Run.mockResolvedValue({ data: run(step("a", "running")) });
    const w = mountRun();
    await flushPromises();
    expect(w.find("[data-testid='run-next']").exists()).toBe(false);
    expect(w.findComponent(Badge).props("label")).toBe("enrichment.studio.run_status.running");
    const menu = w.findComponent(BasicMenu);
    expect(menu.props("items").map((item) => item.testid)).toEqual(["run-cancel"]);
    menu.vm.$emit("select", menu.props("items")[0]);
    await w.vm.$nextTick();
    expect(w.findComponent({ name: "ConfirmDialog" }).attributes("open")).toBe("true");
    w.unmount();
  });

  it("a finished run offers no cancel and labels its total as the cost", async () => {
    api.GET_Run.mockResolvedValue({ data: { ...run(step("a", "approved")), status: "done", subject_ref: "d1" } });
    const w = mountRun();
    await flushPromises();
    expect(w.findComponent(BasicMenu).exists()).toBe(false);
    expect(w.text()).toContain("enrichment.studio.run_cost_final");
    expect(w.find("[data-testid='run-open-draft']").exists()).toBe(true);
  });
});
