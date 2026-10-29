import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// --- API mocks (declared before component import) ---
const mockGetProducts = vi.fn();
const mockGetGaps = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Products: (...a) => mockGetProducts(...a),
  POST_BulkUpdateProducts: vi.fn(),
  GET_Categories: () => Promise.resolve({ data: { results: [] } }),
  GET_Features: () => Promise.resolve({ data: { results: [] } }),
  GET_FeatureAttributes: () => Promise.resolve({ data: { results: [] } }),
  GET_BulkProductGaps: (...a) => mockGetGaps(...a),
}));
vi.mock("@/api/atlas/api", () => ({
  GET_BulkHasChanges: () => Promise.resolve({ data: { skus: {} } }),
}));

// --- Store/composable mocks ---
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "default-europe" }),
}));
// The AI menu stays dormant here (enrichment module off).
vi.mock("@/views/Pim/components/enrichment/useAiWorkers", () => ({
  useAiWorkers: () => ({ workers: [], enabled: false, usable: false }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isPanelEnabled: () => false }),
}));
vi.mock("@/composables/useSearchDebounce", () => ({
  useSearchDebounce: () => ({ search: "", debouncedFetch: () => {} }),
}));

import ProductList from "@/views/Pim/ProductList.vue";
import BasicMenu from "@/boots/BasicMenu/index.vue";

// Renders each row's quality cell, so the cell's menu is exercised without the real table.
const QualityCellTable = {
  props: ["rows"],
  emits: ["row-click"],
  template:
    '<div><div v-for="r in rows" :key="r.sku" @click="$emit(\'row-click\', r)"><slot name="cell-quality" :row="r" /></div></div>',
};

const mountList = () =>
  mount(ProductList, {
    global: {
      mocks: { $route: { query: {}, path: "/pim/products" }, $router: { push() {}, replace() {} } },
      stubs: {
        DataTable: true,
        Pagination: true,
        FloatingActions: true,
        BulkActionBar: true,
        PimTranslateDialog: true,
      },
    },
  });

const row = (extra = {}) => ({ pk: 1, sku: "A", name: "A", ...extra });
const withGaps = () => row({ gap_worst_severity: "critical", gap_count: 2, gap_evaluated_at: "2026-06-07T10:00:00+00:00" });

const gapsResponse = {
  data: {
    results: {
      "1": [
        { definition_key: "pl-desc", label_t9n: { en: "Missing description" }, severity: "critical", language: "pl", inherited: false, source_channel: null },
      ],
    },
  },
};

describe("ProductList — quality column", () => {
  beforeEach(() => {
    mockGetProducts.mockReset();
    mockGetGaps.mockReset();
    localStorage.clear();
  });

  it("shows the Quality column and hydrates findings when rows carry gap_* fields", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [withGaps()], count: 1 } });
    mockGetGaps.mockResolvedValue(gapsResponse);

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.hasQualityData).toBe(true);
    expect(wrapper.vm.columns.some((c) => c.key === "quality")).toBe(true);
    expect(mockGetGaps).toHaveBeenCalledWith("default-europe", [1], {});
    expect(wrapper.vm.qualityMap["1"]).toHaveLength(1);
  });

  it("reveals findings in a BasicMenu panel on the count badge (never reflows the row)", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [withGaps()], count: 1 } });
    mockGetGaps.mockResolvedValue(gapsResponse);

    const push = vi.fn();
    const wrapper = mount(ProductList, {
      attachTo: document.body,
      global: {
        mocks: { $route: { query: {}, path: "/pim/products" }, $router: { push, replace() {} } },
        components: { BasicMenu },
        stubs: {
          DataTable: QualityCellTable,
          BasicButton: { template: "<button type=\"button\"><slot /></button>" },
          Tag: true,
          Pagination: true,
          FloatingActions: true,
          BulkActionBar: true,
          PimTranslateDialog: true,
        },
      },
    });
    await flushPromises();

    const toggle = wrapper.find('[data-test="quality-toggle-row"]');
    expect(wrapper.find('[data-test="quality-popover"]').exists()).toBe(false); // only the count badge shows
    await toggle.trigger("click");
    expect(wrapper.find('[data-test="quality-popover"]').text()).toContain("Missing description");
    await wrapper.find('[data-test="quality-popover"]').trigger("click");
    expect(push).not.toHaveBeenCalled(); // a click in the panel never opens the row
    await toggle.trigger("click");
    expect(wrapper.find('[data-test="quality-popover"]').exists()).toBe(false); // click again dismisses it
    wrapper.unmount();
  });

  it("soft-compat: old backend without gap_* → no column, no findings call", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [row()], count: 1 } });

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.hasQualityData).toBe(false);
    expect(wrapper.vm.columns.some((c) => c.key === "quality")).toBe(false);
    expect(mockGetGaps).not.toHaveBeenCalled();
  });

  it("soft-compat: a findings 404 falls back to empty map without throwing", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [withGaps()], count: 1 } });
    mockGetGaps.mockRejectedValue({ response: { status: 404 } });

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.hasQualityData).toBe(true);
    expect(wrapper.vm.qualityMap).toEqual({});
  });

  it("toggle hides the column (and persists to localStorage)", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [withGaps()], count: 1 } });
    mockGetGaps.mockResolvedValue(gapsResponse);

    const wrapper = mountList();
    await flushPromises();

    wrapper.vm.toggleQualitySensor();
    await flushPromises();

    expect(wrapper.vm.columns.some((c) => c.key === "quality")).toBe(false);
    expect(localStorage.getItem("pim_hide_quality_sensor")).toBe("1");
  });

  it("'only critical' filters the list (gap_severity) and the findings (severity)", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [withGaps()], count: 1 } });
    mockGetGaps.mockResolvedValue(gapsResponse);

    const wrapper = mountList();
    await flushPromises();

    wrapper.vm.toggleOnlyCritical();
    await flushPromises();

    const lastProducts = mockGetProducts.mock.calls.at(-1);
    expect(lastProducts[1].gap_severity).toBe("critical");
    const lastGaps = mockGetGaps.mock.calls.at(-1);
    expect(lastGaps[2]).toEqual({ severity: "critical" });
  });

  it("'only source' passes only_source to findings (not to the product list)", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [withGaps()], count: 1 } });
    mockGetGaps.mockResolvedValue(gapsResponse);

    const wrapper = mountList();
    await flushPromises();

    const productCallsBefore = mockGetProducts.mock.calls.length;
    wrapper.vm.toggleOnlySource();
    await flushPromises();

    expect(mockGetProducts.mock.calls.length).toBe(productCallsBefore); // list not refetched
    const lastGaps = mockGetGaps.mock.calls.at(-1);
    expect(lastGaps[2]).toEqual({ only_source: true });
  });
});
