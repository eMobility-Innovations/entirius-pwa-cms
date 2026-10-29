import { describe, it, expect } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

import FormField from "@/boots/FormField/index.vue";
import ImportChooseFile from "@/views/Stock/ImportChooseFile.vue";

// Plan 40 review: the visible "Choose file" button is the field's control — the label's `for` points at it, and its
// name is the field label followed by its own text (label in name).
describe("ImportChooseFile in a FormField", () => {
  it("claims the field id and is labelled by the field label and its own text", () => {
    const Host = defineComponent({ render: () => h(FormField, { label: "CSV" }, () => h(ImportChooseFile)) });
    const BasicButton = { template: "<button><slot /></button>" };
    const wrapper = mount(Host, { global: { stubs: { FormField: false, BasicButton } } });

    const label = wrapper.find("label");
    const button = wrapper.find("button");
    expect(label.attributes("for")).toBe(button.attributes("id"));
    expect(button.attributes("aria-labelledby")).toBe(`${label.attributes("id")} ${button.attributes("id")}`);
  });

  it("emits the picked file and clears the input, so the same file can be picked again", async () => {
    const wrapper = mount(ImportChooseFile, { global: { stubs: { BasicButton: true } } });
    const input = wrapper.find('input[type="file"]');
    const file = new File(["code;name"], "points.csv", { type: "text/csv" });
    const cleared = [];
    Object.defineProperty(input.element, "files", { value: [file] });
    Object.defineProperty(input.element, "value", { set: (v) => cleared.push(v), get: () => "" });
    await input.trigger("change");

    expect(wrapper.emitted("select")[0]).toEqual([file]);
    expect(cleared).toEqual([""]);
  });
});
