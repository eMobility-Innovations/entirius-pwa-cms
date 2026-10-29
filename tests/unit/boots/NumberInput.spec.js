import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import NumberInput from "@/boots/NumberInput/index.vue";

const lastEmit = (wrapper) => wrapper.emitted("update:modelValue").at(-1)[0];

describe("NumberInput boot", () => {
  it("keeps integer entry for an integer step", async () => {
    const wrapper = mount(NumberInput, { props: { modelValue: "" } });
    await wrapper.find("input").setValue("8,5");
    expect(lastEmit(wrapper)).toBe("85");
  });

  it("takes a decimal with a comma or a dot for a fractional step", async () => {
    const wrapper = mount(NumberInput, { props: { modelValue: "", step: 0.01, max: 100 } });
    await wrapper.find("input").setValue("8,5");
    expect(lastEmit(wrapper)).toBe("8.5");
    await wrapper.setProps({ modelValue: "8." });
    expect(wrapper.find("input").element.value).toBe("8.");
  });

  it("steps and clamps to the step's decimal places", async () => {
    const wrapper = mount(NumberInput, { props: { modelValue: "23", step: 0.01, max: 100 } });
    const [minus, plus] = wrapper.findAll("button");
    await minus.trigger("click");
    expect(lastEmit(wrapper)).toBe("22.99");
    await wrapper.setProps({ modelValue: "99.995" });
    await plus.trigger("click");
    expect(lastEmit(wrapper)).toBe("100");
  });

  describe("decimal entry rule", () => {
    const typed = async (text, props = {}) => {
      const wrapper = mount(NumberInput, { props: { modelValue: "", step: 0.01, max: 100, ...props } });
      const input = wrapper.find("input");
      await input.setValue(text);
      return { emitted: lastEmit(wrapper), shown: input.element.value };
    };

    it.each([
      [".", "."],
      ["-", ""],
      [",", "."],
      ["1,2,3", "1.23"],
      ["8,5", "8.5"],
      ["23", "23"],
      ["", ""],
      ["101", "101"],
      ["1a2", "12"],
    ])("%j is kept as %j", async (text, expected) => {
      const { emitted, shown } = await typed(text);
      expect(emitted).toBe(expected);
      expect(shown).toBe(expected);
    });

    it("drops a second separator as it is typed", async () => {
      const wrapper = mount(NumberInput, { props: { modelValue: "1.2", step: 0.01, max: 100 } });
      await wrapper.find("input").setValue("1.2,");
      expect(lastEmit(wrapper)).toBe("1.2");
    });

    it("keeps one leading minus only when min is negative", async () => {
      expect((await typed("-8,5", { min: -10 })).emitted).toBe("-8.5");
      expect((await typed("8-5", { min: -10 })).emitted).toBe("85");
      expect((await typed("-8,5")).emitted).toBe("8.5");
    });
  });

  it("clamps an out-of-range value when the field is left", async () => {
    const wrapper = mount(NumberInput, { props: { modelValue: "101", step: 0.01, max: 100 } });
    await wrapper.find("input").trigger("focusout");
    expect(lastEmit(wrapper)).toBe("100");
  });

  it("locks the value and both steppers when disabled", () => {
    const wrapper = mount(NumberInput, { props: { modelValue: "5", disabled: true } });
    expect(wrapper.find(".number-input--disabled").exists()).toBe(true);
    expect(wrapper.find("input").attributes("disabled")).toBeDefined();
    for (const button of wrapper.findAll("button")) {
      expect(button.attributes("disabled")).toBeDefined();
    }
  });
});
