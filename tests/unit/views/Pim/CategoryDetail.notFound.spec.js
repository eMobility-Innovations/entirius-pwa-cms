import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetCategory = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Category: (...a) => mockGetCategory(...a),
  PATCH_Category: vi.fn(),
  DELETE_Category: vi.fn(),
  POST_UploadPicture: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: mockNotify }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "default", channels: [], activeChannelLanguages: ["pl"] }),
}));
vi.mock("@/composables/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({ isDirty: false, pendingNav: null, snapshot() {}, track() {} }),
}));
vi.mock("@/functionals/Unsaved-changes-modal/index.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/functionals/Confirmation-modal/index.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/views/Pim/components/CategoryProducts.vue", () => ({ default: { template: "<div />" } }));

import CategoryDetail from "@/views/Pim/CategoryDetail.vue";

const mountDetail = () =>
  mount(CategoryDetail, {
    global: {
      mocks: { $route: { params: { idx: "missing" }, query: {} } },
      stubs: { Teleport: true, BasicTabs: true, EmptyState: { template: "<div class='empty'><slot /></div>" } },
    },
  });

describe("CategoryDetail — missing category", () => {
  beforeEach(() => {
    mockGetCategory.mockReset();
    mockNotify.mockReset();
  });

  it("shows the not-found state instead of an editable form and a raw error toast", async () => {
    // The API client rejects with the v2 body; the status rides along as non-enumerable httpStatus.
    const body = { error: "NOT_FOUND", detail: "Category with idx 'missing' not found" };
    Object.defineProperty(body, "httpStatus", { value: 404 });
    mockGetCategory.mockRejectedValueOnce(body);
    const wrapper = mountDetail();
    await flushPromises();

    expect(wrapper.vm.notFound).toBe(true);
    expect(wrapper.find(".empty").exists()).toBe(true);
    expect(wrapper.find("basic-tabs-stub").exists()).toBe(false);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("still reports other load errors", async () => {
    mockGetCategory.mockRejectedValueOnce({ response: { status: 500 } });
    const wrapper = mountDetail();
    await flushPromises();

    expect(wrapper.vm.notFound).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });
});

describe("CategoryDetail — header actions while loading", () => {
  it("hides Save, Delete and the Active switch while the category reloads", async () => {
    mockGetCategory.mockResolvedValueOnce({ data: { idx: "shoes", name: "Shoes", is_active: true } });
    const wrapper = mount(CategoryDetail, {
      global: {
        mocks: { $route: { params: { idx: "shoes" }, query: {} } },
        stubs: {
          Teleport: true,
          BasicTabs: true,
          PimChannelSelect: true,
          PageHeader: { template: "<header><slot name='actions' /></header>" },
          ActionBar: { template: "<div class='stub-actions' />" },
        },
      },
    });
    await flushPromises();
    expect(wrapper.find(".stub-actions").exists()).toBe(true);

    mockGetCategory.mockReturnValueOnce(new Promise(() => {}));
    wrapper.vm.fetchCategory();
    await flushPromises();
    expect(wrapper.find(".stub-actions").exists()).toBe(false);
    expect(wrapper.find("basic-switch-stub").exists()).toBe(false);
  });
});
