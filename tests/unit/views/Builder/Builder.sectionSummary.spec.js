import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { GET_ContentTypes, GET_ContentChannels, GET_Languages, _METHOD_content } from "@/api/contentDB/api";
import Builder from "@/views/Builder/Builder.vue";
import IconButton from "@/boots/IconButton/index.vue";
import BasicTooltip from "@/boots/BasicTooltip/index.vue";

vi.mock("@/api/contentDB/api", async (importOriginal) => ({
  ...(await importOriginal()),
  GET_ContentTypes: vi.fn(),
  GET_ContentChannels: vi.fn(),
  GET_Languages: vi.fn(),
  _METHOD_content: vi.fn(),
}));

// Plan 61e: the section config summary is visible text under the section title, not a control without an action.
const CONTENT_RESPONSE = {
  data: {
    data: {
      attributes: {},
      category: null,
      content: { sections: { s1: { uid: "s1" } }, sections_order: ["s1"], tiles: {}, tiles_order: { s1: [] } },
      meta: null,
      language: "en",
      name: "Doc",
      routes: null,
      extension: null,
      access_rights: [1],
      channels: [],
      authors: [],
      co_authors: [],
      content_type: "page",
    },
    meta: {},
  },
};

const mountBuilder = async () => {
  const wrapper = mount(Builder, {
    attachTo: document.body,
    global: {
      mocks: { $route: { params: { content_type: "content", type: "page", uid: "doc-1" }, query: {} } },
      components: { IconButton, BasicTooltip },
      stubs: {
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
  await vi.waitFor(() => {
    if (!wrapper.find('[data-testid="builder-section-config"]').exists()) throw new Error("section not rendered yet");
  });
  return wrapper;
};

describe("Builder — section config summary", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _METHOD_content.mockReset().mockResolvedValue(CONTENT_RESPONSE);
    GET_ContentTypes.mockReset().mockResolvedValue({ data: { data: [{ slug: "page" }] } });
    GET_ContentChannels.mockReset().mockResolvedValue({ data: { data: [] } });
    GET_Languages.mockReset().mockResolvedValue({ data: { data: [] } });
  });

  it("is visible text, not a control", async () => {
    const wrapper = await mountBuilder();
    const summary = wrapper.get('[data-testid="builder-section-config"]');
    expect(summary.element.tagName).toBe("P");
    expect(summary.attributes("role")).toBeUndefined();
    expect(summary.attributes("tabindex")).toBeUndefined();
    expect(summary.isVisible()).toBe(true);
    expect(summary.text()).toBe("builder.setted_config: —");
    wrapper.unmount();
  });

  it("a populated summary wraps to two lines at most, the full text in its title", async () => {
    const wrapper = await mountBuilder();
    Object.assign(wrapper.vm, { core_config: [{ prop: "bg" }], optional_config: [{ prop: "cols" }] });
    wrapper.vm.props_dictionary = { bg: "Background", cols: "Columns" };
    Object.assign(wrapper.vm.sections.s1, { bg: "dark", cols: 3 });
    await flushPromises();
    const summary = wrapper.get('[data-testid="builder-section-config"]');
    expect(summary.text()).toBe("builder.setted_config: Background: dark · Columns: 3");
    expect(summary.attributes("title")).toBe("Background: dark · Columns: 3");
    expect(summary.classes()).toContain("lc-2");
    wrapper.unmount();
  });
});
