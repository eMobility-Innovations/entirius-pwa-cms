import { describe, it, expect, afterEach } from "vitest";
import { mount, enableAutoUnmount } from "@vue/test-utils";
import FocusMissingRow from "@/views/EnrichmentReview/FocusMissingRow.vue";

enableAutoUnmount(afterEach);

const Select = {
  props: ["modelValue", "options", "multiple", "placeholder", "searchable", "disabled"],
  emits: ["update:modelValue"],
  template: "<div class='select' />",
};
const Input = {
  props: ["modelValue", "inputmode", "placeholder", "disabled"],
  emits: ["update:modelValue"],
  template: "<input class='input' />",
};
const Button = { props: ["disabled", "mutates", "size"], template: "<button type='submit' :disabled='disabled'><slot /></button>" };

function render(row, props = {}) {
  return mount(FocusMissingRow, {
    props: { row: { feature_idx: "f", name: "Field", unit: "", options: [], ...row }, ...props },
    global: { mocks: { $t: (key) => key }, stubs: { BasicSelect: Select, BasicInput: Input, BasicButton: Button } },
  });
}
const select = (wrapper) => wrapper.findComponent(Select);
const input = (wrapper) => wrapper.findComponent(Input);
const submit = (wrapper) => wrapper.find("form").trigger("submit");

describe("FocusMissingRow", () => {
  it("offers a select's options and sends the chosen idx, never free text", async () => {
    const wrapper = render({ kind: "select", options: [{ idx: "screws", label: "Screws" }, { idx: "clip", label: "Clip" }] });
    expect(input(wrapper).exists()).toBe(false);
    expect(select(wrapper).props("options")).toEqual([{ value: "screws", label: "Screws" }, { value: "clip", label: "Clip" }]);
    select(wrapper).vm.$emit("update:modelValue", "clip");
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([["clip"]]);
  });

  it("sends a multiselect as a list", async () => {
    const wrapper = render({ kind: "multiselect", options: [{ idx: "a", label: "A" }] });
    expect(select(wrapper).props("multiple")).toBe(true);
    select(wrapper).vm.$emit("update:modelValue", ["a"]);
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([[["a"]]]);
  });

  it("sends a real boolean, and No counts as an answer", async () => {
    const wrapper = render({ kind: "bool" });
    select(wrapper).vm.$emit("update:modelValue", false);
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([[false]]);
  });

  it("shows the unit of a number and accepts a decimal comma", async () => {
    const wrapper = render({ kind: "decimal", unit: "Ah" });
    expect(wrapper.text()).toContain("Ah");
    input(wrapper).vm.$emit("update:modelValue", " 12,5 ");
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([["12.5"]]);
  });

  it("sends a length with its unit", async () => {
    const wrapper = render({ kind: "length" });
    input(wrapper).vm.$emit("update:modelValue", "10");
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([[{ value: "10", unit: "mm" }]]);
  });

  it.each([["text"], ["select"], ["multiselect"]])("does not save an empty %s", async (kind) => {
    const wrapper = render({ kind });
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toBeUndefined();
  });

  it("does not save while the card is busy", async () => {
    const wrapper = render({ kind: "text" }, { disabled: true });
    input(wrapper).vm.$emit("update:modelValue", "x");
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toBeUndefined();
  });
});
