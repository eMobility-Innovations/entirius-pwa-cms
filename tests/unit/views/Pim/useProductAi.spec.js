import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";

const mockProposals = vi.fn();
const mockTasks = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Proposals: (...a) => mockProposals(...a),
  GET_Tasks: (...a) => mockTasks(...a),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import { POLL_MS, useProductAi } from "@/views/Pim/components/enrichment/useProductAi";

const page = (results) => ({ data: { results } });

describe("useProductAi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockProposals.mockReset().mockResolvedValue(page([]));
    mockTasks.mockReset().mockResolvedValue(page([]));
    notify.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("loads the pending proposals and recent tasks of the product", async () => {
    mockProposals.mockResolvedValue(page([{ id: 7 }]));
    const ai = useProductAi(ref("ENT-1"));
    await flushPromises();
    expect(mockProposals).toHaveBeenCalledWith({ subject_ref: "ENT-1", target_module: "pim", status: "pending", page_size: 50 });
    expect(mockTasks).toHaveBeenCalledWith({ subject_ref: "ENT-1", target_module: "pim", page_size: 10 });
    expect(ai.proposals.value).toEqual([{ id: 7 }]);
    expect(ai.running.value).toBe(false);
  });

  it("does not poll while nothing runs", async () => {
    useProductAi(ref("ENT-1"));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(mockTasks).toHaveBeenCalledTimes(1);
  });

  it("a tracked task is polled until it finishes, then the proposals reload and a toast says so", async () => {
    const ai = useProductAi(ref("ENT-1"));
    await flushPromises();
    ai.track({ id: 5, status: "open", counts: {} });
    expect(ai.running.value).toBe(true);

    mockTasks.mockResolvedValueOnce(page([{ id: 5, status: "in_progress", counts: {} }]));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mockProposals).toHaveBeenCalledTimes(1);

    mockTasks.mockResolvedValueOnce(page([{ id: 5, status: "done", counts: { proposed: 2 } }]));
    mockProposals.mockResolvedValueOnce(page([{ id: 8 }, { id: 9 }]));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(ai.proposals.value.map((p) => p.id)).toEqual([8, 9]);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "positive" }));

    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(mockTasks).toHaveBeenCalledTimes(3); // stopped once nothing runs
  });

  it("the finished toast says how many fields were skipped because the operator edited them", async () => {
    const ai = useProductAi(ref("ENT-1"));
    await flushPromises();
    ai.track({ id: 5, status: "in_progress" });
    mockTasks.mockResolvedValueOnce(page([{ id: 5, status: "done", counts: { proposed: 6, kept_edited: 2 } }]));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(notify).toHaveBeenCalledWith({
      type: "positive",
      msg: "AI task finished: 6 proposal(s) ready for review. 2 fields skipped — you edited them.",
    });
  });

  it("a failed task is toasted as an error, the run named in words, never by its number", async () => {
    const ai = useProductAi(ref("ENT-1"), () => "Meta descriptions");
    await flushPromises();
    ai.track({ id: 6, status: "in_progress" });
    mockTasks.mockResolvedValueOnce(page([{ id: 6, status: "failed", counts: { failed: 1 } }]));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "AI task failed: Meta descriptions." });
  });

  it("a failed poll keeps polling", async () => {
    const ai = useProductAi(ref("ENT-1"));
    await flushPromises();
    ai.track({ id: 5, status: "open" });
    mockTasks.mockRejectedValueOnce(new Error("network"));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mockTasks).toHaveBeenCalledTimes(3);
  });

  it("a product left while a poll is on its way polls and toasts no more", async () => {
    let ai;
    const wrapper = mount(defineComponent({ setup: () => (ai = useProductAi(ref("ENT-1"))), render: () => null }));
    await flushPromises();
    ai.track({ id: 5, status: "in_progress" });
    let answer;
    mockTasks.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    await vi.advanceTimersByTimeAsync(POLL_MS); // the poll is on its way
    wrapper.unmount();
    answer(page([{ id: 5, status: "failed", counts: {} }]));
    await flushPromises();
    expect(vi.getTimerCount()).toBe(0);
    expect(notify).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(mockTasks).toHaveBeenCalledTimes(2);
  });
});
