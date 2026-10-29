import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockLookupSearch = vi.fn();
const mockDownscaleImage = vi.fn();

vi.mock("@/api/lookup/api", () => ({
  POST_LookupSearch: (...args) => mockLookupSearch(...args),
}));

vi.mock("@/utils/imageDownscale", () => ({
  downscaleImage: (...args) => mockDownscaleImage(...args),
}));

import DedupSearchBox from "@/components/lookup/DedupSearchBox.vue";

const globalStubs = {
  FilterChip: {
    name: "FilterChip",
    props: ["label", "active"],
    emits: ["click"],
    template:
      "<button class='stub-chip' :data-active='active' @click=\"$emit('click')\">{{ label }}</button>",
  },
  BasicInput: {
    name: "BasicInput",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      "<input class='stub-input' :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
  },
  BasicButton: {
    name: "BasicButton",
    props: ["text", "isDisabled"],
    emits: ["click"],
    template:
      "<button class='stub-button' :disabled='isDisabled' @click=\"$emit('click')\">{{ text }}</button>",
  },
  FontAwesomeIcon: true,
};

describe("DedupSearchBox.vue", () => {
  beforeEach(() => {
    mockLookupSearch.mockReset();
    mockDownscaleImage.mockReset();
  });

  function mountBox(props = {}) {
    return mount(DedupSearchBox, {
      props,
      global: { stubs: globalStubs },
    });
  }

  it("calls POST_LookupSearch (/search/) and seeds the query from initialQuery", async () => {
    mockLookupSearch.mockResolvedValue({
      data: {
        hits: [{ kind: "pim_product", ref: "SKU-1" }],
        query_parsed: {},
        warnings: [],
      },
    });
    const wrapper = mountBox({ initialQuery: "5901234123457" });
    expect(wrapper.find(".stub-input").element.value).toBe("5901234123457");

    await wrapper.find("[data-testid='dedup-search-submit']").trigger("click");
    await flushPromises();

    expect(mockLookupSearch).toHaveBeenCalledWith({
      scope: ["pim_product", "atlas_source_product"],
      q: "5901234123457",
    });
    const emitted = wrapper.emitted("results");
    expect(emitted).toHaveLength(1);
    expect(emitted[0][0].hits).toHaveLength(1);
    expect(emitted[0][0].q).toBe("5901234123457");
    expect(emitted[0][0].hasImage).toBe(false);
    // Everything the Find view needs to restore this search after back-navigation.
    expect(emitted[0][0].scope).toEqual(["pim_product", "atlas_source_product"]);
    expect(emitted[0][0].imageBlob).toBeNull();
  });

  it("reads only the `hits` field — /search/'s response has no `candidates`", async () => {
    // A caller relying on `data.hits || data.candidates` would silently pass
    // through an unrelated `candidates` field. /search/ never sends one, so
    // the box must not look for it.
    mockLookupSearch.mockResolvedValue({
      data: {
        candidates: [{ kind: "pim_product", ref: "SKU-STALE" }],
        query_parsed: {},
        warnings: [],
      },
    });
    const wrapper = mountBox({ initialQuery: "5901234123457" });

    await wrapper.find("[data-testid='dedup-search-submit']").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("results")[0][0].hits).toEqual([]);
  });

  it("sends a multipart request once an image is set from a paste event, scope as repeated keys", async () => {
    mockDownscaleImage.mockResolvedValue(
      new Blob(["x"], { type: "image/jpeg" })
    );
    mockLookupSearch.mockResolvedValue({
      data: { hits: [], query_parsed: {}, warnings: [] },
    });
    const wrapper = mountBox();

    const imageFile = new File(["bytes"], "photo.png", { type: "image/png" });
    await wrapper.find(".stub-input").trigger("paste", {
      clipboardData: { files: [imageFile], items: [] },
    });
    await flushPromises();

    await wrapper.find("[data-testid='dedup-search-submit']").trigger("click");
    await flushPromises();

    expect(mockDownscaleImage).toHaveBeenCalledWith(imageFile);
    const payload = mockLookupSearch.mock.calls[0][0];
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get("image")).toBeInstanceOf(Blob);
    // Django reads scope via request.POST.getlist("scope") — repeated keys,
    // not a single comma-joined or JSON-encoded value.
    expect(payload.getAll("scope")).toEqual([
      "pim_product",
      "atlas_source_product",
    ]);
    // The view needs to know the query carried a picture to word its empty state.
    expect(wrapper.emitted("results")[0][0].hasImage).toBe(true);
    expect(wrapper.emitted("results")[0][0].imageBlob).toBeInstanceOf(Blob);
  });

  it("seeds the picker from initialImage and sends that blob on search", async () => {
    // Restoring the Find view after back-navigation: the blob was downscaled on
    // the original pick, so it goes straight into the payload — no second pass.
    mockLookupSearch.mockResolvedValue({
      data: { hits: [], query_parsed: {}, warnings: [] },
    });
    const blob = new Blob(["restored"], { type: "image/jpeg" });
    const wrapper = mountBox({ initialImage: blob });

    await wrapper.find("[data-testid='dedup-search-submit']").trigger("click");
    await flushPromises();

    expect(mockDownscaleImage).not.toHaveBeenCalled();
    const payload = mockLookupSearch.mock.calls[0][0];
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get("image")).toBeInstanceOf(Blob);
    expect(wrapper.emitted("results")[0][0].hasImage).toBe(true);
  });

  it("toggles scope chips without dropping below one active catalog (DOM state)", async () => {
    const wrapper = mountBox();
    const chips = wrapper.findAll(".stub-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0].attributes("data-active")).toBe("true");
    expect(chips[1].attributes("data-active")).toBe("true");

    await chips[0].trigger("click");
    expect(wrapper.findAll(".stub-chip")[0].attributes("data-active")).toBe(
      "false"
    );
    expect(wrapper.findAll(".stub-chip")[1].attributes("data-active")).toBe(
      "true"
    );

    // The last remaining scope cannot be toggled off.
    await wrapper.findAll(".stub-chip")[1].trigger("click");
    expect(wrapper.findAll(".stub-chip")[0].attributes("data-active")).toBe(
      "false"
    );
    expect(wrapper.findAll(".stub-chip")[1].attributes("data-active")).toBe(
      "true"
    );
  });

  it("shows an error banner and emits error when the API call rejects", async () => {
    mockLookupSearch.mockRejectedValue({
      response: {
        status: 500,
        data: { detail: "Internal server error [abc]" },
      },
    });
    const wrapper = mountBox({ initialQuery: "5901234123457" });

    await wrapper.find("[data-testid='dedup-search-submit']").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("results")).toBeUndefined();
    expect(wrapper.emitted("error")).toHaveLength(1);
    const banner = wrapper.find(".dedup-search-box__error");
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain("Internal server error [abc]");
  });

  it("shows an error banner when downscaling a picked image fails, without calling the API", async () => {
    mockDownscaleImage.mockRejectedValue(new Error("bad image"));
    const wrapper = mountBox();

    const imageFile = new File(["bytes"], "photo.png", { type: "image/png" });
    await wrapper.find(".stub-input").trigger("paste", {
      clipboardData: { files: [imageFile], items: [] },
    });
    await flushPromises();

    const banner = wrapper.find(".dedup-search-box__error");
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toBe("lookup.box.image_error");
    expect(mockLookupSearch).not.toHaveBeenCalled();
  });

  it("rejects an oversized image before ever calling downscaleImage", async () => {
    const wrapper = mountBox();
    const hugeFile = new File(["bytes"], "huge.png", { type: "image/png" });
    Object.defineProperty(hugeFile, "size", { value: 21 * 1024 * 1024 });

    await wrapper.find(".stub-input").trigger("paste", {
      clipboardData: { files: [hugeFile], items: [] },
    });
    await flushPromises();

    expect(mockDownscaleImage).not.toHaveBeenCalled();
    expect(wrapper.find(".dedup-search-box__error").text()).toBe(
      "lookup.box.image_too_large"
    );
  });

  describe("drag and drop", () => {
    const fileDrag = (files = []) => ({
      dataTransfer: { types: ["Files"], files },
    });

    it("highlights the whole box, not just the thumb, while a file is dragged over", async () => {
      const wrapper = mountBox();
      const box = wrapper.find(".dedup-search-box");

      expect(box.classes()).not.toContain("dedup-search-box--dragover");

      await box.trigger("dragenter", fileDrag());

      expect(box.classes()).toContain("dedup-search-box--dragover");
      // the thumb mirrors the same state, so the eye lands on the target
      expect(
        wrapper.findComponent({ name: "ImagePickerThumb" }).props("dragActive")
      ).toBe(true);
    });

    it("keeps the highlight while the drag crosses child elements", async () => {
      const wrapper = mountBox();
      const box = wrapper.find(".dedup-search-box");

      // enter the box, then enter a child: two enters, one leave when the child
      // is left. A boolean flag would drop the highlight here — the counter must not.
      await box.trigger("dragenter", fileDrag());
      await wrapper.find(".stub-input").trigger("dragenter", fileDrag());
      await wrapper.find(".stub-input").trigger("dragleave", fileDrag());

      expect(box.classes()).toContain("dedup-search-box--dragover");

      // leaving the box itself clears it
      await box.trigger("dragleave", fileDrag());
      expect(box.classes()).not.toContain("dedup-search-box--dragover");
    });

    it("accepts a file dropped anywhere on the box", async () => {
      mockDownscaleImage.mockResolvedValue(
        new Blob(["small"], { type: "image/png" })
      );
      const wrapper = mountBox();
      const box = wrapper.find(".dedup-search-box");
      const imageFile = new File(["bytes"], "photo.png", { type: "image/png" });

      await box.trigger("dragenter", fileDrag([imageFile]));
      await box.trigger("drop", fileDrag([imageFile]));
      await flushPromises();

      expect(mockDownscaleImage).toHaveBeenCalledWith(imageFile);
      expect(box.classes()).not.toContain("dedup-search-box--dragover");
    });

    it("ignores a drag that carries no files", async () => {
      const wrapper = mountBox();
      const box = wrapper.find(".dedup-search-box");

      await box.trigger("dragenter", {
        dataTransfer: { types: ["text/plain"], files: [] },
      });

      expect(box.classes()).not.toContain("dedup-search-box--dragover");
    });

    it("swaps the hint to the active wording while dragging", async () => {
      const wrapper = mountBox();
      const box = wrapper.find(".dedup-search-box");
      const hint = () =>
        wrapper.find("[data-testid='dedup-search-drop-hint']").text();

      expect(hint()).toBe("lookup.box.drop_hint");
      await box.trigger("dragenter", fileDrag());
      expect(hint()).toBe("lookup.box.drop_active");
    });
  });
});
