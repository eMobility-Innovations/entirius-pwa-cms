import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockContent = vi.fn();
const mockPutTags = vi.fn();
vi.mock("@/api/contentDB/api", () => ({
  _METHOD_content: (...args) => mockContent(...args),
  PUT_ImageTags: (...args) => mockPutTags(...args),
  DELETE_ImageTags: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
const ai = vi.hoisted(() => ({ module: null, writable: true, usable: true }));
vi.mock("@/views/Pim/components/enrichment/useAiWorkers", async () => {
  const { ref } = await import("vue");
  return {
    useAiWorkers: (module) => {
      ai.module = module;
      return {
        workers: ref([{ key: "contentdb.image", kind: "image" }, { key: "article.compose", kind: "compose" }]),
        templates: ref([
          { key: "gallery-image-packshot", label: "Packshot", worker_key: "contentdb.image" },
          { key: "article.compose", label: "Article", worker_key: "article.compose" },
        ]),
        writable: ref(ai.writable),
        usable: ref(ai.usable),
        reloadTemplates: vi.fn(),
      };
    },
  };
});
vi.mock("@/components/ConfigHealth/AiToolboxHint.vue", () => ({ default: { name: "AiToolboxHint", render: () => null } }));

import Gallery from "@/views/Gallery.vue";

const TAGS = [
  { slug: "summer", label: "Summer" },
  { slug: "blog-cover", label: "Blog cover" },
];
const IMAGE = { uid: "img-1", image: "a.jpg", width: 800, height: 600, meta: { fileName: "a.jpg" }, tags: [TAGS[0]] };

// The API answers by URL: the tag list, else one page of images.
const answer = ({ url }) =>
  url === "/image-tags/" ? { data: { data: TAGS } } : { data: { data: [IMAGE], pagination: { pages: 3 } } };

const PageLayout = { template: "<div><slot name='header' /><slot name='toolbar' /><slot /></div>" };
const FilterChip = { props: ["label", "active"], emits: ["click"], template: "<button class='chip' @click=\"$emit('click')\">{{ label }}</button>" };

const BulkActionBar = { name: "BulkActionBar", props: ["count", "actions"], emits: ["action", "clear"], template: "<div />" };
const RunAiTaskDialog = {
  name: "RunAiTaskDialog",
  props: ["open", "workers", "templates", "initialTemplate", "skus", "module", "subjectChannel"],
  emits: ["close", "created", "template-saved"],
  template: "<div />",
};

const mountGallery = async () => {
  const wrapper = mount(Gallery, {
    global: {
      components: { PageLayout, FilterChip },
      stubs: { RunAiTaskDialog, BulkActionBar, BasicCheckbox: true, FilterChip: false, PageHeader: true, BasicSelect: true, MediaTile: true, IconButton: true, Tag: true, Pagination: true, FloatingActions: true, BasicModal: true, ConfirmDialog: true },
    },
  });
  await flushPromises();
  return wrapper;
};

const lastImagesQuery = () => mockContent.mock.calls.map(([arg]) => arg).filter(({ url }) => url === "/images/").at(-1);

describe("Gallery", () => {
  beforeEach(() => {
    mockContent.mockReset().mockImplementation(async (arg) => answer(arg));
    mockPutTags.mockReset().mockResolvedValue({});
    Object.assign(ai, { module: null, writable: true, usable: true });
  });

  describe("AI on selected images", () => {
    it("loads the contentdb image workers only; the picked images open the run dialog as image refs with the template", async () => {
      const wrapper = await mountGallery();
      expect(ai.module).toBe("contentdb");
      wrapper.vm.toggleSelected(IMAGE);
      wrapper.vm.toggleSelected({ uid: "img-2" });
      await flushPromises();
      const bar = wrapper.findComponent({ name: "BulkActionBar" });
      expect(bar.props("count")).toBe(2);
      expect(bar.props("actions")[0].options.map((o) => o.value)).toEqual(["gallery-image-packshot", "__custom"]);
      bar.vm.$emit("action", "ai_images", "gallery-image-packshot");
      await flushPromises();
      const dialog = wrapper.findComponent({ name: "RunAiTaskDialog" });
      expect(dialog.props("workers").map((w) => w.key)).toEqual(["contentdb.image"]);
      expect(dialog.props()).toMatchObject({
        open: true, module: "contentdb", subjectChannel: "gallery", initialTemplate: "gallery-image-packshot",
        skus: ["image:img-1", "image:img-2"],
      });
    });

    it("a second click unselects; a spawned run clears the selection", async () => {
      const wrapper = await mountGallery();
      wrapper.vm.toggleSelected(IMAGE);
      wrapper.vm.toggleSelected({ uid: "img-2" });
      wrapper.vm.toggleSelected(IMAGE);
      expect(wrapper.vm.selected).toEqual(["img-2"]);
      wrapper.vm.handleBulkAction("ai_images", "__custom");
      await flushPromises();
      expect(wrapper.findComponent({ name: "RunAiTaskDialog" }).props("initialTemplate")).toBe("");
      wrapper.findComponent({ name: "RunAiTaskDialog" }).vm.$emit("created", {});
      expect(wrapper.vm.selected).toEqual([]);
    });

    it("without write on AI proposals there is no selection and no dialog", async () => {
      ai.writable = false;
      const wrapper = await mountGallery();
      expect(wrapper.vm.selectable).toBe(false);
      expect(wrapper.findComponent({ name: "RunAiTaskDialog" }).exists()).toBe(false);
    });

    it("with the AI toolbox down the bar offers no AI action", async () => {
      ai.usable = false;
      const wrapper = await mountGallery();
      wrapper.vm.toggleSelected(IMAGE);
      expect(wrapper.vm.bulkActions).toEqual([]);
    });
  });

  it("a tag chip filters the grid by its slug from page 1, a second click clears it", async () => {
    const wrapper = await mountGallery();
    const chip = wrapper.findAll(".chip")[1];
    await chip.trigger("click");
    await flushPromises();
    expect(lastImagesQuery().params).toMatchObject({ page: 1, tags: ["blog-cover"] });
    expect(wrapper.findAllComponents(FilterChip)[1].props("active")).toBe(true);
    await chip.trigger("click");
    await flushPromises();
    expect(lastImagesQuery().params.tags).toEqual([]);
  });

  it("sort and page size reload the first page with the new value", async () => {
    const wrapper = await mountGallery();
    wrapper.vm.setSort("created_at");
    await flushPromises();
    expect(lastImagesQuery().params).toMatchObject({ page: 1, sort: "created_at", limit: 18 });
    wrapper.vm.setLimit(36);
    await flushPromises();
    expect(lastImagesQuery().params).toMatchObject({ page: 1, sort: "created_at", limit: 36 });
  });

  it("the tag editor saves the picked labels as the image's tag objects", async () => {
    const wrapper = await mountGallery();
    wrapper.vm.openTagEditor(IMAGE);
    expect(wrapper.vm.selected_tags).toEqual(["Summer"]);
    wrapper.vm.selected_tags = ["Summer", "Blog cover"];
    wrapper.vm.saveImageTags();
    await flushPromises();
    expect(mockPutTags).toHaveBeenCalledWith({ uid: "img-1", tags: TAGS });
    expect(wrapper.vm.dialog).toBe(null);
  });

  it("the tag editor works on a copy: a cancelled edit leaves the tile's tags alone", async () => {
    const wrapper = await mountGallery();
    const image = { ...IMAGE, tags: [TAGS[0]] };
    wrapper.vm.openTagEditor(image);
    wrapper.vm.edited_image_tags.push(TAGS[1]);
    wrapper.vm.closeDialog();
    expect(image.tags).toEqual([TAGS[0]]);
  });

  it("deleting a tag that filters the grid drops it from the filter and reloads", async () => {
    const wrapper = await mountGallery();
    await wrapper.findAll(".chip")[0].trigger("click");
    wrapper.vm.selected_tags = ["Summer"];
    await wrapper.vm.deleteSelectedTags();
    await flushPromises();
    expect(wrapper.vm.filter_tags).toEqual([]);
    expect(lastImagesQuery().params.tags).toEqual([]);
  });

  it("deleting a photo waits for the confirmation", async () => {
    const wrapper = await mountGallery();
    wrapper.vm.askDeleteImage(IMAGE);
    expect(mockContent).not.toHaveBeenCalledWith(expect.objectContaining({ method: "delete" }));
    wrapper.vm.runConfirm();
    await flushPromises();
    expect(mockContent).toHaveBeenCalledWith({ url: "/images/img-1/", method: "delete" });
    expect(wrapper.vm.confirm).toBe(null);
  });

  it("the reset control, fourth in the controls row, clears an active tag filter", async () => {
    const wrapper = await mountGallery();
    expect(wrapper.find(".gallery__chips icon-button-stub").exists()).toBe(false);
    await wrapper.findAll(".chip")[0].trigger("click");
    await flushPromises();
    wrapper.findComponent(".gallery__chips icon-button-stub").vm.$emit("click");
    await flushPromises();
    expect(wrapper.vm.filter_tags).toEqual([]);
    expect(lastImagesQuery().params).toMatchObject({ page: 1, tags: [] });
  });

  it("a failed upload keeps the dialog, the picked file, alt and tags", async () => {
    const wrapper = await mountGallery();
    wrapper.vm.openDialog("upload");
    Object.assign(wrapper.vm, { file: "data:image/png;base64,AA", selected_tags: ["Summer"] });
    wrapper.vm.meta.alt = "A cat";
    mockContent.mockRejectedValueOnce(new Error("500"));
    await wrapper.vm.upload_File({});
    expect(wrapper.vm.dialog).toBe("upload");
    expect(wrapper.vm.file).toBe("data:image/png;base64,AA");
    expect(wrapper.vm.meta.alt).toBe("A cat");
    expect(wrapper.vm.selected_tags).toEqual(["Summer"]);
  });

  it("a successful upload closes the dialog and revokes the preview URL", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const wrapper = await mountGallery();
    wrapper.vm.openDialog("upload");
    Object.assign(wrapper.vm, { file: "data:image/png;base64,AA", filePreview: "blob:preview" });
    await wrapper.vm.upload_File({});
    expect(wrapper.vm.dialog).toBe(null);
    expect(revoke).toHaveBeenCalledWith("blob:preview");
    revoke.mockRestore();
  });

  it("the tag manager clears its input after the tag is created", async () => {
    const wrapper = await mountGallery();
    wrapper.vm.openDialog("tags");
    wrapper.vm.new_tag_input = "Winter";
    wrapper.vm.addNewTag();
    await flushPromises();
    expect(mockContent).toHaveBeenCalledWith(expect.objectContaining({ method: "post", payload: { slug: "Winter", label: "Winter" } }));
    expect(wrapper.vm.new_tag_input).toBe("");
  });

  it("a second Upload click while the first is running posts once", async () => {
    const wrapper = await mountGallery();
    wrapper.vm.openDialog("upload");
    wrapper.vm.file = "data:image/png;base64,AA";
    await Promise.all([wrapper.vm.upload_File({}), wrapper.vm.upload_File({})]);
    expect(mockContent.mock.calls.filter(([arg]) => arg.method === "post")).toHaveLength(1);
  });
});
