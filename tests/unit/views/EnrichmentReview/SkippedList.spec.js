import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { nextTick } from "vue";

const api = vi.hoisted(() => ({ GET_ReviewSkipped: vi.fn(), POST_ReviewUnskip: vi.fn() }));
vi.mock("@/api/integrator/review", () => api);
import SkippedList from "@/views/EnrichmentReview/SkippedList.vue";
import RealDataTable from "@/boots/DataTable/index.vue";
import RealPagination from "@/boots/Pagination/index.vue";

enableAutoUnmount(afterEach);
const row = { sku: "SKU-1", label: "Orion lamp", note: "Waiting for dimensions", skipped_by: "Ada", skipped_at: "2026-11-09T10:00:00Z" };
const BasicButton = { emits: ["click"], template: "<button @click='$emit(\"click\")'><slot /></button>" };
const DataTable = {
  props: ["rows", "columns", "emptyText"],
  template: `<div><p v-if="!rows.length">{{ emptyText }}</p><div v-for="row in rows" :key="row.sku" class="row">
    <template v-for="col in columns" :key="col.key"><slot :name="'cell-' + col.key" :row="row">{{ row[col.key] }}</slot></template>
  </div></div>`,
};
function build() {
  return mount(SkippedList, { global: { stubs: { BasicButton, DataTable, Loader: true, Pagination: true } } });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.GET_ReviewSkipped.mockResolvedValue({ data: { count: 1, results: [row] } });
  api.POST_ReviewUnskip.mockResolvedValue({});
});

describe("SkippedList", () => {
  it("renders real table cells and follows real pagination update events", async () => {
    api.GET_ReviewSkipped.mockResolvedValueOnce({ data: { count: 26, results: [row] } });
    const w = mount(SkippedList, {
      global: { components: { DataTable: RealDataTable, Pagination: RealPagination }, stubs: { BasicButton } },
    });
    await flushPromises();
    expect(w.get('[role="gridcell"][data-column="sku"]').text()).toBe(row.sku);
    expect(w.get('[role="gridcell"][data-column="label"]').text()).toBe(row.label);
    expect(w.get('[role="gridcell"][data-column="skipped_at"]').text()).toBe(w.vm.formatDate(row.skipped_at));
    await w.get('[data-testid="enrichment-skipped-open-SKU-1"]').trigger("click");
    expect(w.emitted("open")).toEqual([[row.sku]]);
    await w.get('[aria-label="next page"]').trigger("click");
    await flushPromises();
    expect(api.GET_ReviewSkipped).toHaveBeenLastCalledWith({ page: 2, page_size: 25 });
  });

  it("loads a page and renders the SKU, label, note, reviewer and formatted date", async () => {
    const w = build();
    await nextTick();
    expect(w.find("loader-stub").exists()).toBe(true);
    await flushPromises();
    expect(api.GET_ReviewSkipped).toHaveBeenCalledWith({ page: 1, page_size: 25 });
    for (const text of [row.sku, row.label, row.note, row.skipped_by]) expect(w.text()).toContain(text);
    expect(w.text()).toContain(w.vm.formatDate(row.skipped_at));
    expect(w.text()).not.toContain(row.skipped_at);
  });

  it("opens the selected product in Focus", async () => {
    const w = build();
    await flushPromises();
    await w.get('[data-testid="enrichment-skipped-open-SKU-1"]').trigger("click");
    expect(w.emitted("open")).toEqual([["SKU-1"]]);
  });

  it("returns a product to the queue and reloads without that row", async () => {
    const w = build();
    await flushPromises();
    api.GET_ReviewSkipped.mockResolvedValueOnce({ data: { count: 0, results: [] } });
    await w.get('[data-testid="enrichment-unskip-SKU-1"]').trigger("click");
    await flushPromises();
    expect(api.POST_ReviewUnskip).toHaveBeenCalledWith("SKU-1");
    expect(w.emitted("changed")).toHaveLength(1);
    expect(w.find(".row").exists()).toBe(false);
    expect(w.text()).toContain("enrichment.review.skipped.empty");
  });

  it("keeps a failed unskip visible with an error", async () => {
    const w = build();
    await flushPromises();
    api.POST_ReviewUnskip.mockRejectedValueOnce(new Error("unavailable"));
    await w.get('[data-testid="enrichment-unskip-SKU-1"]').trigger("click");
    await flushPromises();
    expect(w.find(".row").exists()).toBe(true);
    expect(w.get('[role="alert"]').text()).toContain("enrichment.review.skipped.error");
  });

  it("shows a recoverable loading error", async () => {
    api.GET_ReviewSkipped.mockRejectedValueOnce(new Error("unavailable"));
    const w = build();
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toContain("enrichment.review.skipped.error");
    await w.get("button").trigger("click");
    await flushPromises();
    expect(w.find(".row").exists()).toBe(true);
  });

  it("loads another page and moves back when its final row is returned", async () => {
    const w = build();
    await flushPromises();
    await w.setData({ page: 2 });
    await flushPromises();
    expect(api.GET_ReviewSkipped).toHaveBeenLastCalledWith({ page: 2, page_size: 25 });
    await w.vm.unskip("SKU-1");
    await flushPromises();
    expect(api.GET_ReviewSkipped).toHaveBeenLastCalledWith({ page: 1, page_size: 25 });
  });
});
