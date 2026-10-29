import { describe, it, expect, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";

import EntitySearchPicker from "@/boots/EntitySearchPicker/index.vue";
import ChannelMultiSelect from "@/boots/ChannelMultiSelect/index.vue";
import Tag from "@/boots/Tag/index.vue";
import { t } from "@/i18n";

const RESULTS = [
  { label: "Buty trekkingowe", value: "sku-1", secondary: "SKU-1" },
  { label: "Skarpety", value: "sku-2", secondary: "SKU-2" },
];
const CHANNELS = [{ idx: "pl", name: "Polska" }, { idx: "de", name: "Niemcy" }, { idx: "cz" }];
const key = (target, name) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
const settle = async () => {
  await flushPromises();
  await nextTick();
};
const options = () => [...document.querySelectorAll('[role="option"]')];
const trigger = () => document.querySelector(".basic-menu__trigger button");

describe("EntitySearchPicker", () => {
  const wrappers = [];
  const mountPicker = (props = {}) => {
    const wrapper = mount(EntitySearchPicker, {
      props: { fetchFn: vi.fn(async () => RESULTS), modelValue: null, placeholder: "Szukaj produktu", ...props },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const search = () => document.querySelector('input[type="search"]');

  afterEach(() => {
    vi.useRealTimers();
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("opens the search in BasicMenu's panel, fetches and lists the results as options", async () => {
    const wrapper = mountPicker();
    await settle();
    expect(trigger().getAttribute("role")).toBe("combobox");
    expect(trigger().textContent).toContain("Szukaj produktu");
    trigger().click();
    await settle();
    expect(wrapper.props("fetchFn")).toHaveBeenCalledWith("");
    expect(document.activeElement).toBe(search());
    expect(options().map((o) => o.textContent.replace(/\s+/g, ""))).toEqual([
      "ButytrekkingoweSKU-1",
      "SkarpetySKU-2",
    ]);
  });

  it("keyboard on the filter input: ArrowDown + Enter pick the value and its label, then close", async () => {
    const wrapper = mountPicker();
    trigger().click();
    await settle();
    key(search(), "ArrowDown");
    await nextTick();
    expect(search().getAttribute("aria-activedescendant")).toBe(options()[1].id);
    key(search(), "Enter");
    await settle();
    expect(wrapper.emitted("update:modelValue")).toEqual([["sku-2"]]);
    expect(wrapper.emitted("update:displayValue")).toEqual([["Skarpety"]]);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("typing debounces the fetch; no results says so", async () => {
    const fetchFn = vi.fn(async (q) => (q ? [] : RESULTS));
    mountPicker({ fetchFn });
    trigger().click();
    await settle();
    vi.useFakeTimers();
    search().value = "xyz";
    search().dispatchEvent(new Event("input"));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await settle();
    expect(fetchFn).toHaveBeenLastCalledWith("xyz");
    expect(document.querySelector('[role="status"]').textContent).toContain("entity_picker.no_results");
  });

  it("clientFilter filters the fetched list here, by label, secondary or value", async () => {
    const fetchFn = vi.fn(async () => RESULTS);
    mountPicker({ fetchFn, clientFilter: true });
    trigger().click();
    await settle();
    search().value = "sku-2";
    search().dispatchEvent(new Event("input"));
    await settle();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(options()).toHaveLength(1);
  });

  it("a chosen value shows as a removable Tag; remove clears both models and emits clear", async () => {
    const wrapper = mountPicker({ modelValue: "sku-1", displayValue: "Buty trekkingowe" });
    await settle();
    const tag = wrapper.findComponent(Tag);
    expect(tag.props()).toMatchObject({ label: "Buty trekkingowe", removable: true, to: null });
    tag.vm.$emit("remove");
    expect(wrapper.emitted("update:modelValue")).toEqual([[null]]);
    expect(wrapper.emitted("update:displayValue")).toEqual([[""]]);
    expect(wrapper.emitted("clear")).toHaveLength(1);
  });

  it("disabled disables the control", async () => {
    const wrapper = mountPicker({ disabled: true });
    await settle();
    expect(wrapper.find('[role="combobox"], button').attributes("disabled")).toBeDefined();
  });

  it("manual: a text field for the value, no search", async () => {
    const wrapper = mountPicker({ modelValue: "cat-1", manual: true });
    await settle();
    const input = wrapper.find('input[type="text"]');
    expect(input.element.value).toBe("cat-1");
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false);
    await input.setValue("cat-2");
    expect(wrapper.emitted("update:modelValue")).toEqual([["cat-2"]]);
  });

  it("a slower earlier search never overwrites the newer results", async () => {
    let releaseFirst;
    const fetchFn = vi.fn((q) => (q ? Promise.resolve([RESULTS[1]]) : new Promise((r) => (releaseFirst = r))));
    mountPicker({ fetchFn });
    trigger().click();
    await settle();
    vi.useFakeTimers();
    search().value = "ska";
    search().dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await settle();
    releaseFirst(RESULTS);
    await settle();
    expect(options()).toHaveLength(1);
  });
});

describe("ChannelMultiSelect", () => {
  const wrappers = [];
  const mountChip = (props = {}) => {
    const wrapper = mount(ChannelMultiSelect, {
      props: { channels: CHANNELS, modelValue: [], label: "Kanały", allLabel: "Wszystkie", ...props },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("chip: „Kanały: Wszystkie”, „Kanały: 2” with two picked, „Kanały” when compact", async () => {
    const wrapper = mountChip();
    expect(wrapper.find(".channel-select__full").text()).toBe("Kanały: Wszystkie");
    await wrapper.setProps({ modelValue: ["pl", "de"] });
    expect(wrapper.find(".channel-select__full").text()).toBe("Kanały: 2");
    expect(trigger().getAttribute("aria-label")).toBe("Kanały: 2");
    await wrapper.setProps({ compact: true });
    expect(wrapper.find(".channel-select__full").exists()).toBe(false);
    expect(wrapper.find(".channel-select__short").text()).toBe("Kanały");
  });

  // Operator request 2026-09-29 (plan 53): the floating label names the chip, empty or chosen.
  it("floatingLabel: the label while empty, then the channel name with the label above it", async () => {
    const wrapper = mountChip({ floatingLabel: "Kanał sklepu" });
    expect(trigger().textContent.trim()).toBe("Kanał sklepu");
    expect(trigger().getAttribute("aria-label")).toBe("Kanał sklepu");
    expect(wrapper.find(".channel-select__floating").exists()).toBe(false);
    await wrapper.setProps({ modelValue: ["de"] });
    expect(trigger().textContent.trim()).toBe("Niemcy");
    expect(wrapper.get(".channel-select__floating").text()).toBe("Kanał sklepu");
    expect(trigger().getAttribute("aria-label")).toBe("Kanał sklepu: Niemcy");
  });

  it("floatingLabel with several channels: the label above, the count as the value", async () => {
    const wrapper = mountChip({ floatingLabel: "Kanał sklepu", modelValue: ["pl", "de"] });
    expect(wrapper.get(".channel-select__floating").text()).toBe("Kanał sklepu");
    expect(trigger().textContent.trim()).toBe(t("select.selected_count", { count: 2 }));
  });

  it("with no channel chosen it opens on the first channel", async () => {
    mountChip({ modelValue: [] });
    trigger().click();
    await settle();
    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox.getAttribute("aria-activedescendant")).toBe(options()[0].id);
  });

  it("the list is a multi-select listbox in BasicMenu's panel; click and Space toggle a channel", async () => {
    const wrapper = mountChip({ modelValue: ["de"] });
    trigger().click();
    await settle();
    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
    expect(options().map((o) => o.textContent.trim())).toEqual(["Polska", "Niemcy", "cz"]);
    expect(options()[1].getAttribute("aria-selected")).toBe("true");
    options()[0].click();
    expect(wrapper.emitted("update:modelValue")).toEqual([[["de", "pl"]]]);
    key(listbox, " ");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([[]]);
  });
});
