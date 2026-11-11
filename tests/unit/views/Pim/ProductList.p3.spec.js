import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetProducts = vi.fn();
const mockGetFeatures = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Products: (...a) => mockGetProducts(...a),
  POST_BulkUpdateProducts: vi.fn(),
  GET_Categories: () => Promise.resolve({ data: { results: [] } }),
  GET_Features: (...a) => mockGetFeatures(...a),
  GET_FeatureAttributes: () => Promise.resolve({ data: { results: [] } }),
  GET_BulkProductGaps: () => Promise.resolve({ data: { results: {} } }),
}));
vi.mock("@/api/atlas/api", () => ({
  GET_BulkHasChanges: () => Promise.resolve({ data: { skus: {} } }),
}));
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

const SelectStub = {
  name: "BasicSelect",
  props: ["modelValue", "options", "placeholder"],
  emits: ["update:modelValue"],
  template: "<div />",
};

const mountList = () =>
  mount(ProductList, {
    global: {
      components: { BasicSelect: SelectStub },
      mocks: { $route: { query: {}, path: "/pim/products" }, $router: { push() {}, replace() {} } },
      stubs: { DataTable: true, Pagination: true, FloatingActions: true, BulkActionBar: true, PimTranslateDialog: true },
    },
  });

describe("ProductList — filter selects (P3)", () => {
  beforeEach(() => {
    mockGetProducts.mockReset();
    mockGetFeatures.mockReset().mockResolvedValue({ data: { results: [], next: null } });
    mockGetProducts.mockResolvedValue({ data: { results: [], count: 0 } });
  });

  it("picking a visibility refetches page 1 with that visibility", async () => {
    const wrapper = mountList();
    await flushPromises();
    wrapper.vm.currentPage = 3;

    const visibility = wrapper.findAllComponents(SelectStub)[0];
    expect(visibility.props("modelValue")).toBe(null);
    await visibility.vm.$emit("update:modelValue", 2);
    await flushPromises();

    expect(wrapper.vm.visibilityFilter).toBe(2);
    expect(mockGetProducts).toHaveBeenLastCalledWith(
      "default-europe",
      expect.objectContaining({ page: 1, visibility: 2 })
    );
  });

  it("an attribute filter shows its placeholder until picked, All clears it", async () => {
    const wrapper = mountList();
    await flushPromises();
    wrapper.vm.filterableFeatures = [{ idx: "color", name: "Color", attributes: [{ idx: "red", name: "Red" }] }];
    await flushPromises();

    const attr = () => wrapper.findAllComponents(SelectStub)[3];
    expect(attr().props("modelValue")).toBe("");
    await attr().vm.$emit("update:modelValue", "red");
    await flushPromises();
    expect(wrapper.vm.attributeFilters).toEqual({ color: "red" });
    expect(mockGetProducts).toHaveBeenLastCalledWith(
      "default-europe",
      expect.objectContaining({ attr_color: "red" })
    );

    await attr().vm.$emit("update:modelValue", null);
    expect(wrapper.vm.attributeFilters).toEqual({});
  });
});

describe("ProductList — filterable features", () => {
  it("reads every page of the filterable features and keeps the select-type ones", async () => {
    mockGetProducts.mockResolvedValue({ data: { results: [], count: 0 } });
    mockGetFeatures
      .mockResolvedValueOnce({ data: { results: [{ idx: "color", feature_type: 7 }, { idx: "weight", feature_type: 1 }], next: "p2" } })
      .mockResolvedValueOnce({ data: { results: [{ idx: "brand", name: "Brand", feature_type: 8 }], next: null } });
    const wrapper = mountList();
    await flushPromises();
    expect(mockGetFeatures).toHaveBeenCalledWith({ is_filterable: true, page: 2, page_size: 100 }, "default-europe");
    expect(wrapper.vm.filterableFeatures.map((f) => f.idx)).toEqual(["color", "brand"]);
  });
});
