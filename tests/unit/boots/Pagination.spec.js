import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import Pagination from "@/boots/Pagination/index.vue";

// Plan 56b: a list that is loading disables its pager, so a click is refused visibly instead of dropped.
describe("Pagination", () => {
  it("disabled: every cell is disabled and no page is taken", async () => {
    const wrapper = mount(Pagination, { props: { page: 3, pages: 5, disabled: true } });
    const buttons = wrapper.findAll("button");
    expect(buttons.every((button) => button.attributes("disabled") !== undefined)).toBe(true);
    await buttons[1].trigger("click");
    expect(wrapper.emitted("update:page")).toBeUndefined();
  });

  it("enabled: a page cell takes its page, the arrows follow the ends", async () => {
    const wrapper = mount(Pagination, { props: { page: 1, pages: 5 } });
    const buttons = wrapper.findAll("button");
    expect(buttons[0].attributes("disabled")).toBeDefined();
    expect(buttons.at(-1).attributes("disabled")).toBeUndefined();
    await buttons[2].trigger("click");
    expect(wrapper.emitted("update:page")).toEqual([[2]]);
  });
});
