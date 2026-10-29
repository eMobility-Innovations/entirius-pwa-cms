import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetTask = vi.fn();
const mockGetTargets = vi.fn(() => Promise.resolve({ data: { targets: ["ENT-1"] } }));
vi.mock("@/api/enrichment/api", () => ({
  GET_Task: (...a) => mockGetTask(...a),
  GET_TaskTargets: (...a) => mockGetTargets(...a),
  GET_Proposals: () => Promise.resolve({ data: { results: [] } }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));

import TaskQueueDrawer from "@/views/EnrichmentReview/TaskQueueDrawer.vue";
import { noteProductNames, resetProductNames } from "@/views/EnrichmentReview/runLabel";

const BasicButton = { emits: ["click"], template: "<button @click=\"$emit('click')\"><slot /></button>" };
const failedUnit = {
  id: 31,
  subject_refs: ["ENT-1", "ENT-2"],
  attempts: 3,
  error: { code: "LEASE_EXPIRED", message: "lease expired" },
  events: [
    { at: "2026-10-15T10:00:00Z", event: "claimed", instance: "w-1", attempt: 1, detail: "" },
    { at: "2026-10-15T10:05:00Z", event: "lease_expired", instance: "w-1", attempt: 1, detail: "LEASE_EXPIRED" },
  ],
};
const task = (over = {}) => ({
  id: 5,
  status: "in_progress",
  units: { queued: 4, leased: 2, done: 12, failed: 2, cancelled: 0 },
  failed_units: [failedUnit],
  errors: [],
  ...over,
});

const mountDrawer = (props = {}) =>
  mount(TaskQueueDrawer, {
    props: { visible: false, taskId: 5, ...props },
    global: {
      stubs: { SideDrawer: { template: "<div><slot /></div>" }, DataTable: true, BasicButton, Pagination: true },
    },
  });

async function openDrawer(props) {
  const w = mountDrawer(props);
  await w.setProps({ visible: true });
  await flushPromises();
  return w;
}

describe("TaskQueueDrawer — the run's batches", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetProductNames();
    mockGetTask.mockReset();
    mockGetTask.mockResolvedValue({ data: task() });
  });
  afterEach(() => vi.useRealTimers());

  it("reads the batches in plain words once opened", async () => {
    const w = await openDrawer();
    expect(mockGetTask).toHaveBeenCalledWith(5);
    expect(w.get("[data-testid='queue-units']").text()).toBe("12 of 20 batches done · 4 waiting · 2 working · 2 failed");
    expect(w.find("[data-testid='queue-cost-stopped']").exists()).toBe(false);
  });

  it("a failed batch names its products (by name once known, else SKU) and why it failed, never the code", async () => {
    noteProductNames([{ subject_ref: "ENT-1", subject_label: "Orion Sofa" }]);
    const w = await openDrawer();
    const unit = w.get("[data-testid='queue-failed-31']");
    expect(unit.text()).toContain("Orion Sofa, ENT-2");
    expect(unit.text()).toContain("The worker stopped answering before it finished");
    expect(unit.text()).not.toContain("LEASE_EXPIRED");
  });

  it("Details shows the batch's events as time and plain name, and hides them again", async () => {
    const w = await openDrawer();
    expect(w.text()).not.toContain("Picked up by a worker");
    await w.get("[data-testid='queue-failed-details-31']").trigger("click");
    const text = w.get("[data-testid='queue-failed-31']").text();
    expect(text).toContain("Picked up by a worker");
    expect(text).toContain("The worker stopped answering");
    expect(text).not.toContain("lease_expired");
    expect(text).not.toContain("w-1");
    await w.get("[data-testid='queue-failed-details-31']").trigger("click");
    expect(w.text()).not.toContain("Picked up by a worker");
  });

  it("says when more batches failed than the latest few listed", async () => {
    mockGetTask.mockResolvedValue({ data: task({ units: { queued: 0, leased: 0, done: 2, failed: 7, cancelled: 0 } }) });
    const w = await openDrawer();
    expect(w.get("[data-testid='queue-failed-more']").text()).toContain('"shown":1');
    expect(w.get("[data-testid='queue-failed-more']").text()).toContain('"count":7');
  });

  it("a run stopped by its cost limit says so", async () => {
    mockGetTask.mockResolvedValue({
      data: task({ status: "done", failed_units: [], errors: [{ code: "COST_LIMIT", message: "Stopped: this run reached its cost limit" }] }),
    });
    const w = await openDrawer();
    expect(w.find("[data-testid='queue-cost-stopped']").exists()).toBe(true);
  });

  it("refreshes the run while it runs and stops once it is finished", async () => {
    mockGetTask.mockResolvedValueOnce({ data: task() }).mockResolvedValueOnce({ data: task({ status: "done" }) });
    await openDrawer();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockGetTask).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15000);
    expect(mockGetTask).toHaveBeenCalledTimes(2);
  });

  it("closing stops refreshing, and a late answer for the closed run never lands", async () => {
    let answer;
    mockGetTask.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const w = mountDrawer();
    await w.setProps({ visible: true });
    await w.setProps({ visible: false });
    answer({ data: task() });
    await flushPromises();
    expect(w.find("[data-testid='queue-units']").exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(mockGetTask).toHaveBeenCalledTimes(1);
  });

  it("stops refreshing on unmount", async () => {
    const w = await openDrawer();
    w.unmount();
    await vi.advanceTimersByTimeAsync(20000);
    expect(mockGetTask).toHaveBeenCalledTimes(1);
  });

  it("an older run without batches shows no batch line", async () => {
    mockGetTask.mockResolvedValue({ data: { id: 5, status: "failed", errors: [] } });
    const w = await openDrawer();
    expect(w.find("[data-testid='queue-units']").exists()).toBe(false);
    expect(w.find("[data-testid='queue-failed-units']").exists()).toBe(false);
  });
});
