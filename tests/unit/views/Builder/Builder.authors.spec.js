import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { GET_Authors, GET_ContentTypes, GET_ContentChannels, GET_Languages, _METHOD_content } from "@/api/contentDB/api";
import Builder from "@/views/Builder/Builder.vue";
import FormField from "@/boots/FormField/index.vue";
import Tag from "@/boots/Tag/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import BasicTooltip from "@/boots/BasicTooltip/index.vue";

vi.mock("@/api/contentDB/api", async (importOriginal) => ({
  ...(await importOriginal()),
  GET_Authors: vi.fn(),
  GET_ContentTypes: vi.fn(),
  GET_ContentChannels: vi.fn(),
  GET_Languages: vi.fn(),
  _METHOD_content: vi.fn(),
}));

// The author fields moved from the view-local AuthorPicker to EntitySearchPicker (plan 35): the same `authors` /
// `co_authors` uid arrays the save payload sends.
const state = (overrides = {}) => ({ authors: [], co_authors: [], authorNames: {}, authorRoles: {}, ...overrides });
const call = (name, vm, ...args) => Builder.methods[name].call(Object.assign(vm, Builder.methods), ...args);

describe("Builder — author fields", () => {
  beforeEach(() => GET_Authors.mockReset());

  it("a picked author is appended to its list, once", () => {
    const vm = state({ authors: ["a1"] });
    call("addAuthor", vm, "authors", "a2");
    call("addAuthor", vm, "authors", "a2");
    call("addAuthor", vm, "co_authors", "a3");
    expect(vm).toMatchObject({ authors: ["a1", "a2"], co_authors: ["a3"] });
  });

  it("the picker's clear (null) adds nothing; a Tag removes its author", () => {
    const vm = state({ authors: ["a1", "a2"] });
    call("addAuthor", vm, "authors", null);
    call("removeAuthor", vm, "authors", "a1");
    expect(vm.authors).toEqual(["a2"]);
  });

  it("searches active authors, skips the picked ones and remembers the names for the Tags", async () => {
    GET_Authors.mockResolvedValue({
      data: {
        results: [
          { uid: "a1", name: "Ann", role_t9n: { en: "Editor" } },
          { uid: "a2", name: "Bob", role_t9n: null },
          { uid: "a3", name: "Cid", role_t9n: {} },
        ],
      },
    });
    const vm = state({ authors: ["a1"], co_authors: ["a3"] });
    const options = await call("searchAuthors", vm, "b");

    expect(GET_Authors).toHaveBeenCalledWith({ is_active: true, page_size: 20, search: "b" });
    expect(options).toEqual([{ label: "Bob", value: "a2", secondary: "" }]);
    expect(vm.authorNames).toEqual({ a2: "Bob" });
  });

  it("an empty search sends no search param", async () => {
    GET_Authors.mockResolvedValue({ data: { results: [{ uid: "a1", name: "Ann", role_t9n: { en: "Editor" } }] } });
    const options = await call("searchAuthors", state(), "");
    expect(GET_Authors).toHaveBeenCalledWith({ is_active: true, page_size: 20 });
    expect(options).toEqual([{ label: "Ann", value: "a1", secondary: "Editor" }]);
  });

  it("the Tag label carries the author's role, the plain name without one", () => {
    const vm = state({ authorNames: { a1: "Ann" }, authorRoles: { a1: "Editor", a3: "" } });
    expect(call("authorLabel", vm, "a1")).toBe("Ann — Editor");
    expect(call("authorLabel", vm, "a3")).toBe("a3");
  });
});

// Full mount: the author panel is real (FormField, draggable, Tag, EntitySearchPicker's wiring), everything else
// around it stubbed — Builder's tile/section tree stays empty (no sections in the loaded doc) so it never renders.
const CONTENT_RESPONSE = {
  data: {
    data: {
      attributes: {},
      category: null,
      content: { sections: {}, sections_order: [], tiles: {}, tiles_order: {} },
      meta: null,
      language: "en",
      name: "Doc",
      routes: null,
      extension: null,
      access_rights: [1],
      channels: [],
      authors: [
        { uid: "a1", name: "Ann", role_t9n: { en: "Editor" } },
        { uid: "a3", name: "Cid", role_t9n: {} },
      ],
      co_authors: [],
      content_type: "blog-post",
    },
    meta: {},
  },
};

const EntitySearchPickerStub = {
  props: ["fetchFn", "placeholder", "modelValue"],
  emits: ["update:modelValue"],
  template: '<input class="es-picker-stub" @focus="$emit(\'update:modelValue\', \'a2\')" />',
};

const mountBuilder = async () => {
  const wrapper = mount(Builder, {
    global: {
      mocks: { $route: { params: { content_type: "content", type: "blog-post", uid: "doc-1" }, query: {} } },
      components: { FormField, Tag, IconButton, BasicTooltip },
      stubs: {
        FormField: false,
        EntitySearchPicker: EntitySearchPickerStub,
        PageHeader: true,
        ConfirmDialog: true,
        RenameModal: true,
        NoticeMe: true,
        SubscriberSetter: true,
        BasicSwiper: true,
        HomeVariantSwitcher: true,
        ChannelMultiSelect: true,
        ActionBar: true,
        ImagesControllPreview: true,
        GroupFieldsControllerPreview: true,
        FloatingActions: true,
      },
    },
  });
  await flushPromises();
  wrapper.vm.advanced_options = true;
  wrapper.vm.authorPanelOpen = true;
  // load_configs() dynamic-imports the __client configs; under a loaded suite that takes more than a few ticks.
  await vi.waitFor(() => {
    if (!wrapper.find(".tag__label").exists()) throw new Error("author panel not rendered yet");
  });
  return wrapper;
};

describe("Builder — author panel (mounted)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _METHOD_content.mockReset().mockResolvedValue(CONTENT_RESPONSE);
    GET_ContentTypes.mockReset().mockResolvedValue({ data: { data: [{ slug: "blog-post", supports_authors: true }] } });
    GET_ContentChannels.mockReset().mockResolvedValue({ data: { data: [] } });
    GET_Languages.mockReset().mockResolvedValue({ data: { data: [] } });
    GET_Authors.mockReset();
  });

  it("shows each picked author's role next to the name", async () => {
    const wrapper = await mountBuilder();
    const labels = wrapper.findAll(".tag__label").map((el) => el.text());
    expect(labels).toEqual(["Ann — Editor", "Cid"]);
  });

  it("adds a co-author picked from its EntitySearchPicker", async () => {
    const wrapper = await mountBuilder();
    await wrapper.findAll(".es-picker-stub")[1].trigger("focus");
    expect(wrapper.vm.co_authors).toEqual(["a2"]);
  });

  it("a Tag's close button removes that author from its list", async () => {
    const wrapper = await mountBuilder();
    await wrapper.find(".tag--removable button").trigger("click");
    expect(wrapper.vm.authors).toEqual(["a3"]);
  });

  it("the draggable list's order is the field's array — the reorder wiring vuedraggable relies on", async () => {
    const wrapper = await mountBuilder();
    expect(wrapper.find(".drag-handle").exists()).toBe(true);
    wrapper.vm.authors = ["a3", "a1"];
    await flushPromises();
    const labels = wrapper.findAll(".tag__label").map((el) => el.text());
    expect(labels).toEqual(["Cid", "Ann — Editor"]);
  });
});
