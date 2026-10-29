// Plan 54b: a kit opened on one tab (handy.preventOtherTabs) renders the other tabs disabled; otherwise they switch.
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useHandyStore } from "@/stores/handy";
import BasicTabs from "@/boots/BasicTabs/index.vue";
import ImagesKit from "@/functionals/Handy-kit/kits/images-kit/images-kit.vue";

const mountKit = (state) => {
  const pinia = createPinia();
  setActivePinia(pinia);
  Object.assign(useHandyStore(), state);
  return mount(ImagesKit, {
    global: { plugins: [pinia], components: { BasicTabs }, stubs: { ImagesLibrary: true, AddNewImage: true, AddNewCategory: true } },
  });
};
const tabStates = (wrapper) => wrapper.findAll('[role="tab"]').map((tab) => tab.attributes("disabled") !== undefined);

describe("images-kit tabs", () => {
  it("disables every tab but the one the kit was opened on", () => {
    const wrapper = mountKit({ handyFold: "AddNewImage", preventOtherTabs: true });
    expect(tabStates(wrapper)).toEqual([true, false, true]);
    expect(wrapper.find('[aria-selected="true"]').text()).toBe("images.new_photo");
  });

  it("switches tabs when nothing blocks them", async () => {
    const wrapper = mountKit({ preventOtherTabs: false });
    expect(tabStates(wrapper)).toEqual([false, false, false]);
    await wrapper.findAll('[role="tab"]')[2].trigger("click");
    expect(wrapper.find('[aria-selected="true"]').text()).toBe("images.add_new_category");
  });
});
