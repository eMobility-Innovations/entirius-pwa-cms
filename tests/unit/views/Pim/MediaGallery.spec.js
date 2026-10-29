import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetPictures = vi.fn();
const mockGetVideos = vi.fn();
const mockPatchPicture = vi.fn();
const spawnNotification = vi.fn();

vi.mock("@/api/pim/api", () => ({
  POST_UploadPicture: vi.fn(),
  GET_ProductPictures: (...a) => mockGetPictures(...a),
  POST_ProductPicture: vi.fn(),
  PATCH_ProductPicture: (...a) => mockPatchPicture(...a),
  DELETE_ProductPicture: vi.fn(),
  GET_ProductVideos: (...a) => mockGetVideos(...a),
  POST_ProductVideo: vi.fn(),
  PATCH_ProductVideo: vi.fn(),
  DELETE_ProductVideo: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({
    activeChannel: { idx: "ch-main", default_language: "en" },
    activeChannelLanguages: ["en", "pl"],
  }),
}));

import MediaGallery from "@/views/Pim/components/MediaGallery.vue";

const picture = (overrides = {}) => ({
  pk: 7,
  position: 0,
  picture_role: "MAIN",
  picture: { image_url: "/media/img.png" },
  alt_text_t9n: { en: "Red chair", pl: "Czerwone krzesło" },
  ...overrides,
});

const mountGallery = () =>
  mount(MediaGallery, {
    props: { channelIdx: "ch-main", sku: "SKU-1" },
    global: {
      stubs: {
        draggable: true,
        ConfirmationModal: true,
        TranslationsDrawer: true,
      },
    },
  });

describe("MediaGallery alt_text_t9n", () => {
  beforeEach(() => {
    mockGetPictures.mockReset();
    mockGetVideos.mockReset();
    mockPatchPicture.mockReset();
    spawnNotification.mockReset();
    mockGetVideos.mockResolvedValue({ data: { results: [] } });
  });

  it("maps alt_text_t9n into media items and shows the default-language alt", async () => {
    mockGetPictures.mockResolvedValue({ data: { results: [picture()] } });
    const wrapper = mountGallery();
    await flushPromises();

    const item = wrapper.vm.mediaItems[0];
    expect(item.altTextT9n).toEqual({
      en: "Red chair",
      pl: "Czerwone krzesło",
    });
    expect(item.altText).toBe("Red chair"); // default language wins
  });

  it("falls back to any filled language when the default one is empty", async () => {
    mockGetPictures.mockResolvedValue({
      data: { results: [picture({ alt_text_t9n: { pl: "Tylko polski" } })] },
    });
    const wrapper = mountGallery();
    await flushPromises();

    expect(wrapper.vm.mediaItems[0].altText).toBe("Tylko polski");
  });

  it("PATCHes the FULL merged dict — drawer edit of one language keeps siblings", async () => {
    mockGetPictures.mockResolvedValue({ data: { results: [picture()] } });
    mockPatchPicture.mockResolvedValue({ data: {} });
    const wrapper = mountGallery();
    await flushPromises();

    wrapper.vm.openEdit(wrapper.vm.mediaItems[0]);
    // Drawer saves a full values map (TranslationsDrawer contract) — en edited, pl untouched.
    wrapper.vm.onAltTranslationsSave({
      values: { en: "New chair alt", pl: "Czerwone krzesło" },
    });
    await wrapper.vm.saveEdit();

    expect(mockPatchPicture).toHaveBeenCalledTimes(1);
    const payload = mockPatchPicture.mock.calls[0][3];
    expect(payload.alt_text_t9n).toEqual({
      en: "New chair alt",
      pl: "Czerwone krzesło",
    });
    expect(payload).not.toHaveProperty("alt_text"); // legacy string field is dead
  });

  it("editing the role alone still sends the untouched alt dict (no data loss)", async () => {
    mockGetPictures.mockResolvedValue({ data: { results: [picture()] } });
    mockPatchPicture.mockResolvedValue({ data: {} });
    const wrapper = mountGallery();
    await flushPromises();

    wrapper.vm.openEdit(wrapper.vm.mediaItems[0]);
    wrapper.vm.editingItem.editRole = "GENERAL";
    await wrapper.vm.saveEdit();

    const payload = mockPatchPicture.mock.calls[0][3];
    expect(payload.picture_role).toBe("GENERAL");
    expect(payload.alt_text_t9n).toEqual({
      en: "Red chair",
      pl: "Czerwone krzesło",
    });
  });

  it("openEdit clones the dict — drawer edits do not leak into the list before save", async () => {
    mockGetPictures.mockResolvedValue({ data: { results: [picture()] } });
    const wrapper = mountGallery();
    await flushPromises();

    wrapper.vm.openEdit(wrapper.vm.mediaItems[0]);
    wrapper.vm.editingItem.editAltTextT9n.en = "Mutated";

    expect(wrapper.vm.mediaItems[0].altTextT9n.en).toBe("Red chair");
  });

  it("hands the drawer the edited dict and closes it on save", async () => {
    mockGetPictures.mockResolvedValue({ data: { results: [picture()] } });
    const wrapper = mountGallery();
    await flushPromises();

    wrapper.vm.openEdit(wrapper.vm.mediaItems[0]);
    wrapper.vm.translatingAlt = true;
    wrapper.vm.onAltTranslationsSave({ values: { en: "X", pl: "Y" } });

    expect(wrapper.vm.editingItem.editAltTextT9n).toEqual({ en: "X", pl: "Y" });
    expect(wrapper.vm.translatingAlt).toBe(false);
  });
});

describe("MediaGallery AI menu on a picture", () => {
  const tiles = {
    draggable: { props: ["modelValue"], template: "<div><slot v-for='(element, index) in modelValue' name='item' :element='element' :index='index' /></div>" },
    MediaTile: { template: "<div><slot name='actions' /></div>" },
    BasicMenu: { name: "BasicMenu", props: ["items"], template: "<div><slot name='trigger' /></div>" },
    IconButton: true,
    ConfirmationModal: true,
    TranslationsDrawer: true,
  };
  const mountWith = (props = {}) =>
    mount(MediaGallery, { props: { channelIdx: "ch-main", sku: "SKU-1", ...props }, global: { stubs: tiles } });

  beforeEach(() => {
    mockGetPictures.mockResolvedValue({ data: { results: [picture()] } });
    mockGetVideos.mockResolvedValue({ data: { results: [{ pk: 3, position: 1, video: { video_url: "https://youtu.be/x" } }] } });
  });

  it("a picture's menu runs the chosen action on that picture; a video has none", async () => {
    const actions = [{ key: "image-enhance", label: "Enhance" }];
    const wrapper = mountWith({ aiActions: actions });
    await flushPromises();
    const menus = wrapper.findAllComponents({ name: "BasicMenu" });
    expect(menus).toHaveLength(1);
    expect(menus[0].props("items")).toEqual(actions);
    menus[0].vm.$emit("select", actions[0]);
    expect(wrapper.emitted("ai-run")).toEqual([[{ template: "image-enhance", pictureRef: "7" }]]);
  });

  it("no actions, no menu", async () => {
    const wrapper = mountWith();
    await flushPromises();
    expect(wrapper.findAllComponents({ name: "BasicMenu" })).toHaveLength(0);
  });
});
