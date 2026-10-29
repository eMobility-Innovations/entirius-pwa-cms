// Redmine #34300: the config part of the section / tile drawer must render its type selects (the retired Dropdown
// boot left them as empty, unresolved elements) and a pick must set the config value.
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const handy = {
  handyType: { label: "New section" },
  defaults: { doc_type: "static-page" },
  options: { config_type: "section_configs" },
  open_Handykit: vi.fn(),
  pass_Asset: vi.fn(),
};

vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/handy", () => ({ useHandyStore: () => handy }));

import ConfigsKit from "@/functionals/Handy-kit/kits/configs-kit/index.vue";
import hidden_config from "@/../__client/configs/__hidden_config.json";
import core_config from "@/../__client/configs/__core_config.json";
import optional_config from "@/../__client/configs/__optional_config.json";
import core_properties from "@/../__client/props/__props.json";
import props_options from "@/../__client/props/__props_options.json";
import props_handlers from "@/../__client/props/__props_handlers.json";

const BasicSelect = {
  name: "BasicSelect",
  props: ["modelValue", "options", "floatingLabel"],
  emits: ["update:modelValue"],
  template: "<div />",
};

// Vitest cannot resolve load_configs' `${client}` imports, so the kit gets the same JSON configs from the test.
vi.spyOn(ConfigsKit.methods, "load_configs").mockResolvedValue();

const mountKit = async () => {
  const wrapper = mount(ConfigsKit, {
    global: { stubs: { BasicSelect } },
  });
  Object.assign(wrapper.vm, { hidden_config, core_config, optional_config, core_properties, props_options, props_handlers });
  await wrapper.vm.set_configs({});
  await flushPromises();
  return wrapper;
};

describe("configs-kit", () => {
  it("renders the element type as a select with the section types", async () => {
    const wrapper = await mountKit();
    const typeSelect = wrapper.findAllComponents(BasicSelect)[0];

    expect(typeSelect.props("floatingLabel")).toBe("config.core_type");
    expect(typeSelect.props("options").map(({ value }) => value)).toContain("section-hero-slider");
  });

  it("stores the picked type in the core config", async () => {
    const wrapper = await mountKit();
    wrapper.findAllComponents(BasicSelect)[0].vm.$emit("update:modelValue", "section-hero-slider");

    const coreType = wrapper.vm.core_config.find(({ prop }) => prop === "core_type");
    expect(coreType.__value).toBe("section-hero-slider");
  });
});
