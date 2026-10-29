import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import Pagination from "@/boots/Pagination/index.vue";

describe("Pagination v-model:page", () => {
  it("renders nothing for a single page", () => {
    const wrapper = mount(Pagination, { props: { page: 1, pages: 1 } });
    expect(wrapper.find("nav.pagination").exists()).toBe(false);
  });

  it("renders the page cells from two pages on", () => {
    const wrapper = mount(Pagination, { props: { page: 1, pages: 2 } });
    expect(wrapper.find("nav.pagination").exists()).toBe(true);
    expect(wrapper.find('[aria-current="page"]').text()).toBe("1");
  });

  it("renders page / pages and emits update:page only", async () => {
    const wrapper = mount(Pagination, { props: { page: 3, pages: 5 } });
    expect(wrapper.find('[aria-current="page"]').text()).toBe("3");
    await wrapper.find('[aria-label="next page"]').trigger("click");
    await wrapper.find('[aria-label="previous page"]').trigger("click");
    expect(wrapper.emitted("update:page")).toEqual([[4], [2]]);
    expect(Object.keys(wrapper.emitted())).not.toContain("onChangePage");
  });

  it("disables the arrows at the ends and folds many pages into an ellipsis", () => {
    const first = mount(Pagination, { props: { page: 1, pages: 40 } });
    expect(first.find('[aria-label="previous page"]').attributes("disabled")).toBeDefined();
    expect(first.findAll(".page-cell--gap")).toHaveLength(1);
    const middle = mount(Pagination, { props: { page: 20, pages: 40 } });
    expect(middle.findAll(".page-cell--gap")).toHaveLength(2);
    const last = mount(Pagination, { props: { page: 40, pages: 40 } });
    expect(last.find('[aria-label="next page"]').attributes("disabled")).toBeDefined();
  });
});
