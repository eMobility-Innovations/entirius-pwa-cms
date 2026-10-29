import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import FilterChip from "@/boots/FilterChip/index.vue";
import MobileFilterPanel from "@/boots/MobileFilterPanel/index.vue";
import CountBadge from "@/boots/CountBadge/index.vue";

describe("FilterChip count", () => {
  it("shows its count as a CountBadge, none without a count", () => {
    const chip = mount(FilterChip, { props: { label: "Szkice", count: 12, active: true } });
    expect(chip.findComponent(CountBadge).text()).toBe("12");
    expect(chip.classes()).toContain("filter-chip--active");
    expect(mount(FilterChip, { props: { label: "Wszystkie" } }).findComponent(CountBadge).exists()).toBe(false);
  });
});

describe("MobileFilterPanel trigger", () => {
  const panel = (activeCount) =>
    mount(MobileFilterPanel, { props: { activeCount, triggerLabel: "Filtry" }, slots: { default: "<i>f</i>" } });

  it("is a filter IconButton named by triggerLabel with the active count", async () => {
    const wrapper = panel(2);
    const trigger = wrapper.find(".mobile-filter-panel__trigger button");
    expect(trigger.attributes("aria-label")).toBe("Filtry");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(wrapper.findComponent(CountBadge).text()).toBe("2");
    await trigger.trigger("click");
    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(wrapper.find(".mobile-filter-panel__dropdown").exists()).toBe(true);
  });

  it("shows no count while no filter is active", () => {
    expect(panel(0).findComponent(CountBadge).exists()).toBe(false);
  });
});
