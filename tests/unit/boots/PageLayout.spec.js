/**
 * plan-33 review item — PageLayout's footer strip renders only when the footer slot has real content: a slot
 * whose only vnode is a v-if's Comment placeholder (e.g. `<Pagination v-if="pages > 1" />` on one page) leaves
 * no strip.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import PageLayout from "@/boots/PageLayout/index.vue";

describe("PageLayout footer", () => {
  it("hides the footer strip when the slot renders nothing (v-if false)", () => {
    const wrapper = mount(PageLayout, {
      slots: { footer: `<div v-if="false" class="pager" />` },
    });
    expect(wrapper.find(".page-layout__footer").exists()).toBe(false);
  });

  it("shows the footer strip when the slot renders something", () => {
    const wrapper = mount(PageLayout, {
      slots: { footer: `<div v-if="true" class="pager" />` },
    });
    expect(wrapper.find(".page-layout__footer").exists()).toBe(true);
    expect(wrapper.find(".pager").exists()).toBe(true);
  });

  it("has no footer strip when the footer slot is not used", () => {
    const wrapper = mount(PageLayout);
    expect(wrapper.find(".page-layout__footer").exists()).toBe(false);
  });

  it("shows the footer strip when a dynamic footer slot appears after the first render", async () => {
    // Lists pass `<template v-if="totalCount > pageSize" #footer>`: the slot exists only once the data arrived.
    const Host = defineComponent({
      components: { PageLayout },
      setup: () => ({ paged: ref(false) }),
      template: `<PageLayout><template v-if="paged" #footer><div class="pager" /></template></PageLayout>`,
    });
    const wrapper = mount(Host);
    expect(wrapper.find(".page-layout__footer").exists()).toBe(false);
    wrapper.vm.paged = true;
    await nextTick();
    expect(wrapper.find(".page-layout__footer").exists()).toBe(true);
    wrapper.vm.paged = false;
    await nextTick();
    expect(wrapper.find(".page-layout__footer").exists()).toBe(false);
  });
});
