import { describe, it, expect, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import AttributeField from "@/views/Pim/components/AttributeField.vue";
import BasicSelect from "@/boots/BasicSelect/index.vue";

// The real BasicSelect: the load-more row and the query live inside it, a stub would prove nothing.
const PAGE = Array.from({ length: 100 }, (_, i) => ({ label: `Value ${i}`, value: `v${i}` }));
const SlotStub = { template: "<div><slot /></div>" };
const settle = async () => {
  await nextTick();
  await nextTick();
};
const control = () => document.querySelector('button[role="combobox"]');
const search = () => document.querySelector('input[type="search"]');
const labels = () => [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim());
const moreRow = () => document.querySelector('[role="option"][data-action="more"]');

describe("AttributeField — a select with more values than the loaded page", () => {
  const wrappers = [];
  const mountField = (featureType, row = {}) => {
    const wrapper = mount(AttributeField, {
      props: {
        row: { feature_idx: "colour", feature_type: featureType, attribute_idx: null, attribute_idxs: [], ...row },
        options: PAGE,
        language: "en",
        hasMore: true,
      },
      global: { components: { BasicSelect }, stubs: { FormField: SlotStub, RouterLink: true, IconButton: true } },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const open = async () => {
    control().click();
    await settle();
  };
  const type = async (text) => {
    search().value = text;
    search().dispatchEvent(new Event("input"));
    await settle();
  };

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("a typed query asks for the values beyond the page and keeps the load-more row", async () => {
    const wrapper = mountField(7);
    await open();
    await type("Value 250");

    expect(wrapper.emitted("search")).toHaveLength(1);
    expect(moreRow()).not.toBeNull();
    expect(labels()).toHaveLength(1);
  });

  it("a query that matches a loaded value shows it above the load-more row", async () => {
    mountField(7);
    await open();
    await type("value 42");

    expect(labels().slice(0, -1)).toEqual(["Value 42"]);
    expect(moreRow()).not.toBeNull();
  });

  it("the value that arrives with the next pages is found by the query already typed", async () => {
    const wrapper = mountField(7);
    await open();
    await type("Value 250");
    await wrapper.setProps({ options: [...PAGE, { label: "Value 250", value: "v250" }], hasMore: false });
    await settle();

    expect(labels()).toEqual(["Value 250"]);
  });

  it("a single select loads the next page without closing and without picking a value", async () => {
    const wrapper = mountField(7);
    await open();
    moreRow().click();
    await settle();

    expect(wrapper.emitted("load-more")).toHaveLength(1);
    expect(wrapper.emitted("update")).toBeUndefined();
    expect(control().getAttribute("aria-expanded")).toBe("true");
  });

  it("Enter on the load-more row loads the next page into the same open list, which keeps its place", async () => {
    const wrapper = mountField(7);
    await open();
    const list = document.querySelector('[role="listbox"]');
    list.scrollTop = 4000;
    // Up from the first option wraps to the last row, the load-more one.
    search().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await settle();
    expect(search().getAttribute("aria-activedescendant")).toBe(moreRow().id);
    search().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle();
    expect(wrapper.emitted("load-more")).toHaveLength(1);
    expect(wrapper.emitted("update")).toBeUndefined();

    await wrapper.setProps({ options: [...PAGE, { label: "Value 100", value: "v100" }] });
    await settle();
    expect(document.querySelector('[role="listbox"]')).toBe(list);
    expect(list.scrollTop).toBe(4000);
    expect(labels().at(-2)).toBe("Value 100");
  });

  it("a multiselect loads the next page without touching the picked list", async () => {
    const wrapper = mountField(8, { attribute_idxs: ["v1"] });
    await open();
    moreRow().click();
    await settle();

    expect(wrapper.emitted("load-more")).toHaveLength(1);
    expect(wrapper.emitted("update")).toBeUndefined();
    expect(control().getAttribute("aria-expanded")).toBe("true");
  });

  it("picking a value still writes it and closes the single select", async () => {
    const wrapper = mountField(7);
    await open();
    document.querySelector('[role="option"]').click();
    await settle();

    expect(wrapper.emitted("update")).toEqual([["attribute_idx", "v0"]]);
    expect(control().getAttribute("aria-expanded")).toBe("false");
  });
});
