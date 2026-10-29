import { describe, it, expect } from "vitest";
import { defineComponent, h, provide, ref } from "vue";
import { mount } from "@vue/test-utils";
import { FORM_FIELD, useFormFieldControl } from "@/composables/formField";
import { READONLY, ReadonlyOff } from "@/composables/useReadonly";

function mountControl(provided, readonly = null) {
  let control;
  const Control = defineComponent({
    setup() {
      control = useFormFieldControl();
      return () => h("input");
    },
  });
  const Field = defineComponent({
    setup() {
      if (provided) provide(FORM_FIELD, provided);
      if (readonly) provide(READONLY, readonly);
      return () => h(Control);
    },
  });
  mount(Field);
  return control;
}

describe("useFormFieldControl", () => {
  it("stands alone outside a FormField: a generated id, nothing else set", () => {
    const control = mountControl(null);
    expect(control.id.value).toMatch(/\S/);
    expect(control.describedBy.value).toBe("");
    expect(control.invalid.value).toBe(false);
    expect(control.required.value).toBe(false);
    expect(control.disabled.value).toBe(false);
  });

  // FIX-09 #7: a switch or a select that saves on change, outside any FormField, is still a write control.
  it("outside a FormField follows the page's read-only mode", () => {
    const readonly = ref(true);
    const control = mountControl(null, readonly);
    expect(control.disabled.value).toBe(true);
    readonly.value = false;
    expect(control.disabled.value).toBe(false);
  });

  it("stays enabled in a ReadonlyOff region of a read-only page (a filter, a picker)", () => {
    let control;
    const Control = defineComponent({
      setup() {
        control = useFormFieldControl();
        return () => h("input");
      },
    });
    const Page = defineComponent({
      setup() {
        provide(READONLY, ref(true));
        return () => h(ReadonlyOff, null, { default: () => h(Control) });
      },
    });
    mount(Page);
    expect(control.disabled.value).toBe(false);
  });

  it("gives two standalone controls different ids", () => {
    let first;
    const Control = defineComponent({
      setup() {
        const control = useFormFieldControl();
        first ??= control;
        return () => h("input", { id: control.id.value });
      },
    });
    const wrapper = mount(defineComponent({ setup: () => () => h("div", [h(Control), h(Control)]) }));
    const ids = wrapper.findAll("input").map((input) => input.attributes("id"));
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(first.id.value);
  });

  it("returns what the nearest FormField provides", () => {
    const provided = {
      id: ref("price"),
      describedBy: ref("price-error"),
      invalid: ref(true),
      required: ref(true),
      disabled: ref(false),
    };
    expect(mountControl(provided)).toBe(provided);
  });
});
