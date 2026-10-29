// Plan 61f: an invalid option code on create is a field error under the code, never a silent return.
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";

const api = vi.hoisted(() => ({
  GET_FeatureAttributes: vi.fn(),
  GET_Attributes: vi.fn(),
  POST_Attribute: vi.fn(),
  PATCH_Attribute: vi.fn(),
  DELETE_Attribute: vi.fn(),
  PATCH_AttributesReorder: vi.fn(),
}));
vi.mock("@/api/pim/api", () => api);

import OptionsManager from "@/views/Pim/components/OptionsManager.vue";
import FormField from "@/boots/FormField/index.vue";
import BasicInput from "@/boots/BasicInput/index.vue";

async function openAddForm() {
  api.GET_FeatureAttributes.mockResolvedValue({ data: { results: [], count: 0 } });
  const wrapper = mount(OptionsManager, {
    props: { featureIdx: "color", languages: ["en"] },
    global: {
      plugins: [createPinia()],
      components: { FormField, BasicInput },
      stubs: { FormField: false, BasicInput: false, BasicTooltip: true, draggable: true, OptionTranslationsDrawer: true },
    },
  });
  await flushPromises();
  wrapper.vm.showAddForm = true;
  await flushPromises();
  return wrapper;
}

describe("OptionsManager — create an option", () => {
  it("an invalid code shows its error under the field and sends nothing", async () => {
    const wrapper = await openAddForm();
    wrapper.vm.newOption.idx = "red wine";
    await wrapper.vm.createOption();
    await flushPromises();
    expect(api.POST_Attribute).not.toHaveBeenCalled();
    const error = wrapper.find(".options-manager__add-form .form-field__error");
    expect(error.text()).toContain("without spaces");
  });

  it("Cancel drops the code error, so the form opens again clean", async () => {
    const wrapper = await openAddForm();
    wrapper.vm.newOption.idx = "red wine";
    await wrapper.vm.createOption();
    wrapper.vm.closeAddForm();
    wrapper.vm.showAddForm = true;
    await flushPromises();
    expect(wrapper.find(".options-manager__add-form .form-field__error").exists()).toBe(false);
  });
});
