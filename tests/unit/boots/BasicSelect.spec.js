import { describe, it, expect, afterEach } from "vitest";
import { defineComponent, h, nextTick, provide, ref } from "vue";
import { mount } from "@vue/test-utils";

import BasicSelect from "@/boots/BasicSelect/index.vue";
import { FORM_FIELD } from "@/composables/formField";
import { t } from "@/i18n";

const OPTIONS = [
  { label: "Polski", value: "pl" },
  { label: "English", value: "en", description: "Wersja międzynarodowa" },
  { label: "Deutsch", value: "de", disabled: true },
  { label: "Čeština", value: "cs" },
];
const key = (target, name) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
const settle = async () => {
  await nextTick();
  await nextTick();
};

describe("BasicSelect", () => {
  const wrappers = [];
  const mountSelect = (props = {}, attrs = {}) => {
    const wrapper = mount(BasicSelect, {
      props: { options: OPTIONS, modelValue: null, ...props },
      attrs,
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const control = () => document.querySelector('[role="combobox"]');
  const listbox = () => document.querySelector('[role="listbox"]');
  const options = () => [...document.querySelectorAll('[role="option"]')];
  const open = async () => {
    control().click();
    await settle();
  };
  const emitted = (wrapper) => wrapper.emitted("update:modelValue")?.map(([value]) => value) ?? [];

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("closed: a combobox button with the placeholder, then the chosen label", async () => {
    const wrapper = mountSelect({ placeholder: "Wybierz język" });
    await settle();
    expect(control().tagName).toBe("BUTTON");
    expect(control().textContent.trim()).toBe("Wybierz język");
    expect(control().getAttribute("aria-expanded")).toBe("false");
    await wrapper.setProps({ modelValue: "en" });
    expect(control().textContent.trim()).toBe("English");
  });

  it("opens a listbox with options, descriptions and aria-selected; focus moves to the list", async () => {
    mountSelect({ modelValue: "en" });
    await open();
    expect(control().getAttribute("aria-expanded")).toBe("true");
    expect(options().map((o) => o.querySelector(".option-list__label").textContent)).toEqual([
      "Polski",
      "English",
      "Deutsch",
      "Čeština",
    ]);
    expect(options()[1].textContent).toContain("Wersja międzynarodowa");
    expect(options()[1].getAttribute("aria-selected")).toBe("true");
    expect(options()[2].getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(listbox());
    expect(listbox().getAttribute("aria-activedescendant")).toBe(options()[1].id);
  });

  it("with nothing chosen it opens on the first enabled option", async () => {
    mountSelect();
    await open();
    expect(listbox().getAttribute("aria-activedescendant")).toBe(options()[0].id);
  });

  it("single: a click emits the value and closes, focus back on the control", async () => {
    const wrapper = mountSelect();
    await open();
    options()[3].click();
    await settle();
    expect(emitted(wrapper)).toEqual(["cs"]);
    expect(control().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(control());
  });

  it("keyboard: arrows skip the disabled option and wrap, Home / End jump, Enter chooses", async () => {
    const wrapper = mountSelect();
    await open();
    const active = () => listbox().getAttribute("aria-activedescendant");
    expect(active()).toBe(options()[0].id);
    key(listbox(), "ArrowDown");
    await nextTick();
    expect(active()).toBe(options()[1].id);
    key(listbox(), "ArrowDown");
    await nextTick();
    expect(active()).toBe(options()[3].id);
    key(listbox(), "ArrowDown");
    await nextTick();
    expect(active()).toBe(options()[0].id);
    key(listbox(), "End");
    await nextTick();
    expect(active()).toBe(options()[3].id);
    key(listbox(), "Home");
    key(listbox(), "Enter");
    await settle();
    expect(emitted(wrapper)).toEqual(["pl"]);
  });

  it("type-ahead moves to the first enabled option starting with the typed letters", async () => {
    mountSelect();
    await open();
    key(listbox(), "e");
    await nextTick();
    expect(listbox().getAttribute("aria-activedescendant")).toBe(options()[1].id);
    key(listbox(), "d");
    await nextTick();
    expect(listbox().getAttribute("aria-activedescendant")).toBe(options()[1].id);
  });

  it("Esc closes and returns focus; ArrowDown on the closed control opens", async () => {
    mountSelect();
    await open();
    key(listbox(), "Escape");
    await settle();
    expect(control().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(control());
    key(control(), "ArrowDown");
    await settle();
    expect(control().getAttribute("aria-expanded")).toBe("true");
  });

  it("multiple: toggles values in the array, stays open, shows checkboxes and the count", async () => {
    const wrapper = mountSelect({ multiple: true, modelValue: ["pl"] });
    await open();
    expect(listbox().getAttribute("aria-multiselectable")).toBe("true");
    expect(document.querySelectorAll(".option-list__box")).toHaveLength(4);
    options()[1].click();
    await settle();
    expect(emitted(wrapper)).toEqual([["pl", "en"]]);
    expect(control().getAttribute("aria-expanded")).toBe("true");
    await wrapper.setProps({ modelValue: ["pl", "en", "cs"] });
    expect(control().textContent.trim()).toBe("3 selected");
    options()[0].click();
    expect(emitted(wrapper).at(-1)).toEqual(["en", "cs"]);
  });

  it("searchable: the filter input keeps focus, filters the list and drives the active option", async () => {
    const wrapper = mountSelect({ searchable: true });
    await open();
    const input = document.querySelector('input[type="search"]');
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-controls")).toBe(listbox().id);
    input.value = "ch";
    input.dispatchEvent(new Event("input"));
    await settle();
    expect(options().map((o) => o.querySelector(".option-list__label").textContent)).toEqual(["Deutsch"]);
    input.value = "zzz";
    input.dispatchEvent(new Event("input"));
    await settle();
    expect(document.body.textContent).toContain("select.no_results");
    input.value = "po";
    input.dispatchEvent(new Event("input"));
    await settle();
    expect(input.getAttribute("aria-activedescendant")).toBe(options()[0].id);
    key(input, "Enter");
    await settle();
    expect(emitted(wrapper)).toEqual(["pl"]);
  });

  it("moreLabel: an action row that no query hides; Enter on it emits more, keeps the menu open, picks nothing", async () => {
    const wrapper = mountSelect({ searchable: true, moreLabel: "Load more" });
    await open();
    const input = document.querySelector('input[type="search"]');
    input.value = "zzz";
    input.dispatchEvent(new Event("input"));
    await settle();
    expect(wrapper.emitted("search").at(-1)).toEqual(["zzz"]);
    expect(document.body.textContent).toContain("select.no_results");
    const row = options()[0];
    expect(row.dataset.action).toBe("more");
    expect(row.hasAttribute("aria-selected")).toBe(false);
    key(input, "Enter");
    await settle();
    expect(wrapper.emitted("more")).toHaveLength(1);
    expect(emitted(wrapper)).toEqual([]);
    expect(control().getAttribute("aria-expanded")).toBe("true");
  });

  it("clearable: a clear button while a value is chosen emits null (an empty array when multiple)", async () => {
    const wrapper = mountSelect({ clearable: true, modelValue: "pl" });
    await settle();
    wrapper.find(".basic-select__clear").trigger("click");
    expect(emitted(wrapper)).toEqual([null]);
    await wrapper.setProps({ modelValue: null });
    expect(wrapper.find(".basic-select__clear").exists()).toBe(false);
  });

  it("Enter never chooses a disabled option; Space on a single select chooses on keyup", async () => {
    const wrapper = mountSelect({ modelValue: "de" });
    await open();
    key(listbox(), "Enter");
    await settle();
    expect(emitted(wrapper)).toEqual([]);
    key(listbox(), "ArrowDown");
    key(listbox(), " ");
    await settle();
    expect(emitted(wrapper)).toEqual([]);
    listbox().dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
    await settle();
    expect(emitted(wrapper)).toEqual(["pl"]);
  });

  it("closed: holds no option, so no hidden copy of the labels sits in the page", async () => {
    mountSelect({ modelValue: "en" });
    await settle();
    expect(options()).toHaveLength(0);
    await open();
    expect(options().length).toBeGreaterThan(0);
  });

  it("searchable: reopening points at the chosen option again, not the first", async () => {
    mountSelect({ searchable: true, modelValue: "en" });
    await open();
    const input = document.querySelector('input[type="search"]');
    input.value = "po";
    input.dispatchEvent(new Event("input"));
    await settle();
    key(input, "Escape");
    await settle();
    await open();
    const reopened = document.querySelector('input[type="search"]');
    expect(reopened.getAttribute("aria-activedescendant")).toBe(options()[1].id);
  });

  it("a control that mounts disabled gets its ARIA state once enabled", async () => {
    const wrapper = mountSelect({ disabled: true });
    await settle();
    await wrapper.setProps({ disabled: false });
    await settle();
    expect(control().getAttribute("aria-expanded")).toBe("false");
    expect(control().getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("disabled: the control is disabled and does not open", async () => {
    mountSelect({ disabled: true });
    await settle();
    expect(control().disabled).toBe(true);
    control().click();
    await settle();
    expect(document.querySelector(".basic-menu__popover").style.display).toBe("none");
  });

  it("aria-label / aria-labelledby land on the control, other attributes on the root", async () => {
    const wrapper = mountSelect({}, { "aria-labelledby": "channel-label", "data-testid": "channel-select" });
    await settle();
    expect(control().getAttribute("aria-labelledby")).toBe("channel-label");
    expect(wrapper.attributes("data-testid")).toBe("channel-select");
    expect(wrapper.attributes("aria-labelledby")).toBeUndefined();
  });

  // Operator request 2026-09-29 (plan 53): a select without a FormField label keeps its name in sight.
  it("floatingLabel: the placeholder while empty, a mini label above the chosen value, the accessible name", async () => {
    const wrapper = mountSelect({ floatingLabel: "Etap", placeholder: "Wybierz" });
    await settle();
    expect(control().textContent.trim()).toBe("Etap");
    expect(control().getAttribute("aria-label")).toBe("Etap");
    expect(wrapper.find(".basic-select__floating").exists()).toBe(false);
    await wrapper.setProps({ modelValue: "en" });
    expect(control().textContent.trim()).toBe("English");
    expect(wrapper.get(".basic-select__floating").text()).toBe("Etap");
    expect(control().getAttribute("aria-label")).toBe("Etap");
  });

  it("floatingLabel with several values: the label above, the count as the value", async () => {
    const wrapper = mountSelect({ floatingLabel: "Języki", multiple: true, modelValue: ["pl", "cs"] });
    await settle();
    expect(wrapper.get(".basic-select__floating").text()).toBe("Języki");
    expect(control().textContent.trim()).toBe(t("select.selected_count", { count: 2 }));
  });

  it("form-field contract: takes the field's id, description, invalid, required and disabled", async () => {
    const field = {
      id: ref("field-lang"),
      describedBy: ref("field-lang-error"),
      invalid: ref(true),
      required: ref(true),
      disabled: ref(false),
    };
    const Host = defineComponent({
      setup() {
        provide(FORM_FIELD, field);
        return () => h(BasicSelect, { options: OPTIONS, modelValue: null });
      },
    });
    wrappers.push(mount(Host, { attachTo: document.body }));
    await settle();
    expect(control().id).toBe("field-lang");
    expect(control().getAttribute("aria-describedby")).toBe("field-lang-error");
    expect(control().getAttribute("aria-invalid")).toBe("true");
    expect(control().getAttribute("aria-required")).toBe("true");
    field.disabled.value = true;
    await nextTick();
    expect(control().disabled).toBe(true);
  });

  // Plan 61e: a caller's `aria-describedby` (a note under the select) joins the field's description.
  it("form-field contract: a caller's aria-describedby joins the field's description", async () => {
    const Host = defineComponent({
      setup() {
        provide(FORM_FIELD, { id: ref("f"), describedBy: ref("f-error"), invalid: ref(true), required: ref(false), disabled: ref(false) });
        return () => h(BasicSelect, { options: OPTIONS, modelValue: null, "aria-describedby": "note" });
      },
    });
    wrappers.push(mount(Host, { attachTo: document.body }));
    await settle();
    expect(control().getAttribute("aria-describedby")).toBe("f-error note");
  });
});
