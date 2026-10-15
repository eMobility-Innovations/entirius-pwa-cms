import { describe, it, expect, vi, afterEach } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { ICONS } from "@/boots/Icons/icons";
import FormField from "@/boots/FormField/index.vue";
import BasicInput from "@/boots/BasicInput/index.vue";
import BasicTextarea from "@/boots/BasicTextarea/index.vue";
import NumberInput from "@/boots/NumberInput/index.vue";
import BasicCheckbox from "@/boots/BasicCheckbox/index.vue";
import BasicRadioGroup from "@/boots/BasicRadioGroup/index.vue";
import BasicSwitch from "@/boots/BasicSwitch/index.vue";
import SegmentedControl from "@/boots/SegmentedControl/index.vue";
import ColorInput from "@/boots/ColorInput/index.vue";
import BasicDatePicker from "@/boots/BasicDatePicker/index.vue";
import BasicWysiwyg from "@/boots/BasicWysiwyg/index.vue";
import { hintsOn } from "@/composables/fieldHints";
import { setLang } from "@/i18n";
import { Polish } from "flatpickr/dist/l10n/pl.js";
import { english } from "flatpickr/dist/l10n/default.js";

const flatpickrInstance = { destroy: vi.fn(), setDate: vi.fn(), input: { value: "" } };
const flatpickr = vi.fn(() => flatpickrInstance);
vi.mock("flatpickr", () => ({ default: (...args) => flatpickr(...args) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isPanelEnabled: () => false }) }));

const GLOBAL = { stubs: { FormField: false, BasicInput: false, BasicTooltip: true }, directives: { out: {} } };

// A control inside a FormField with the given field props.
function inField(control, fieldProps = {}, controlProps = {}) {
  const Host = defineComponent({
    render: () => h(FormField, { label: "Name", ...fieldProps }, () => h(control, controlProps)),
  });
  return mount(Host, { global: GLOBAL });
}

const iconOf = (wrapper) => wrapper.findComponent({ name: "FontAwesomeIcon" }).attributes("icon");

describe("FormField contract", () => {
  it("labels the control: the label's for is the control's id", () => {
    const wrapper = inField(BasicInput);
    const id = wrapper.find("input").attributes("id");
    expect(id).toBeTruthy();
    expect(wrapper.find("label").attributes("for")).toBe(id);
  });

  it("describes the control with the hint, and with the error instead of it", async () => {
    const wrapper = inField(BasicInput, { hint: "Visible in the store" });
    const input = () => wrapper.find("input");
    const tip = wrapper.findComponent({ name: "BasicTooltip" });
    expect(input().attributes("aria-describedby")).toBe(tip.props("tipId"));
    expect(input().attributes("aria-invalid")).toBeUndefined();

    const invalid = inField(BasicInput, { hint: "Visible in the store", error: "Required field" });
    const error = invalid.find(".form-field__error");
    expect(error.attributes("role")).toBe("alert");
    expect(invalid.find("input").attributes("aria-describedby")).toBe(error.attributes("id"));
    expect(invalid.find("input").attributes("aria-invalid")).toBe("true");
  });

  // Plan 61e: a caller's own description (a note under the control) joins the field's, never replaces it.
  it("a caller's aria-describedby joins the field's error", () => {
    const wrapper = inField(BasicInput, { error: "Required field" }, { "aria-describedby": "note" });
    const errorId = wrapper.find(".form-field__error").attributes("id");
    expect(wrapper.find("input").attributes("aria-describedby")).toBe(`${errorId} note`);
    expect(wrapper.find(".input-basic-wrapper").attributes("aria-describedby")).toBeUndefined();
  });

  it("hints off (the account-menu switch): no mark, nothing described by the hint; errors and required stay", async () => {
    hintsOn.value = false;
    try {
      const wrapper = inField(BasicInput, { hint: "Visible in the store", required: true });
      expect(wrapper.findComponent({ name: "BasicTooltip" }).exists()).toBe(false);
      expect(wrapper.find("input").attributes("aria-describedby")).toBeUndefined();
      expect(wrapper.find("label").classes()).toContain("required");
      const invalid = inField(BasicInput, { hint: "Visible in the store", error: "Required field" });
      expect(invalid.find("input").attributes("aria-describedby")).toBe(invalid.find(".form-field__error").attributes("id"));
    } finally {
      hintsOn.value = true;
    }
  });

  it("follows the switch live: turning hints back on restores the mark and the description", async () => {
    hintsOn.value = false;
    const wrapper = inField(BasicInput, { hint: "Visible in the store" });
    hintsOn.value = true;
    await nextTick();
    const tip = wrapper.findComponent({ name: "BasicTooltip" });
    expect(tip.exists()).toBe(true);
    expect(wrapper.find("input").attributes("aria-describedby")).toBe(tip.props("tipId"));
  });

  it("marks required and disables the control", () => {
    const wrapper = inField(BasicInput, { required: true, disabled: true });
    expect(wrapper.find("label").classes()).toContain("required");
    expect(wrapper.find("input").attributes("required")).toBeDefined();
    expect(wrapper.find("input").attributes("disabled")).toBeDefined();
  });

  it("takes a fixed control id", () => {
    const wrapper = inField(BasicInput, { id: "product-name" });
    expect(wrapper.find("input").attributes("id")).toBe("product-name");
    expect(wrapper.find("label").attributes("for")).toBe("product-name");
  });

  it("gives the field's id to its first control only: rows of controls in one field repeat no id", () => {
    const Host = defineComponent({
      render: () => h(FormField, { label: "Progi" }, () => [h(BasicInput), h(NumberInput), h(BasicInput)]),
    });
    const wrapper = mount(Host, { global: GLOBAL });
    const ids = wrapper.findAll("input").map((input) => input.attributes("id"));
    expect(new Set(ids).size).toBe(3);
    expect(wrapper.find("label").attributes("for")).toBe(ids[0]);
  });

  it("shows the hint as the help mark after the label: subtle by default, important on request", () => {
    const wrapper = inField(BasicInput, { hint: "Name in the store" });
    const tip = wrapper.findComponent({ name: "BasicTooltip" });
    expect(tip.attributes("variant")).toBe("help");
    expect(tip.attributes("text")).toBe("Name in the store");
    expect(tip.attributes("level")).toBe("subtle");
    expect(wrapper.find("label").find("basic-tooltip-stub").exists()).toBe(false);
    const important = inField(BasicInput, { hint: "Fixed after create", hintLevel: "important" });
    expect(important.findComponent({ name: "BasicTooltip" }).attributes("level")).toBe("important");
  });

  it("lays out inline on request", () => {
    expect(inField(BasicInput, { layout: "inline" }).classes()).toContain("form-field--inline");
    expect(inField(BasicInput).classes()).toContain("form-field--stacked");
  });
});

describe("BasicInput", () => {
  const mountInput = (props = {}) => mount(BasicInput, { props, global: GLOBAL });

  it("stands alone outside a FormField: own id, nothing described", () => {
    const input = mountInput().find("input");
    expect(input.attributes("id")).toBeTruthy();
    expect(input.attributes("aria-describedby")).toBeUndefined();
  });

  it("runs v-model", async () => {
    const wrapper = mountInput({ modelValue: "Ala" });
    expect(wrapper.find("input").element.value).toBe("Ala");
    await wrapper.find("input").setValue("Ola");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual(["Ola"]);
  });

  it("shows a readonly value behind the lock (the former LockedField)", () => {
    const wrapper = mountInput({ modelValue: "SKU-1", readonly: true, icon: "search" });
    expect(wrapper.find("input").attributes("readonly")).toBeDefined();
    expect(iconOf(wrapper)).toBe(ICONS.lock);
  });

  it("draws a leading meaning icon", () => {
    const wrapper = mountInput({ icon: "search" });
    expect(iconOf(wrapper)).toBe(ICONS.search);
    expect(wrapper.find("input").classes()).toContain("input-field--icon");
  });

  it("takes maxlength onto the native field", () => {
    expect(mountInput({ maxlength: 2 }).find("input").attributes("maxlength")).toBe("2");
    expect(mountInput().find("input").attributes("maxlength")).toBeUndefined();
  });

  it("takes autocomplete, inputmode, min, max and step onto the native field, not the wrapper", () => {
    const native = { autocomplete: "off", inputmode: "decimal", min: "0", max: "10", step: "0.01" };
    const wrapper = mountInput({ type: "number", ...native });
    expect(wrapper.find("input").attributes()).toMatchObject(native);
    Object.keys(native).forEach((name) => expect(wrapper.attributes(name)).toBeUndefined());
    Object.keys(native).forEach((name) => expect(mountInput().find("input").attributes(name)).toBeUndefined());
  });

  it("takes disabled", () => {
    expect(mountInput({ disabled: true }).find("input").attributes("disabled")).toBeDefined();
    expect(mountInput().find("input").attributes("disabled")).toBeUndefined();
  });

  it("shows 0 as 0 and null / false as an empty field", () => {
    expect(mountInput({ modelValue: 0 }).find("input").element.value).toBe("0");
    expect(mountInput({ modelValue: null }).find("input").element.value).toBe("");
    expect(mountInput({ modelValue: false }).find("input").element.value).toBe("");
  });

  it("focuses itself on mount with focusOnCreate", () => {
    const wrapper = mount(BasicInput, { props: { focusOnCreate: true }, global: GLOBAL, attachTo: document.body });
    expect(document.activeElement).toBe(wrapper.find("input").element);
    wrapper.unmount();
  });

  it("has no own label or error text: the FormField's", () => {
    const wrapper = inField(BasicInput, { label: "Name", error: "Error" });
    expect(wrapper.find(".input-label").exists()).toBe(false);
    expect(wrapper.find(".validation-msg").exists()).toBe(false);
    expect(wrapper.find("input").attributes("aria-invalid")).toBe("true");
  });

  describe("events and fallthrough", () => {
    it("keeps the onFocusout and onKeyDown events with the value", async () => {
      const wrapper = mountInput({ modelValue: "x" });
      await wrapper.find("input").trigger("focusout");
      await wrapper.find("input").trigger("keydown.enter");
      expect(wrapper.emitted("onFocusout")).toEqual([["x"]]);
      expect(wrapper.emitted("onKeyDown")).toEqual([["x"]]);
    });

    it("passes unknown listeners and classes to the wrapper, as before", async () => {
      const onInput = vi.fn();
      const wrapper = mount(BasicInput, { attrs: { class: "mb-2", onInput }, global: GLOBAL, attachTo: document.body });
      expect(wrapper.classes()).toContain("mb-2");
      await wrapper.find("input").setValue("a");
      expect(onInput).toHaveBeenCalled();
      wrapper.unmount();
    });
  });
});

describe("BasicInput format (plan 61)", () => {
  const mountInput = (props = {}) => mount(BasicInput, { props, global: GLOBAL });
  const lastModel = (wrapper) => wrapper.emitted("update:modelValue").at(-1)[0];

  it("shows the model in the format and keeps the text as typed while focused", async () => {
    const wrapper = mountInput({ format: "money", modelValue: "232.00" });
    const input = wrapper.find("input");
    expect(input.element.value).toBe("232.00");
    await input.setValue("232,5");
    expect(lastModel(wrapper)).toBe("232.50");
    await wrapper.setProps({ modelValue: "232.50" });
    expect(input.element.value).toBe("232,5");
    await input.trigger("focusout");
    expect(input.element.value).toBe("232.50");
  });

  it("drops the typed text when the parent changes the model while the field has focus", async () => {
    const wrapper = mountInput({ format: "money", modelValue: "" });
    const input = wrapper.find("input");
    await input.setValue("232,5");
    await wrapper.setProps({ modelValue: lastModel(wrapper) });
    expect(input.element.value).toBe("232,5");
    await wrapper.setProps({ modelValue: "" });
    expect(input.element.value).toBe("");
    await wrapper.setProps({ modelValue: "10.00" });
    expect(input.element.value).toBe("10.00");
  });

  it("normalises the model to the format: 232 → 232.00, a code upper-case", async () => {
    const money = mountInput({ format: "money" });
    await money.find("input").setValue("232");
    expect(lastModel(money)).toBe("232.00");
    const code = mountInput({ format: "code" });
    await code.find("input").setValue(" new_lead ");
    expect(lastModel(code)).toBe("NEW_LEAD");
  });

  it("marks an invalid value once the field is left, not while it is typed", async () => {
    const wrapper = mountInput({ format: "ean", modelValue: "" });
    const input = wrapper.find("input");
    await input.setValue("590123412345");
    await wrapper.setProps({ modelValue: lastModel(wrapper) });
    expect(input.attributes("aria-invalid")).toBeUndefined();
    await input.trigger("focusout");
    expect(input.attributes("aria-invalid")).toBe("true");
    await wrapper.setProps({ modelValue: "5901234123457" });
    expect(input.attributes("aria-invalid")).toBeUndefined();
  });

  it("shows the format error through its FormField; the caller's error wins", async () => {
    const wrapper = inField(BasicInput, {}, { format: "money", modelValue: "2.345" });
    await wrapper.find("input").trigger("focusout");
    const error = wrapper.find(".form-field__error");
    expect(error.text()).toContain("Enter an amount with at most two decimal places, e.g. 232.00");
    expect(wrapper.find("input").attributes("aria-describedby")).toBe(error.attributes("id"));
    const withCallerError = inField(BasicInput, { error: "Server says no" }, { format: "money", modelValue: "2.345" });
    await withCallerError.find("input").trigger("focusout");
    expect(withCallerError.find(".form-field__error").text()).toContain("Server says no");
  });

  it("checks min, max and the API pattern", async () => {
    const key = mountInput({ format: "key", pattern: "^[a-z0-9][a-z0-9_-]*$", modelValue: "Fill" });
    await key.find("input").trigger("focusout");
    expect(key.find("input").attributes("aria-invalid")).toBe("true");
    const negative = mountInput({ format: "money", modelValue: "-5.00" });
    await negative.find("input").trigger("focusout");
    expect(negative.find("input").attributes("aria-invalid")).toBe("true");
    const integer = mountInput({ format: "integer", min: 1, modelValue: "0" });
    await integer.find("input").trigger("focusout");
    expect(integer.find("input").attributes("aria-invalid")).toBe("true");
  });

  it("without a format the text goes to the model untouched", async () => {
    const wrapper = mountInput({ modelValue: "" });
    await wrapper.find("input").setValue(" 232,5 ");
    expect(lastModel(wrapper)).toBe(" 232,5 ");
  });
});

describe("BasicTextarea", () => {
  it("runs v-model and counts toward maxlength", async () => {
    const wrapper = mount(BasicTextarea, { props: { modelValue: "abc", maxlength: 10 } });
    expect(wrapper.find(".basic-textarea__counter").text()).toBe("3 / 10");
    expect(wrapper.find("textarea").attributes("maxlength")).toBe("10");
    await wrapper.find("textarea").setValue("abcd");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual(["abcd"]);
  });

  it("has no counter without maxlength; takes rows, disabled, readonly", () => {
    const wrapper = mount(BasicTextarea, { props: { rows: 3, disabled: true, readonly: true } });
    const field = wrapper.find("textarea");
    expect(wrapper.find(".basic-textarea__counter").exists()).toBe(false);
    expect(field.attributes("rows")).toBe("3");
    expect(field.attributes("disabled")).toBeDefined();
    expect(field.attributes("readonly")).toBeDefined();
  });

  it("reads the contract", () => {
    const wrapper = inField(BasicTextarea, { error: "Too long" });
    const field = wrapper.find("textarea");
    expect(wrapper.find("label").attributes("for")).toBe(field.attributes("id"));
    expect(field.attributes("aria-invalid")).toBe("true");
  });
});

describe("NumberInput", () => {
  it("takes disabled: value field and both steppers", () => {
    const wrapper = mount(NumberInput, { props: { modelValue: "5", disabled: true } });
    expect(wrapper.find("input").attributes("disabled")).toBeDefined();
    expect(wrapper.findAll("button").every((b) => b.attributes("disabled") !== undefined)).toBe(true);
  });

  it("reads the contract", () => {
    const wrapper = inField(NumberInput, { error: "Too many", disabled: true });
    const input = wrapper.find("input");
    expect(wrapper.find("label").attributes("for")).toBe(input.attributes("id"));
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(input.attributes("disabled")).toBeDefined();
    expect(wrapper.find(".number-input").classes()).toContain("number-input--invalid");
  });
});

describe("BasicCheckbox", () => {
  it("runs a boolean v-model with the label in its slot", async () => {
    const wrapper = mount(BasicCheckbox, { props: { modelValue: false }, slots: { default: "Aktywny" } });
    expect(wrapper.text()).toBe("Aktywny");
    await wrapper.find("input").setValue(true);
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([true]);
  });

  it("disables and reads the contract", () => {
    const wrapper = inField(BasicCheckbox, { error: "Zaznacz" }, { disabled: true });
    const input = wrapper.find("input");
    expect(input.attributes("disabled")).toBeDefined();
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(wrapper.find("label.form-field__label").attributes("for")).toBe(input.attributes("id"));
  });
});

describe("BasicRadioGroup", () => {
  const options = [
    { label: "One", value: 1 },
    { label: "Two", value: 2 },
  ];

  it("is a named radio group: one name, checked from v-model, a change emits the value", async () => {
    const wrapper = mount(BasicRadioGroup, { props: { options, modelValue: 2, name: "count" } });
    const radios = wrapper.findAll("input[type=radio]");
    expect(wrapper.attributes("role")).toBe("radiogroup");
    expect(radios.map((r) => r.attributes("name"))).toEqual(["count", "count"]);
    expect(radios[1].element.checked).toBe(true);
    await radios[0].trigger("change");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([1]);
  });

  it("is named by the FormField label and disables every option", () => {
    const wrapper = inField(BasicRadioGroup, { disabled: true }, { options });
    const label = wrapper.find("label.form-field__label");
    expect(wrapper.find("[role=radiogroup]").attributes("aria-labelledby")).toBe(label.attributes("id"));
    expect(wrapper.findAll("input").every((r) => r.attributes("disabled") !== undefined)).toBe(true);
  });

  it("tiles: the option slot draws each tile, the radios stay the choice", async () => {
    const wrapper = mount(BasicRadioGroup, {
      props: { options, modelValue: 1, layout: "tiles" },
      slots: { option: "<template #option='{ option, checked }'><img :alt='option.label' :data-checked='checked' /></template>" },
    });
    expect(wrapper.classes()).toContain("radio-group--tiles");
    expect(wrapper.findAll("img").map((img) => [img.attributes("alt"), img.attributes("data-checked")])).toEqual([
      ["One", "true"],
      ["Two", "false"],
    ]);
    await wrapper.findAll("input[type=radio]")[1].trigger("change");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([2]);
  });
});

describe("BasicSwitch", () => {
  it("is a switch: aria-checked follows v-model, a click emits the opposite", async () => {
    const wrapper = mount(BasicSwitch, { props: { modelValue: false, label: "Aktywny" }, global: GLOBAL });
    const button = wrapper.find("button");
    expect(button.attributes("role")).toBe("switch");
    expect(button.attributes("aria-checked")).toBe("false");
    expect(wrapper.find("label").attributes("for")).toBe(button.attributes("id"));
    await button.trigger("click");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([true]);
  });

  it("does not toggle when disabled", async () => {
    const wrapper = mount(BasicSwitch, { props: { modelValue: true, disabled: true }, global: GLOBAL });
    await wrapper.find("button").trigger("click");
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("shows its hint as the field-hint mark, at its level", () => {
    const wrapper = mount(BasicSwitch, { props: { label: "A", hint: "Hint", hintLevel: "important" }, global: GLOBAL });
    const tip = wrapper.findComponent({ name: "BasicTooltip" });
    expect(tip.attributes("variant")).toBe("help");
    expect(tip.attributes("level")).toBe("important");
  });

  it("inside a FormField the field's label names it", () => {
    const wrapper = inField(BasicSwitch);
    expect(wrapper.find("label.form-field__label").attributes("for")).toBe(wrapper.find("button").attributes("id"));
  });
});

describe("SegmentedControl and ColorInput", () => {
  const options = [
    { label: "Lista", value: "list" },
    { label: "Edycja", value: "edit" },
  ];

  it("SegmentedControl: named by the field, disabled by it, the active option pressed", () => {
    const wrapper = inField(SegmentedControl, { disabled: true }, { options, modelValue: "edit" });
    const group = wrapper.find(".segmented-control");
    expect(group.attributes("aria-labelledby")).toBe(wrapper.find("label").attributes("id"));
    expect(wrapper.findAll("button").map((b) => b.attributes("aria-pressed"))).toEqual(["false", "true"]);
    expect(wrapper.findAll("button").every((b) => b.attributes("disabled") !== undefined)).toBe(true);
  });

  it("ColorInput: the text field reads the contract, disabled reaches the picker too", () => {
    const wrapper = inField(ColorInput, { error: "Bad colour" }, { disabled: true });
    const text = wrapper.find("input[type=text]");
    expect(wrapper.find("label").attributes("for")).toBe(text.attributes("id"));
    expect(text.attributes("aria-invalid")).toBe("true");
    expect(wrapper.find("input[type=color]").attributes("disabled")).toBeDefined();
  });
});

describe("BasicDatePicker", () => {
  const mountPicker = (props = {}) => mount(BasicDatePicker, { props, global: GLOBAL });
  afterEach(() => setLang("EN"));

  it.each([
    ["PL", Polish],
    ["EN", english],
  ])("opens the calendar in the UI language (%s), read at every open", async (lang, locale) => {
    const wrapper = mountPicker();
    setLang(lang);
    await wrapper.find("button").trigger("click");
    expect(flatpickr.mock.calls.at(-1)[1].locale).toBe(locale);
    wrapper.unmount();
  });

  it("mounts its flatpickr instance only while open, destroyed on close and on unmount", async () => {
    flatpickr.mockClear();
    flatpickrInstance.destroy.mockClear();
    const wrapper = mountPicker();
    expect(flatpickr).not.toHaveBeenCalled();
    await wrapper.find("button").trigger("click");
    expect(flatpickr).toHaveBeenCalledTimes(1);
    await wrapper.find("button").trigger("click");
    expect(flatpickrInstance.destroy).toHaveBeenCalledTimes(1);
    await wrapper.find("button").trigger("click");
    wrapper.unmount();
    expect(flatpickrInstance.destroy).toHaveBeenCalledTimes(2);
  });

  it("fixed: placed against the viewport, upward when there is no room below", async () => {
    const wrapper = mount(BasicDatePicker, { props: { fixed: true }, global: GLOBAL, attachTo: document.body });
    const trigger = wrapper.find("button").element;
    trigger.getBoundingClientRect = () => ({ top: window.innerHeight - 40, bottom: window.innerHeight - 8, left: 30 });
    Object.defineProperty(wrapper.find(".picker-wrapper").element, "offsetHeight", { value: 300 });
    await wrapper.find("button").trigger("click");
    await nextTick();
    const style = wrapper.find(".picker-wrapper").element.style;
    expect(style.position).toBe("fixed");
    expect(style.left).toBe("30px");
    expect(style.top).toBe(`${window.innerHeight - 340}px`);
    wrapper.unmount();
  });

  it("fixed: never past the viewport's right edge", async () => {
    const wrapper = mount(BasicDatePicker, { props: { fixed: true }, global: GLOBAL, attachTo: document.body });
    wrapper.find("button").element.getBoundingClientRect = () => ({ top: 10, bottom: 40, left: window.innerWidth - 50 });
    Object.defineProperty(wrapper.find(".picker-wrapper").element, "offsetWidth", { value: 310 });
    await wrapper.find("button").trigger("click");
    await nextTick();
    expect(wrapper.find(".picker-wrapper").element.style.left).toBe(`${window.innerWidth - 310}px`);
    wrapper.unmount();
  });

  it("emits v-model with the picked date", async () => {
    const wrapper = mountPicker();
    await wrapper.find("button").trigger("click");
    const { onChange } = flatpickr.mock.calls.at(-1)[1];
    onChange([], "2026-09-01");
    expect(wrapper.emitted("update:modelValue")).toEqual([["2026-09-01"]]);
    expect(Object.keys(wrapper.emitted())).not.toContain("onChange");
  });

  it("is named by its FormField label", () => {
    const wrapper = inField(BasicDatePicker, { label: "Data" });
    expect(wrapper.find("label").attributes("for")).toBe(wrapper.find("button").attributes("id"));
  });

  it("lets the click reach the document, so other popovers close", async () => {
    const onDocument = vi.fn();
    document.addEventListener("click", onDocument);
    const wrapper = mount(BasicDatePicker, { global: GLOBAL, attachTo: document.body });
    await wrapper.find("button").trigger("click");
    expect(onDocument).toHaveBeenCalled();
    expect(wrapper.find(".picker-wrapper").isVisible()).toBe(true);
    document.removeEventListener("click", onDocument);
    wrapper.unmount();
  });

  it("shows the value on an input-like trigger with the calendar icon", () => {
    expect(mountPicker({ modelValue: "2026-09-01" }).find("button").text()).toBe("2026-09-01");
    const empty = mountPicker();
    expect(empty.find("button").text()).toBe("routes.set_new");
    expect(iconOf(empty)).toBe(ICONS.calendar);
  });

  it("a disabled trigger does not open", async () => {
    const wrapper = mountPicker({ disabled: true });
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
  });

  it("follows an outside model change", async () => {
    flatpickrInstance.setDate.mockClear();
    const model = ref("2026-01-01");
    const Host = defineComponent({ render: () => h(BasicDatePicker, { modelValue: model.value }) });
    const wrapper = mount(Host, { global: GLOBAL });
    await wrapper.find("button").trigger("click");
    model.value = "2026-02-02";
    await new Promise((resolve) => setTimeout(resolve));
    expect(flatpickrInstance.setDate).toHaveBeenCalledWith("2026-02-02", false);
  });
});

describe("BasicWysiwyg", () => {
  // The ProseMirror editable node is mounted async (EditorContent moves the DOM in on nextTick).
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it("stands alone outside a FormField: own id, nothing described or labelled", async () => {
    const wrapper = mount(BasicWysiwyg, { global: GLOBAL });
    await settle();
    const editable = wrapper.find(".ProseMirror");
    expect(editable.attributes("id")).toBeTruthy();
    expect(editable.attributes("aria-describedby")).toBeUndefined();
    expect(editable.attributes("aria-labelledby")).toBeUndefined();
  });

  it("reads the FormField contract: the editable node carries the field's id, label and hint", async () => {
    const wrapper = inField(BasicWysiwyg, { label: "Body", hint: "Shown in the store" });
    await settle();
    const editable = wrapper.find(".ProseMirror");
    const label = wrapper.find("label.form-field__label");
    const tip = wrapper.findComponent({ name: "BasicTooltip" });
    expect(editable.attributes("id")).toBe(label.attributes("for"));
    expect(editable.attributes("aria-labelledby")).toBe(label.attributes("id"));
    expect(editable.attributes("aria-describedby")).toBe(tip.props("tipId"));
  });

  it("describes with the error instead of the hint once one appears", async () => {
    const wrapper = inField(BasicWysiwyg, { label: "Body", hint: "Hint", error: "Required" });
    await settle();
    const error = wrapper.find(".form-field__error");
    expect(wrapper.find(".ProseMirror").attributes("aria-describedby")).toBe(error.attributes("id"));
  });
});

describe("Studio extensions (FormField label slot, SegmentedControl option, BasicTextarea autogrow)", () => {
  it("a label slot names the control with the caller's markup, without the caps field label", () => {
    const Host = defineComponent({
      render: () => h(FormField, {}, { label: () => h("span", { class: "q" }, "Since when?"), default: () => h(BasicTextarea) }),
    });
    const wrapper = mount(Host, { global: GLOBAL });
    const label = wrapper.find("label");
    expect(label.find(".q").text()).toBe("Since when?");
    expect(label.classes()).not.toContain("field-label");
    expect(label.attributes("for")).toBe(wrapper.find("textarea").attributes("id"));
  });

  it("an option of a segmented control can be taken out alone", () => {
    const options = [{ label: "Main", value: "a" }, { label: "Skip", value: "b", disabled: true }];
    const wrapper = mount(SegmentedControl, { props: { options, modelValue: "a" }, global: GLOBAL });
    const buttons = wrapper.findAll("button");
    expect(buttons[0].attributes("disabled")).toBeUndefined();
    expect(buttons[1].attributes("disabled")).toBeDefined();
  });

  it("an autogrow textarea takes the height of its text", async () => {
    const wrapper = mount(BasicTextarea, { props: { autogrow: true, modelValue: "a" }, global: GLOBAL, attachTo: document.body });
    const field = wrapper.find("textarea").element;
    Object.defineProperty(field, "scrollHeight", { configurable: true, value: 120 });
    await wrapper.setProps({ modelValue: "a\nb\nc" });
    await nextTick();
    expect(field.style.height).toBe("120px");
    wrapper.unmount();
  });
});
