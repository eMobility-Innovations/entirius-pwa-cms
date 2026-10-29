// Plan 42: the navigation editor's item, link and banner dialogs hold their choices in BasicRadioGroups and the
// banner gallery pages through Pagination; the handlers and the saved payloads stay as they were.
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockImages = vi.fn();
vi.mock("@/api/contentDB/api", () => ({ GET_Images: (...args) => mockImages(...args) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isPanelEnabled: () => true }) }));

import EditMenuItemModal from "@/functionals/EditMenuItemModal.vue";
import EditLinkModal from "@/functionals/EditLinkModal.vue";
import EditBannerModal from "@/functionals/EditBannerModal.vue";

const BasicModal = { name: "BasicModal", props: ["actions"], template: "<div><slot /></div>" };
const BasicRadioGroup = {
  name: "BasicRadioGroup",
  props: ["modelValue", "options"],
  emits: ["update:modelValue"],
  template: "<div />",
};
const Pagination = { name: "Pagination", props: ["page", "pages"], emits: ["update:page"], template: "<div />" };
const TranslationsDrawer = { name: "TranslationsDrawer", props: ["title", "visible"], template: "<div />" };
const stubs = {
  BasicModal,
  BasicRadioGroup,
  Pagination,
  TranslationsDrawer,
  FormField: { template: "<div><slot /></div>" },
  EntitySearchPicker: true,
  IconButton: true,
};

const EmptyStateStub = { props: ["title"], template: "<div :data-title='title'><slot /></div>" };
const ButtonStub = { emits: ["click"], template: "<button v-bind='$attrs' @click=\"$emit('click')\"><slot /></button>" };

async function open(component, props = {}, extraStubs = {}) {
  const wrapper = mount(component, { props: { visible: false, ...props }, global: { stubs: { ...stubs, ...extraStubs } } });
  await wrapper.setProps({ visible: true });
  return wrapper;
}

const radios = (wrapper) => wrapper.findAllComponents({ name: "BasicRadioGroup" });
const save = (wrapper) =>
  wrapper
    .findComponent({ name: "BasicModal" })
    .props("actions")
    .find((action) => action.key === "save")
    .onClick();

describe("EditMenuItemModal", () => {
  it("offers display-as and link-type radios; a mega menu drops the link fields", async () => {
    const wrapper = await open(EditMenuItemModal);
    expect(radios(wrapper).map((group) => group.props("options").map((option) => option.value))).toEqual([
      ["link", "megamenu"],
      ["category", "page", "url"],
    ]);
    radios(wrapper)[0].vm.$emit("update:modelValue", "megamenu");
    await flushPromises();
    expect(radios(wrapper)).toHaveLength(1);
  });

  it("saves only with a label, with the chosen link type", async () => {
    const wrapper = await open(EditMenuItemModal);
    save(wrapper);
    expect(wrapper.emitted("save")).toBeUndefined();
    wrapper.vm.form.label = "Shoes";
    radios(wrapper)[1].vm.$emit("update:modelValue", "url");
    await flushPromises();
    save(wrapper);
    expect(wrapper.emitted("save")[0][0]).toMatchObject({ label: "Shoes", display_as: "link", link_type: "url" });
  });
});

describe("EditLinkModal", () => {
  it("keeps the stored link type of an edited link", async () => {
    const wrapper = await open(EditLinkModal, { link: { label: "Sale", link_type: "page", link_value: "sale" } });
    expect(radios(wrapper)[0].props("modelValue")).toBe("page");
    save(wrapper);
    expect(wrapper.emitted("save")[0][0]).toMatchObject({ label: "Sale", link_type: "page", link_value: "sale" });
  });
});

describe("EditBannerModal", () => {
  it("pages the gallery by nine and picks an image from it", async () => {
    mockImages.mockResolvedValue({
      data: { data: [{ uid: "a", image: "/media/a.jpg", meta: { alt: "A" } }], pagination: { total: 19 } },
    });
    const wrapper = await open(EditBannerModal);
    await wrapper.vm.openGallery();
    await flushPromises();
    expect(mockImages).toHaveBeenCalledWith({ limit: 9, page: 1 });
    expect(wrapper.findComponent({ name: "Pagination" }).props("pages")).toBe(3);
    await wrapper.find(".banner-gallery__item").trigger("keydown", { key: "Enter" });
    expect(wrapper.vm.form).toMatchObject({ media_url: "/media/a.jpg", alt_text: "A" });
  });

  it("keeps the pager when a page fails to load", async () => {
    mockImages.mockResolvedValueOnce({ data: { data: [{ uid: "a", image: "/a.jpg" }], pagination: { total: 19 } } });
    const wrapper = await open(EditBannerModal);
    await wrapper.vm.openGallery();
    mockImages.mockRejectedValueOnce(new Error("down"));
    await wrapper.vm.loadGallery(2);
    await flushPromises();
    expect(wrapper.find(".banner-gallery__grid").exists()).toBe(false);
    expect(wrapper.findComponent({ name: "Pagination" }).props()).toMatchObject({ page: 2, pages: 3 });
  });

  // Plan 54b: an outage is an error with a retry, not "No images"; the label's control stays while the gallery is open.
  it("shows a failed load as an error that retries the same page", async () => {
    mockImages.mockRejectedValueOnce(new Error("down"));
    const wrapper = await open(EditBannerModal, {}, { EmptyState: EmptyStateStub, BasicButton: ButtonStub });
    await wrapper.find("button#banner-media").trigger("click");
    await flushPromises();
    const error = wrapper.find('[data-testid="banner-gallery-error"]');
    expect(error.attributes("data-title")).toBe("layout_extender.gallery_error");

    mockImages.mockResolvedValueOnce({ data: { data: [{ uid: "a", image: "/a.jpg" }], pagination: { total: 1 } } });
    await error.find("button").trigger("click");
    await flushPromises();
    expect(mockImages).toHaveBeenLastCalledWith({ limit: 9, page: 1 });
    expect(wrapper.find('[data-testid="banner-gallery-error"]').exists()).toBe(false);
    expect(wrapper.find(".banner-gallery__grid").exists()).toBe(true);
  });

  it("keeps the labelled gallery button while the gallery is open, and hides the gallery with it", async () => {
    mockImages.mockResolvedValue({ data: { data: [], pagination: { total: 0 } } });
    const wrapper = await open(EditBannerModal, {}, { EmptyState: EmptyStateStub, BasicButton: ButtonStub });
    await wrapper.find("button#banner-media").trigger("click");
    await flushPromises();
    const button = wrapper.find("button#banner-media");
    expect(button.attributes("aria-expanded")).toBe("true");
    await button.trigger("click");
    expect(wrapper.vm.galleryOpen).toBe(false);
    expect(wrapper.find("button#banner-media").attributes("aria-expanded")).toBe("false");
  });

  it("titles the translations drawer with the field's label", async () => {
    const wrapper = await open(EditBannerModal);
    wrapper.vm.translatingField = "button_label";
    await flushPromises();
    expect(wrapper.findComponent({ name: "TranslationsDrawer" }).props("title")).toBe("Button label");
  });
});
