import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RequiredOverrideControl from "@/views/Pim/components/RequiredOverrideControl.vue";
import SegmentedControl from "@/boots/SegmentedControl/index.vue";

const mountControl = (props) =>
  mount(RequiredOverrideControl, { props, global: { components: { SegmentedControl } } });

describe("RequiredOverrideControl", () => {
  it("null override reads as Inherit and shows the feature default", () => {
    const w = mountControl({ modelValue: null, featureRequired: true, name: "Name" });
    const buttons = w.findAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].attributes("aria-pressed")).toBe("true");
    expect(buttons[0].text()).toBe("Inherit (Required)");
  });

  it("Required emits true, Optional emits false, Inherit emits null", async () => {
    const w = mountControl({ modelValue: null, name: "Name" });
    await w.find('[data-testid="required-required"]').trigger("click");
    await w.find('[data-testid="required-optional"]').trigger("click");
    await w.find('[data-testid="required-inherit"]').trigger("click");
    expect(w.emitted("update:modelValue")).toEqual([[true], [false], [null]]);
  });

  it("a system feature is disabled", () => {
    const w = mountControl({ modelValue: true, disabled: true, name: "Name" });
    expect(w.findAll("button").every((b) => b.attributes("disabled") !== undefined)).toBe(true);
    expect(w.findAll("button")[1].attributes("aria-pressed")).toBe("true");
  });
});
