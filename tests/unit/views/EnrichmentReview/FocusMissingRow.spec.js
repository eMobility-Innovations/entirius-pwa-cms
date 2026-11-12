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

function render(row, props = {}) {
  return mount(FocusMissingRow, {
    props: { row: { feature_idx: "f", name: "Field", unit: "", options: [], ...row }, ...props },
    global: { mocks: { $t: (key) => key }, stubs: { BasicSelect: Select, BasicInput: Input } },
  });
}
const select = (wrapper) => wrapper.findComponent(Select);
const input = (wrapper) => wrapper.findComponent(Input);
const submit = (wrapper) => wrapper.find("form").trigger("submit");

describe("FocusMissingRow", () => {
  it("offers a select's options and saves the chosen idx at once, with no Save button", async () => {
    const wrapper = render({ kind: "select", options: [{ idx: "screws", label: "Screws" }, { idx: "clip", label: "Clip" }] });
    expect(input(wrapper).exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
    expect(select(wrapper).props("options")).toEqual([{ value: "screws", label: "Screws" }, { value: "clip", label: "Clip" }]);
    select(wrapper).vm.$emit("update:modelValue", "clip");
    expect(wrapper.emitted("fill")).toEqual([["clip", expect.any(Function)]]);
  });

  it("saves text when focus leaves the row, not while typing, and only once", async () => {
    const wrapper = render({ kind: "text" });
    input(wrapper).vm.$emit("update:modelValue", "screws");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("fill")).toBeUndefined();
    await wrapper.find("form").trigger("focusout", { relatedTarget: null });
    await wrapper.find("form").trigger("focusout", { relatedTarget: null });
    expect(wrapper.emitted("fill")).toEqual([["screws", expect.any(Function)]]);
  });

  it("does not save while focus moves inside the row", async () => {
    const wrapper = render({ kind: "length" });
    input(wrapper).vm.$emit("update:modelValue", "10");
    await wrapper.vm.$nextTick();
    await wrapper.find("form").trigger("focusout", { relatedTarget: wrapper.find(".select").element });
    expect(wrapper.emitted("fill")).toBeUndefined();
  });

  it("retries after the person changes a value that was refused", async () => {
    const wrapper = render({ kind: "decimal" });
    input(wrapper).vm.$emit("update:modelValue", "x");
    await wrapper.vm.$nextTick();
    await submit(wrapper);
    input(wrapper).vm.$emit("update:modelValue", "12");
    await wrapper.vm.$nextTick();
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([["x", expect.any(Function)], ["12", expect.any(Function)]]);
  });

  it("lets the person resubmit the same value after a save was refused", async () => {
    const wrapper = render({ kind: "text" });
    input(wrapper).vm.$emit("update:modelValue", "12");
    await wrapper.vm.$nextTick();
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toHaveLength(1);
    const refused = wrapper.emitted("fill")[0][1];
    expect(refused).toBeInstanceOf(Function);
    refused(false);
    await wrapper.vm.$nextTick();
    await submit(wrapper); // same value, untouched
    expect(wrapper.emitted("fill").map((args) => args[0])).toEqual(["12", "12"]);
  });

  it("does not resubmit a value whose save was accepted", async () => {
    const wrapper = render({ kind: "text" });
    input(wrapper).vm.$emit("update:modelValue", "12");
    await wrapper.vm.$nextTick();
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toHaveLength(1);
    const accepted = wrapper.emitted("fill")[0][1];
    accepted(true);
    await wrapper.vm.$nextTick();
    await submit(wrapper); // same value, untouched
    expect(wrapper.emitted("fill")).toHaveLength(1);
    expect(wrapper.emitted("fill").map((args) => args[0])).toEqual(["12"]);
  });

  it("sends a multiselect as a list, once focus leaves it", async () => {
    const wrapper = render({ kind: "multiselect", options: [{ idx: "a", label: "A" }] });
    expect(select(wrapper).props("multiple")).toBe(true);
    select(wrapper).vm.$emit("update:modelValue", ["a"]);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("fill")).toBeUndefined();
    await wrapper.find("form").trigger("focusout", { relatedTarget: null });
    expect(wrapper.emitted("fill")).toEqual([[["a"], expect.any(Function)]]);
  });

  it("sends a real boolean, and No counts as an answer", async () => {
    const wrapper = render({ kind: "bool" });
    select(wrapper).vm.$emit("update:modelValue", false);
    expect(wrapper.emitted("fill")).toEqual([[false, expect.any(Function)]]);
  });

  it("shows the unit of a number and accepts a decimal comma", async () => {
    const wrapper = render({ kind: "decimal", unit: "Ah" });
    expect(wrapper.text()).toContain("Ah");
    input(wrapper).vm.$emit("update:modelValue", " 12,5 ");
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([["12.5", expect.any(Function)]]);
  });

  it("sends a length with its unit", async () => {
    const wrapper = render({ kind: "length" });
    input(wrapper).vm.$emit("update:modelValue", "10");
    await submit(wrapper);
    expect(wrapper.emitted("fill")).toEqual([[{ value: "10", unit: "mm" }, expect.any(Function)]]);
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
