import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import BulkActionBar from "@/boots/BulkActionBar/index.vue";

const buttonAction = { key: "enable", labelKey: "pim.enable_all", variant: "primary" };
const dropdownAction = {
  key: "visibility",
  labelKey: "pim.change_visibility",
  options: [
    { label: "Catalog & Search", value: 4 },
    { label: "Not visible", value: 1 },
  ],
};

const stubs = {
  BasicSelect: {
    name: "BasicSelect",
    props: ["options", "placeholder", "modelValue"],
    emits: ["update:modelValue"],
    template:
      "<div class='stub-dropdown' @click=\"$emit('update:modelValue', options[0].value)\">{{ placeholder }}</div>",
  },
  BasicButton: {
    name: "BasicButton",
    props: ["text", "variant"],
    template:
      "<button class='stub-button' :data-variant='variant' @click=\"$emit('click')\">{{ text }}<slot /></button>",
  },
};

describe("BulkActionBar boot", () => {
  it("renders count + 'selected' label using selectedLabelKey", () => {
    const wrapper = mount(BulkActionBar, {
      props: { count: 5, actions: [buttonAction], selectedLabelKey: "pim.products_selected" },
      global: { stubs },
    });
    expect(wrapper.text()).toContain("5");
    expect(wrapper.text()).toContain("pim.products_selected");
  });

  it("emits 'action' with key when a button action is clicked", async () => {
    const wrapper = mount(BulkActionBar, {
      props: { count: 3, actions: [buttonAction] },
      global: { stubs },
    });
    const button = wrapper.find(".stub-button");
    await button.trigger("click");
    expect(wrapper.emitted("action")).toBeTruthy();
    expect(wrapper.emitted("action")[0]).toEqual(["enable"]);
  });

  it("emits 'action' with key + value when a dropdown action selects an option", async () => {
    const wrapper = mount(BulkActionBar, {
      props: { count: 2, actions: [dropdownAction] },
      global: { stubs },
    });
    await wrapper.find(".stub-dropdown").trigger("click");
    expect(wrapper.emitted("action")).toBeTruthy();
    expect(wrapper.emitted("action")[0]).toEqual(["visibility", 4]);
  });

  it("emits 'clear' when the clear button is clicked", async () => {
    const wrapper = mount(BulkActionBar, {
      props: { count: 4, actions: [buttonAction], clearLabelKey: "pim.clear_selection" },
      global: { stubs },
    });
    const buttons = wrapper.findAll(".stub-button");
    const clearButton = buttons.find((b) => b.text() === "pim.clear_selection");
    expect(clearButton).toBeTruthy();
    await clearButton.trigger("click");
    expect(wrapper.emitted("clear")).toBeTruthy();
  });

  it("passes each action's variant to its button; secondary without one", () => {
    const legacy = { key: "old", labelKey: "pim.old" };
    const wrapper = mount(BulkActionBar, {
      props: { count: 3, actions: [buttonAction, legacy] },
      global: { stubs },
    });
    const [enable, old] = wrapper.findAll(".stub-button");
    expect(enable.attributes("data-variant")).toBe("primary");
    expect(enable.text()).toBe("pim.enable_all");
    expect(old.attributes("data-variant")).toBe("secondary");
  });

  it("renders multiple actions in order (buttons + dropdown)", () => {
    const wrapper = mount(BulkActionBar, {
      props: {
        count: 1,
        actions: [
          buttonAction,
          { key: "disable", labelKey: "pim.disable_all", variant: "danger" },
          dropdownAction,
        ],
      },
      global: { stubs },
    });
    expect(wrapper.findAll(".stub-button").length).toBe(3);
    expect(wrapper.findAll(".stub-dropdown").length).toBe(1);
  });
});
