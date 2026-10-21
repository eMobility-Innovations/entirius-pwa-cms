import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { GET_ContentTypes, GET_ContentChannels, GET_Languages, _METHOD_content } from "@/api/contentDB/api";
import Builder from "@/views/Builder/Builder.vue";
import BasicButton from "@/boots/BasicButton/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import BasicTooltip from "@/boots/BasicTooltip/index.vue";

vi.mock("@/api/contentDB/api", async (importOriginal) => ({
  ...(await importOriginal()),
  GET_ContentTypes: vi.fn(),
  GET_ContentChannels: vi.fn(),
  GET_Languages: vi.fn(),
  _METHOD_content: vi.fn(),
}));

// "Add tile" under a section's tiles is a BasicButton whose click handler reads event.currentTarget (clickIn): it
// must hand the click to the kit trigger (data-add-tile) of its own section.
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
      components: { BasicButton, IconButton, BasicTooltip },
      stubs: {
        BasicButton: false,
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
    if (!wrapper.find('[data-testid="builder-tile-add"]').exists()) throw new Error("tile tray not rendered yet");
  });
  return wrapper;
};

describe("Builder — add tile button", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _METHOD_content.mockReset().mockResolvedValue(CONTENT_RESPONSE);
    GET_ContentTypes.mockReset().mockResolvedValue({ data: { data: [{ slug: "page" }] } });
    GET_ContentChannels.mockReset().mockResolvedValue({ data: { data: [] } });
    GET_Languages.mockReset().mockResolvedValue({ data: { data: [] } });
  });

  it("clicks the add-tile trigger of its section", async () => {
    const wrapper = await mountBuilder();
    expect(wrapper.get('[data-testid="builder-tile-add"]').element.tagName).toBe("BUTTON");
    const trigger = wrapper.get("[data-add-tile]").element;
    const onTrigger = vi.fn();
    trigger.addEventListener("click", onTrigger);

    await wrapper.get('[data-testid="builder-tile-add"]').trigger("click");

    expect(onTrigger).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
