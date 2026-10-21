// An applied AI proposal shows in the product form without clobbering unsaved edits (real useUnsavedChanges).
// Edits go through `w.vm.$.proxy`: test-utils' `w.vm` hands back raw data, whose writes no watcher sees.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetProduct = vi.fn();
const notify = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Product: (...a) => mockGetProduct(...a),
  PATCH_Product: vi.fn(),
  DELETE_Product: vi.fn(),
  POST_ToggleOverride: vi.fn(),
  GET_FeatureSetsGlobal: vi.fn().mockResolvedValue({ data: { results: [] } }),
}));
vi.mock("@/api/atlas/api", () => ({ GET_BulkHasChanges: vi.fn().mockResolvedValue({ data: {} }) }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "default", channels: [], activeChannelLanguages: ["pl", "en"] }),
}));
vi.mock("@/views/Pim/components/enrichment/useAiWorkers", () => ({
  useAiWorkers: () => ({ workers: [], enabled: false, usable: false }),
}));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isPanelEnabled: () => false }) }));
vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can: () => true }) }));

import ProductDetail from "@/views/Pim/ProductDetail.vue";

const PRODUCT = { sku: "ENT-1", ean: "", visibility: "visible", is_enabled: true, meta_description_t9n: { pl: "Stary" } };
const APPLIED = { target_kind: "attribute_value", target_locator: { channel: "default", language: "pl", feature_idx: "meta_description" } };
const fresh = (pl) => ({ data: { ...PRODUCT, meta_description_t9n: { pl } } });

async function mountDetail() {
  mockGetProduct.mockResolvedValue({ data: PRODUCT });
  const wrapper = mount(ProductDetail, {
    global: {
      mocks: { $route: { params: { sku: "ENT-1" }, query: {}, hash: "" } },
      stubs: { Teleport: true, BasicTabs: true, PimChannelSelect: true, MediaGallery: true },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("ProductDetail.onAiApplied", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a clean form reloads the product and shows the applied value", async () => {
    const w = await mountDetail();
    mockGetProduct.mockResolvedValue(fresh("Nowy"));
    await w.vm.onAiApplied(APPLIED);
    await flushPromises();
    expect(w.vm.form.meta_description_t9n.pl).toBe("Nowy");
    expect(w.vm.isDirty).toBe(false);
  });

  it("a dirty form takes only the applied field and keeps the other edits", async () => {
    const w = await mountDetail();
    w.vm.$.proxy.form.ean = "5901234123457";
    await flushPromises();
    mockGetProduct.mockResolvedValue(fresh("Nowy"));
    await w.vm.onAiApplied(APPLIED);
    await flushPromises();

    expect(w.vm.form.meta_description_t9n.pl).toBe("Nowy");
    expect(w.vm.form.ean).toBe("5901234123457");
    expect(w.vm.product.meta_description_t9n.pl).toBe("Nowy"); // a save no longer sees the field as changed
    expect(w.vm.isDirty).toBe(true);
  });

  it("an unsaved edit of the very same value is kept, with a warning", async () => {
    const w = await mountDetail();
    w.vm.$.proxy.form.meta_description_t9n.pl = "Moja wersja";
    await flushPromises();
    mockGetProduct.mockResolvedValue(fresh("Nowy"));
    await w.vm.onAiApplied(APPLIED);
    await flushPromises();

    expect(w.vm.form.meta_description_t9n.pl).toBe("Moja wersja");
    expect(w.vm.isDirty).toBe(true);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "warning" }));
  });

  it("a proposal of another channel leaves the page alone; a media one reloads the gallery", async () => {
    const w = await mountDetail();
    mockGetProduct.mockClear();
    await w.vm.onAiApplied({ ...APPLIED, target_locator: { ...APPLIED.target_locator, channel: "other" } });
    expect(mockGetProduct).not.toHaveBeenCalled();

    await w.vm.onAiApplied({ target_kind: "video", target_locator: { channel: "default" } });
    expect(w.vm.mediaKey).toBe(1);
    expect(mockGetProduct).not.toHaveBeenCalled();
  });
});

describe("ProductDetail AI actions on a gallery picture", () => {
  const actions = (ctx) => ProductDetail.computed.aiPictureActions.call(ctx);
  const ctx = {
    aiWritable: true,
    aiUsable: true,
    aiWorkers: [{ key: "pim.image", kind: "image" }, { key: "pim.writer", kind: "write" }],
    aiTemplates: [
      { key: "meta", label: "Meta", worker_key: "pim.writer" },
      { key: "image-enhance", label: "Enhance", worker_key: "pim.image" },
    ],
  };

  it("lists the image templates only", () => {
    expect(actions(ctx)).toEqual([{ key: "image-enhance", label: "Enhance", testid: "media-ai-image-enhance" }]);
  });

  it("none without write on AI or a usable toolbox", () => {
    expect(actions({ ...ctx, aiWritable: false })).toEqual([]);
    expect(actions({ ...ctx, aiUsable: false })).toEqual([]);
  });
});
