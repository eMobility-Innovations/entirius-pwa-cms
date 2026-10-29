// Access plan 19 (09b): the product Delete shows only with `pim.product_delete:write`; an Editor (pim.products write
// without it) keeps Save but sees no Delete. UX only: the server refuses the delete anyway.
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
const granted = {};
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({ can: (area, level) => level === "write" && granted[area] === "write" }),
}));
vi.mock("@/composables/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({ isDirty: false, pendingNav: null, snapshot() {}, track() {} }),
}));

import ProductDetail from "@/views/Pim/ProductDetail.vue";

const stubs = {
  Teleport: true,
  BasicTabs: true,
  PimChannelSelect: true,
  PageHeader: { template: "<div><slot name='actions' /></div>" },
  ActionBar: { template: "<div><slot /></div>" },
  IconButton: { props: ["label"], template: "<button>{{ label }}</button>" },
  BasicButton: { template: "<button class='stub-basic-button'><slot /></button>" },
};

async function mountWith(permissions) {
  Object.keys(granted).forEach((key) => delete granted[key]);
  Object.assign(granted, permissions);
  mockGetProduct.mockResolvedValue({ data: { sku: "CHAIR-001", visibility: "visible", is_enabled: true } });
  const wrapper = mount(ProductDetail, {
    global: { mocks: { $route: { params: { sku: "CHAIR-001" }, query: {}, hash: "" } }, stubs },
  });
  await flushPromises();
  return wrapper;
}

const deleteButton = (wrapper) => wrapper.find('[data-testid="pim-product-delete"]');
const saveButton = (wrapper) => wrapper.findAll(".stub-basic-button").filter((b) => b.text() === wrapper.vm.$t("common.save"));

describe("ProductDetail — SKU delete permission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Delete with pim.product_delete:write", async () => {
    const wrapper = await mountWith({ "pim.products": "write", "pim.product_delete": "write" });
    expect(deleteButton(wrapper).exists()).toBe(true);
  });

  it("hides Delete from an Editor (pim.products write, no pim.product_delete)", async () => {
    const wrapper = await mountWith({ "pim.products": "write" });
    expect(deleteButton(wrapper).exists()).toBe(false);
    expect(saveButton(wrapper)).toHaveLength(1);
  });
});
