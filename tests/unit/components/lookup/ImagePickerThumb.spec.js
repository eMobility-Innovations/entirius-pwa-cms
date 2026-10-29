import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ImagePickerThumb from "@/components/lookup/ImagePickerThumb.vue";

const IconButton = { props: ["label"], emits: ["click"], template: "<button @click=\"$emit('click')\" />" };

describe("ImagePickerThumb.vue", () => {
  // Plan 32: the remove control is its own IconButton beside the thumb, no longer nested in the thumb button.
  it("remove emits remove without opening the file picker", async () => {
    const wrapper = mount(ImagePickerThumb, {
      props: { previewUrl: "blob:x" },
      global: { stubs: { IconButton } },
    });
    const pick = (wrapper.vm.$refs.fileInput.click = vi.fn());

    await wrapper.get("[data-testid='dedup-search-remove-image']").trigger("click");

    expect(wrapper.emitted("remove")).toHaveLength(1);
    expect(pick).not.toHaveBeenCalled();
  });

  it("has no remove control without a preview", () => {
    const wrapper = mount(ImagePickerThumb, { global: { stubs: { IconButton } } });

    expect(wrapper.find("[data-testid='dedup-search-remove-image']").exists()).toBe(false);
  });
});
