import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import LengthInput from "@/views/Pim/components/LengthInput.vue";

const stubs = {
  BasicInput: {
    name: "BasicInput",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: "<input :value='modelValue' />",
  },
  BasicSelect: {
    name: "BasicSelect",
    props: ["modelValue", "options"],
    emits: ["update:modelValue"],
    template: "<i />",
  },
};

const mountInput = (modelValue) => mount(LengthInput, { props: { modelValue }, global: { stubs } });
const input = (wrapper) => wrapper.findComponent({ name: "BasicInput" });
const unit = (wrapper) => wrapper.findComponent({ name: "BasicSelect" });

describe("LengthInput", () => {
  it("offers both units and starts on the stored millimetres", () => {
    const wrapper = mountInput("165.1");

    expect(unit(wrapper).props("options").map((o) => o.value)).toEqual(["mm", "inch"]);
    expect(input(wrapper).props("modelValue")).toBe("165.1");
  });

  it("shows the stored value in inches on request", async () => {
    const wrapper = mountInput("165.1");

    await unit(wrapper).vm.$emit("update:modelValue", "inch");

    expect(input(wrapper).props("modelValue")).toBe(6.5);
  });

  it("stores a value typed in inches as millimetres", async () => {
    const wrapper = mountInput(null);
    await unit(wrapper).vm.$emit("update:modelValue", "inch");

    await input(wrapper).vm.$emit("update:modelValue", "6.5");

    expect(wrapper.emitted("update:modelValue")[0]).toEqual([165.1]);
  });

  it("stores a value typed in millimetres as it is", async () => {
    const wrapper = mountInput(null);

    await input(wrapper).vm.$emit("update:modelValue", "165");

    expect(wrapper.emitted("update:modelValue")[0]).toEqual(["165"]);
  });

  it("keeps an empty field empty in either unit", async () => {
    const wrapper = mountInput(null);
    await unit(wrapper).vm.$emit("update:modelValue", "inch");

    expect(input(wrapper).props("modelValue")).toBeNull();

    await input(wrapper).vm.$emit("update:modelValue", "");

    expect(wrapper.emitted("update:modelValue")[0]).toEqual([""]);
  });
});
