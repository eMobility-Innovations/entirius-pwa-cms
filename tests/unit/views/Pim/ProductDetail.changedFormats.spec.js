// Plan 61f: ProductDetail checks the EAN only when the operator changed it (real useFormErrors).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetProduct = vi.fn();
const mockPatchProduct = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Product: (...a) => mockGetProduct(...a),
  PATCH_Product: (...a) => mockPatchProduct(...a),
  DELETE_Product: vi.fn(),
  POST_ToggleOverride: vi.fn(),
  GET_FeatureSetsGlobal: vi.fn().mockResolvedValue({ data: { results: [] } }),
}));
vi.mock("@/api/atlas/api", () => ({ GET_BulkHasChanges: vi.fn().mockResolvedValue({ data: {} }) }));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "default", channels: [], activeChannelLanguages: ["pl"] }),
}));
// The AI menu stays dormant here (enrichment module off).
vi.mock("@/views/Pim/components/enrichment/useAiWorkers", () => ({
  useAiWorkers: () => ({ workers: [], enabled: false, usable: false }),
}));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isPanelEnabled: () => false }) }));
vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can: () => true }) }));
vi.mock("@/composables/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({ isDirty: false, pendingNav: null, snapshot() {}, track() {} }),
}));

import ProductDetail from "@/views/Pim/ProductDetail.vue";

async function mountDetail(ean) {
  mockGetProduct.mockResolvedValue({ data: { sku: "CHAIR-001", ean, visibility: "visible", is_enabled: true } });
  const wrapper = mount(ProductDetail, {
    global: {
      mocks: { $route: { params: { sku: "CHAIR-001" }, query: {}, hash: "" } },
      stubs: { Teleport: true, BasicTabs: true, PimChannelSelect: true },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("ProductDetail.saveProduct — changed formats only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchProduct.mockResolvedValue({ data: {} });
  });

  it("saves another field while a stored invalid legacy EAN is untouched", async () => {
    const wrapper = await mountDetail("123");
    wrapper.vm.form.is_enabled = false;
    await wrapper.vm.saveProduct();

    expect(mockPatchProduct).toHaveBeenCalledTimes(1);
    const payload = mockPatchProduct.mock.calls[0][2];
    expect(payload).toEqual({ is_enabled: false });
  });

  it("blocks the save and reports a field error when the EAN is changed to an invalid value", async () => {
    const wrapper = await mountDetail("123");
    wrapper.vm.form.ean = "456";
    await wrapper.vm.saveProduct();
    await flushPromises();

    expect(mockPatchProduct).not.toHaveBeenCalled();
    expect(wrapper.vm.formErrors.errors.ean).toBeTruthy();
    expect(wrapper.vm.formErrors.errors.ean.msg).toBeTruthy();
  });
});
