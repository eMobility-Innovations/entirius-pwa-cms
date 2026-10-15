import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockTask = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Task: (id) => mockTask(id),
  GET_Workers: () => Promise.resolve({ data: [{ key: "pim.writer", label: "Product texts" }] }),
  GET_Templates: () => Promise.resolve({ data: [{ key: "meta", label: "Meta descriptions" }] }),
}));

import RunCorrections from "@/views/EnrichmentReview/RunCorrections.vue";

const BatchCorrection = { name: "BatchCorrection", props: ["taskId"], emits: ["queued"], template: "<div />" };
const row = (id, task_id, over = {}) => ({ id, task_id, status: "pending", target_kind: "attribute_value", ...over });

function mountRuns(rows) {
  return mount(RunCorrections, { props: { rows }, global: { stubs: { BatchCorrection } } });
}

describe("RunCorrections", () => {
  beforeEach(() => {
    mockTask.mockReset().mockImplementation((id) =>
      Promise.resolve({ data: { id, type: "pim.writer", params: id === 5 ? { template: "meta" } : {}, created_at: "2026-10-15T10:00:00Z" } }),
    );
  });

  it("offers Correct all once per run behind the pending rows, named by the template or the worker", async () => {
    const w = mountRuns([row(1, 5), row(2, 5), row(3, 4)]);
    await flushPromises();
    expect(w.findAllComponents({ name: "BatchCorrection" }).map((c) => c.props("taskId"))).toEqual([5, 4]);
    expect(w.get("[data-testid='run-corrections-5']").text()).toContain("Meta descriptions");
    expect(w.get("[data-testid='run-corrections-4']").text()).toContain("Product texts");
    expect(mockTask).toHaveBeenCalledTimes(2);
  });

  it("leaves out Studio steps, media and proposals without a run, and shows at most three runs", async () => {
    const w = mountRuns([
      row(1, 9, { subject_ref: "run:abc" }),
      row(2, 8, { target_kind: "picture" }),
      row(3, null),
      row(4, 1), row(5, 2), row(6, 3), row(7, 4),
    ]);
    await flushPromises();
    expect(w.findAllComponents({ name: "BatchCorrection" }).map((c) => c.props("taskId"))).toEqual([1, 2, 3]);
  });

  it("shows nothing without a correctable pending row", async () => {
    const w = mountRuns([row(1, 5, { status: "applied" })]);
    await flushPromises();
    expect(w.find("[data-testid='run-corrections']").exists()).toBe(false);
  });

  it("a queued batch asks the page to refresh", async () => {
    const w = mountRuns([row(1, 5)]);
    await flushPromises();
    w.findComponent({ name: "BatchCorrection" }).vm.$emit("queued", 3);
    expect(w.emitted("queued")).toHaveLength(1);
  });
});
