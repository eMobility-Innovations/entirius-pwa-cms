import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Soft-compat contract for the internal AI-grounding `desc` field (featureset-cascade etap-04):
// the field renders only when the backend response carries `desc`, and the save payload
// includes it only when present + changed.

const mockGetFeature = vi.fn();
const mockPatchFeature = vi.fn();
const mockGetCategory = vi.fn();
const mockPatchCategory = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Feature: (...a) => mockGetFeature(...a),
  POST_Feature: vi.fn(),
  PATCH_Feature: (...a) => mockPatchFeature(...a),
  DELETE_Feature: vi.fn(),
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
  usePimChannelStore: () => ({
    activeChannelIdx: "default-store",
    activeChannel: { default_language: "en" },
    activeChannelLanguages: ["en"],
    allLanguages: ["en"],
  }),
}));
vi.mock("@/composables/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({
    isDirty: false,
    pendingNav: null,
    snapshot: () => {},
    track: () => {},
    guardNavigation: (to, from, next) => next(),
    confirmLeave: () => {},
    cancelLeave: () => {},
  }),
}));

import FeatureEdit from "@/views/Pim/FeatureEdit.vue";
import CategoryDetail from "@/views/Pim/CategoryDetail.vue";

const featurePayload = (over = {}) => ({
  idx: "material",
  feature_type: 3,
  scope: 3,
  frontend_input_type: 0,
  filter_type: 0,
  display_order: 0,
  name_t9n: { en: "Material" },
  is_required: false,
  is_visible: true,
  is_filterable: false,
  is_searchable: false,
  is_comparable: false,
  is_for_customization: false,
  exclude_from_inheritance: false,
  has_visual_asset: false,
  is_seo: false,
  ...over,
});

const heavyStubs = {
  OptionsManager: true,
  ConfirmationModal: true,
  UnsavedChangesModal: true,
  LockedField: true,
  Switcher: true,
  BasicTabs: true,
  BasicWysiwyg: true,
  BasicCheckbox: true,
  CategoryProducts: true,
  TranslationsDrawer: true,
  SideDrawer: true,
  FormField: { template: "<div class='form-field-stub'><slot /></div>" },
};

const mountFeatureEdit = (idx = "material") =>
  mount(FeatureEdit, {
    global: {
      mocks: {
        $route: { params: { idx }, query: {}, path: `/pim/features/${idx}` },
        $router: { push() {}, replace() {} },
      },
      stubs: heavyStubs,
    },
  });

describe("FeatureEdit desc soft-compat", () => {
  beforeEach(() => {
    mockGetFeature.mockReset();
    mockPatchFeature.mockReset();
  });

  it("shows the desc field when the response carries desc", async () => {
    mockGetFeature.mockResolvedValueOnce({ data: featurePayload({ desc: "AI hint" }) });
    const wrapper = mountFeatureEdit();
    await flushPromises();

    expect(wrapper.vm.hasDesc).toBe(true);
    expect(wrapper.vm.form.desc).toBe("AI hint");
  });

  it("hides the desc field when the backend omits it (old PIM)", async () => {
    mockGetFeature.mockResolvedValueOnce({ data: featurePayload() });
    const wrapper = mountFeatureEdit();
    await flushPromises();

    expect(wrapper.vm.hasDesc).toBe(false);
  });

  it("includes desc in the PATCH payload only when changed", async () => {
    mockGetFeature.mockResolvedValueOnce({ data: featurePayload({ desc: "old" }) });
    const wrapper = mountFeatureEdit();
    await flushPromises();

    expect(wrapper.vm.buildSelectivePayload().payload).toEqual({});

    wrapper.vm.form.desc = "new grounding text";
    const { payload } = wrapper.vm.buildSelectivePayload();
    expect(payload).toEqual({ desc: "new grounding text" });
  });

  it("never includes desc in the payload when the backend lacks it", async () => {
    mockGetFeature.mockResolvedValueOnce({ data: featurePayload() });
    const wrapper = mountFeatureEdit();
    await flushPromises();

    wrapper.vm.form.desc = "typed somehow";
    expect(wrapper.vm.buildSelectivePayload().payload).toEqual({});
  });
});

const categoryPayload = (over = {}) => ({
  idx: "bikes",
  is_active: true,
  is_in_menu: true,
  name_t9n: { en: "Bikes" },
  description_t9n: { en: "<p>Storefront copy</p>" },
  meta_title_t9n: {},
  meta_description_t9n: {},
  canonical_url_t9n: {},
  image_url: "",
  og_image_url: "",
  noindex: false,
  nofollow: false,
  ...over,
});

const mountCategoryDetail = () =>
  mount(CategoryDetail, {
    global: {
      mocks: {
        $route: { params: { idx: "bikes" }, query: {}, path: "/pim/categories/bikes" },
        $router: { push() {}, replace() {} },
      },
      stubs: heavyStubs,
    },
  });

describe("CategoryDetail desc soft-compat", () => {
  beforeEach(() => {
    mockGetCategory.mockReset();
    mockPatchCategory.mockReset();
    mockPatchCategory.mockResolvedValue({ data: {} });
  });

  it("shows the internal desc only when present, distinct from description_t9n", async () => {
    mockGetCategory.mockResolvedValueOnce({ data: categoryPayload({ desc: "category AI hint" }) });
    const wrapper = mountCategoryDetail();
    await flushPromises();

    expect(wrapper.vm.hasDesc).toBe(true);
    expect(wrapper.vm.form.desc).toBe("category AI hint");
    expect(wrapper.vm.form.description_t9n.en).toBe("<p>Storefront copy</p>");
  });

  it("hides the internal desc when the backend omits it", async () => {
    mockGetCategory.mockResolvedValueOnce({ data: categoryPayload() });
    const wrapper = mountCategoryDetail();
    await flushPromises();

    expect(wrapper.vm.hasDesc).toBe(false);
  });

  it("PATCHes desc only when changed", async () => {
    mockGetCategory.mockResolvedValue({ data: categoryPayload({ desc: "old" }) });
    const wrapper = mountCategoryDetail();
    await flushPromises();

    wrapper.vm.form.desc = "new";
    await wrapper.vm.saveCategory();

    expect(mockPatchCategory).toHaveBeenCalledTimes(1);
    // resetForm pads t9n dicts with channel languages, so the payload carries
    // t9n fields too — assert on desc specifically.
    expect(mockPatchCategory.mock.calls[0][2].desc).toBe("new");
  });

  it("does not PATCH desc when the backend lacks it", async () => {
    mockGetCategory.mockResolvedValue({ data: categoryPayload() });
    const wrapper = mountCategoryDetail();
    await flushPromises();

    wrapper.vm.form.desc = "typed somehow";
    wrapper.vm.form.is_active = false;
    await wrapper.vm.saveCategory();

    const payload = mockPatchCategory.mock.calls[0][2];
    expect(payload.is_active).toBe(false);
    expect("desc" in payload).toBe(false);
  });
});
