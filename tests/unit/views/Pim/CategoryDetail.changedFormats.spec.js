// Plan 61f: CategoryDetail checks og_image_url only when the operator changed it (real useFormErrors).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetCategory = vi.fn();
const mockPatchCategory = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Category: (...a) => mockGetCategory(...a),
  PATCH_Category: (...a) => mockPatchCategory(...a),
  DELETE_Category: vi.fn(),
  POST_UploadPicture: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
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

async function mountDetail(ogImageUrl) {
  mockGetCategory.mockResolvedValue({
    data: { idx: "shoes", name: "Shoes", is_active: true, is_in_menu: true, og_image_url: ogImageUrl },
  });
  const wrapper = mount(CategoryDetail, {
    global: {
      mocks: { $route: { params: { idx: "shoes" }, query: {} } },
      stubs: { Teleport: true, BasicTabs: true, PimChannelSelect: true },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("CategoryDetail.saveCategory — changed formats only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchCategory.mockResolvedValue({ data: {} });
  });

  it("saves another field while a stored invalid og_image_url is untouched", async () => {
    const wrapper = await mountDetail("not a url");
    wrapper.vm.form.is_active = false;
    await wrapper.vm.saveCategory();

    expect(mockPatchCategory).toHaveBeenCalledTimes(1);
    const payload = mockPatchCategory.mock.calls[0][2];
    expect(payload).toMatchObject({ is_active: false });
    expect(payload).not.toHaveProperty("og_image_url");
  });

  it("blocks the save and reports a field error when og_image_url is changed to an invalid value", async () => {
    const wrapper = await mountDetail("not a url");
    wrapper.vm.form.og_image_url = "still not a url";
    await wrapper.vm.saveCategory();

    expect(mockPatchCategory).not.toHaveBeenCalled();
    expect(wrapper.vm.formErrors.errors.og_image_url?.msg).toBeTruthy();
  });
});
