import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetFeatureAttributes = vi.fn();
const mockNotify = vi.fn();
const mockGetAttribute = vi.fn();

vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: mockNotify }) }));

vi.mock("@/api/pim/api", () => ({
  GET_FeatureSetFeatures: () =>
    Promise.resolve({
      data: {
        results: [
          { feature_idx: "waterproof", feature_name: "Waterproof", feature_type: 1 },
          { feature_idx: "released", feature_name: "Released", feature_type: 10 },
          { feature_idx: "colour", feature_name: "Colour", feature_type: 7 },
          { feature_idx: "sizes", feature_name: "Sizes", feature_type: 8 },
        ],
      },
    }),
  GET_FeatureAttributes: (...args) => mockGetFeatureAttributes(...args),
  GET_Attribute: (...args) => mockGetAttribute(...args),
}));

import AttributeEditor from "@/views/Pim/components/AttributeEditor.vue";

const SwitchStub = { name: "BasicSwitch", props: ["modelValue", "label"], emits: ["update:modelValue"], template: "<div />" };
const DateStub = { name: "BasicDatePicker", props: ["modelValue", "config"], emits: ["update:modelValue"], template: "<div />" };
const SelectStub = {
  name: "BasicSelect",
  props: { modelValue: null, options: Array, multiple: Boolean, searchable: Boolean, clearable: Boolean, moreLabel: String },
  emits: ["update:modelValue", "more", "search"],
  template: "<div />",
};
const SlotStub = { template: "<div><slot name=\"actions\" /><slot /></div>" };

const page = (results, next = null) => Promise.resolve({ data: { results, next } });

const mountEditor = (attributes = [], props = {}) =>
  mount(AttributeEditor, {
    props: { featureSetIdx: "outdoor", channelIdx: "default-europe", attributes, ...props },
    global: {
      components: { BasicSwitch: SwitchStub, BasicDatePicker: DateStub, BasicSelect: SelectStub },
      stubs: {
        RouterLink: true,
        TranslationsDrawer: true,
        IconButton: true,
        CountBadge: true,
        BasicCard: SlotStub,
        FormField: SlotStub,
      },
    },
  });

const selectOf = (wrapper, multiple) =>
  wrapper.findAllComponents(SelectStub).find((select) => select.props("multiple") === multiple);

async function openSelect(wrapper, multiple) {
  await selectOf(wrapper, multiple).trigger("focusin");
  await flushPromises();
}

const optionValues = (wrapper, multiple = false) => selectOf(wrapper, multiple).props("options").map((o) => o.value);

const lastRow = (wrapper, idx) =>
  wrapper.emitted("update:attributes").at(-1)[0].find((r) => r.feature_idx === idx);

describe("AttributeEditor — P3 controls", () => {
  beforeEach(() => {
    mockGetFeatureAttributes.mockReset();
    mockGetFeatureAttributes.mockImplementation(() => page([]));
  });

  it("the bool switch writes the picked value", async () => {
    const wrapper = mountEditor();
    await flushPromises();

    const toggle = wrapper.findComponent(SwitchStub);
    expect(toggle.props("modelValue")).toBe(false);
    await toggle.vm.$emit("update:modelValue", true);

    expect(lastRow(wrapper, "waterproof").value_bool).toBe(true);
  });

  it("a datetime attribute picks a single date", async () => {
    const wrapper = mountEditor();
    await flushPromises();

    const picker = wrapper.findComponent(DateStub);
    expect(picker.props("config").mode).toBe("single");
    await picker.vm.$emit("update:modelValue", "2026-09-27");

    expect(lastRow(wrapper, "released").value_datetime).toBe("2026-09-27");
  });

  it("a select attribute is a searchable, clearable BasicSelect that writes the picked value", async () => {
    mockGetFeatureAttributes.mockImplementation((idx) =>
      page(idx === "colour" ? [{ idx: "red", name: "Red" }, { idx: "blue", name: "Blue" }] : [])
    );
    const wrapper = mountEditor();
    await flushPromises();
    await openSelect(wrapper, false);

    const select = selectOf(wrapper, false);
    expect(select.props("searchable")).toBe(true);
    expect(select.props("clearable")).toBe(true);
    expect(select.props("options")).toEqual([
      { label: "Red", value: "red" },
      { label: "Blue", value: "blue" },
    ]);
    await select.vm.$emit("update:modelValue", "blue");
    expect(lastRow(wrapper, "colour").attribute_idx).toBe("blue");

    await select.vm.$emit("update:modelValue", null);
    expect(lastRow(wrapper, "colour").attribute_idx).toBe(null);
  });

  it("a multiselect attribute writes the picked list", async () => {
    mockGetFeatureAttributes.mockImplementation((idx) =>
      page(idx === "sizes" ? [{ idx: "s", name: "S" }, { idx: "m", name: "M" }] : [])
    );
    const wrapper = mountEditor();
    await flushPromises();
    await openSelect(wrapper, true);

    const select = selectOf(wrapper, true);
    await select.vm.$emit("update:modelValue", ["s", "m"]);

    expect(lastRow(wrapper, "sizes").attribute_idxs).toEqual(["s", "m"]);
  });
});

describe("AttributeEditor — select values load lazily", () => {
  const hasMore = (wrapper, multiple) => Boolean(selectOf(wrapper, multiple).props("moreLabel"));
  const more = async (wrapper, multiple) => {
    await selectOf(wrapper, multiple).vm.$emit("more");
    await flushPromises();
  };

  beforeEach(() => {
    mockGetFeatureAttributes.mockReset();
    mockNotify.mockReset();
    mockGetAttribute.mockReset();
    mockGetAttribute.mockRejectedValue(new Error("404"));
  });

  it("opening a product asks for no values; a select loads its first page when it opens, once", async () => {
    mockGetFeatureAttributes.mockImplementation(() => page([{ idx: "red", name: "Red" }]));
    const wrapper = mountEditor();
    await flushPromises();
    expect(mockGetFeatureAttributes).not.toHaveBeenCalled();

    await openSelect(wrapper, false);
    await openSelect(wrapper, false);
    expect(mockGetFeatureAttributes).toHaveBeenCalledTimes(1);
    expect(mockGetFeatureAttributes).toHaveBeenCalledWith("colour", "default-europe", { page_size: 100, page: 1 });
    expect(optionValues(wrapper, false)).toEqual(["red"]);
  });

  it("the selects that hold a value load their first page at once, in parallel, for the label", async () => {
    mockGetFeatureAttributes.mockImplementation(() => new Promise(() => {}));
    mountEditor([
      { feature_idx: "colour", attribute_idx: "red" },
      { feature_idx: "sizes", attribute_idx: "s" },
    ]);
    await flushPromises();
    expect(mockGetFeatureAttributes.mock.calls.map((call) => call[0])).toEqual(["colour", "sizes"]);
  });

  it("a stored value outside the first page shows its own name, asked for once", async () => {
    mockGetFeatureAttributes.mockImplementation(() => page([{ idx: "red", name: "Red" }], "next-url"));
    mockGetAttribute.mockResolvedValue({ data: { idx: "teal", name: "Teal" } });
    const wrapper = mountEditor([{ feature_idx: "colour", attribute_idx: "teal" }]);
    await flushPromises();

    expect(mockGetAttribute).toHaveBeenCalledTimes(1);
    expect(mockGetAttribute).toHaveBeenCalledWith("colour", "teal");
    expect(selectOf(wrapper, false).props("options").slice(0, 2)).toEqual([
      { label: "Red", value: "red" },
      { label: "Teal", value: "teal" },
    ]);
  });

  it("further pages load on demand through the more row, and a stored value outside them still shows", async () => {
    mockGetFeatureAttributes.mockImplementation((idx, channel, params) =>
      params.page === 1 ? page([{ idx: "red", name: "Red" }], "next-url") : page([{ idx: "blue", name: "Blue" }])
    );
    const wrapper = mountEditor([{ feature_idx: "colour", attribute_idx: "legacy" }]);
    await flushPromises();
    expect(optionValues(wrapper, false)).toEqual(["red", "legacy"]);
    expect(hasMore(wrapper, false)).toBe(true);

    await more(wrapper, false);
    expect(mockGetFeatureAttributes).toHaveBeenLastCalledWith("colour", "default-europe", { page_size: 100, page: 2 });
    expect(optionValues(wrapper, false)).toEqual(["red", "blue", "legacy"]);
    expect(hasMore(wrapper, false)).toBe(false);
    expect(wrapper.emitted("update:attributes")).toBeUndefined();
  });

  it("the more row of a multiselect loads the next page without touching the picked list", async () => {
    mockGetFeatureAttributes.mockImplementation((idx, channel, params) =>
      params.page === 1 ? page([{ idx: "s", name: "S" }], "next-url") : page([{ idx: "m", name: "M" }])
    );
    const wrapper = mountEditor([{ feature_idx: "sizes", attribute_idx: "s" }]);
    await flushPromises();

    await more(wrapper, true);
    expect(optionValues(wrapper, true)).toEqual(["s", "m"]);
    expect(wrapper.emitted("update:attributes")).toBeUndefined();
  });

  it("a failed first page shows a notice and is asked again on the next open", async () => {
    mockGetFeatureAttributes.mockRejectedValueOnce(new Error("boom"));
    mockGetFeatureAttributes.mockImplementation(() => page([{ idx: "red", name: "Red" }]));
    const wrapper = mountEditor();
    await flushPromises();

    await openSelect(wrapper, false);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
    expect(optionValues(wrapper, false)).toEqual([]);
    await openSelect(wrapper, false);
    expect(optionValues(wrapper, false)).toEqual(["red"]);
  });

  it("a failed later page keeps the values that arrived and the next-page option, which asks again", async () => {
    mockGetFeatureAttributes
      .mockImplementationOnce(() => page([{ idx: "red", name: "Red" }], "next-url"))
      .mockImplementationOnce(() => Promise.reject(new Error("boom")))
      .mockImplementation(() => page([{ idx: "blue", name: "Blue" }]));
    const wrapper = mountEditor();
    await flushPromises();
    await openSelect(wrapper, false);

    await more(wrapper, false);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(optionValues(wrapper, false)).toEqual(["red"]);
    expect(hasMore(wrapper, false)).toBe(true);

    await more(wrapper, false);
    expect(optionValues(wrapper, false)).toEqual(["red", "blue"]);
  });
});

describe("AttributeEditor — search, cache scope, label lookups, notices", () => {
  const values = (from, count) => Array.from({ length: count }, (_, i) => ({ idx: `v${from + i}`, name: `V${from + i}` }));
  const optionCount = (wrapper) => selectOf(wrapper, false).props("options").length;

  beforeEach(() => {
    mockGetFeatureAttributes.mockReset();
    mockNotify.mockReset();
    mockGetAttribute.mockReset();
    mockGetAttribute.mockRejectedValue(new Error("404"));
  });

  it("a typed query loads every page left once, then the select filters them all", async () => {
    mockGetFeatureAttributes.mockImplementation((idx, channel, { page: n }) =>
      page(values((n - 1) * 100, 100), n < 3 ? "next-url" : null)
    );
    const wrapper = mountEditor();
    await flushPromises();
    await openSelect(wrapper, false);

    await selectOf(wrapper, false).vm.$emit("search", "v");
    await selectOf(wrapper, false).vm.$emit("search", "v");
    await flushPromises();
    expect(mockGetFeatureAttributes.mock.calls.map((call) => call[2].page)).toEqual([1, 2, 3]);
    expect(optionCount(wrapper)).toBe(300);
    expect(selectOf(wrapper, false).props("moreLabel")).toBeFalsy();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("a query after a failed first page asks that page again and then the rest", async () => {
    mockGetFeatureAttributes
      .mockImplementationOnce(() => Promise.reject(new Error("down")))
      .mockImplementation((idx, channel, { page: n }) => page(values((n - 1) * 100, 100), n < 2 ? "next-url" : null));
    const wrapper = mountEditor();
    await flushPromises();
    await openSelect(wrapper, false);
    expect(mockNotify).toHaveBeenCalledTimes(1);

    await selectOf(wrapper, false).vm.$emit("search", "v");
    await flushPromises();
    expect(mockGetFeatureAttributes.mock.calls.map((call) => call[2].page)).toEqual([1, 1, 2]);
    expect(optionCount(wrapper)).toBe(200);
  });

  it("the search load stops at 2 000 values with a notice and keeps the more row", async () => {
    mockGetFeatureAttributes.mockImplementation((idx, channel, { page: n }) => page(values((n - 1) * 100, 100), "next"));
    const wrapper = mountEditor();
    await flushPromises();
    await openSelect(wrapper, false);

    await selectOf(wrapper, false).vm.$emit("search", "v");
    await flushPromises();
    expect(mockGetFeatureAttributes).toHaveBeenCalledTimes(20);
    expect(optionCount(wrapper)).toBe(2000);
    expect(selectOf(wrapper, false).props("moreLabel")).toBeTruthy();
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: "info" }));
  });

  it("another channel does not reuse the values of the previous one and asks its own", async () => {
    mockGetFeatureAttributes.mockImplementation((idx, channel) => page([{ idx: channel, name: channel }]));
    const wrapper = mountEditor([{ feature_idx: "colour", attribute_idx: "default-europe" }]);
    await flushPromises();
    expect(optionValues(wrapper)).toEqual(["default-europe"]);

    await wrapper.setProps({ channelIdx: "b2b" });
    await flushPromises();
    expect(mockGetFeatureAttributes).toHaveBeenLastCalledWith("colour", "b2b", { page_size: 100, page: 1 });
    expect(optionValues(wrapper)).toEqual(["b2b", "default-europe"]);
  });

  it("a late answer of the previous channel is never shown", async () => {
    let answerOld;
    mockGetFeatureAttributes.mockImplementation((idx, channel) =>
      channel === "default-europe"
        ? new Promise((resolve) => (answerOld = () => resolve({ data: { results: [{ idx: "old", name: "Old" }] } })))
        : page([{ idx: "new", name: "New" }])
    );
    const wrapper = mountEditor([{ feature_idx: "colour", attribute_idx: "new" }]);
    await flushPromises();
    await wrapper.setProps({ channelIdx: "b2b" });
    await flushPromises();
    answerOld();
    await flushPromises();
    expect(optionValues(wrapper)).toEqual(["new"]);
  });

  it("stored-value names are looked up at most 6 at a time, in the channel's language", async () => {
    const stored = Array.from({ length: 10 }, (_, i) => `s${i}`);
    let inFlight = 0;
    let peak = 0;
    mockGetFeatureAttributes.mockImplementation(() => page([]));
    mockGetAttribute.mockImplementation(async (feature, idx) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { data: { idx, name: `Global ${idx}`, name_t9n: { pl: `PL ${idx}` } } };
    });
    const attributes = stored.map((idx) => ({ feature_idx: "sizes", attribute_idx: idx }));
    const wrapper = mountEditor(attributes, { languages: ["pl"] });
    await vi.waitFor(() => expect(mockGetAttribute).toHaveBeenCalledTimes(10));
    await vi.waitFor(() => expect(inFlight).toBe(0));
    await flushPromises();
    expect(peak).toBe(6);
    expect(selectOf(wrapper, true).props("options")[0]).toEqual({ label: "PL s0", value: "s0" });
  });

  it("a failed prefetch round shows one notice, however many selects failed", async () => {
    mockGetFeatureAttributes.mockRejectedValue(new Error("down"));
    mountEditor([
      { feature_idx: "colour", attribute_idx: "red" },
      { feature_idx: "sizes", attribute_idx: "s" },
    ]);
    await flushPromises();
    expect(mockGetFeatureAttributes).toHaveBeenCalledTimes(2);
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  // Plan 56b (54d review): one loop and one notice per query, a stale loop stops, a stale round stays silent.
  it("two quick keystrokes before the first page run one loop: one notice when it fails", async () => {
    let failFirst;
    mockGetFeatureAttributes.mockImplementationOnce(() => new Promise((_, reject) => (failFirst = reject)));
    const wrapper = mountEditor();
    await flushPromises();
    selectOf(wrapper, false).vm.$emit("search", "v");
    selectOf(wrapper, false).vm.$emit("search", "va");
    await flushPromises();
    failFirst(new Error("down"));
    await flushPromises();
    expect(mockGetFeatureAttributes).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it("a search loop stops when the channel changes and never loads the new channel's pages for it", async () => {
    const pending = [];
    mockGetFeatureAttributes.mockImplementation((idx, channel, { page: n }) =>
      channel === "b2b"
        ? page(values(n * 100, 100), "next")
        : new Promise((resolve) => pending.push(() => resolve({ data: { results: values(n * 100, 100), next: "next" } })))
    );
    const wrapper = mountEditor([{ feature_idx: "colour", attribute_idx: "v100" }]);
    await flushPromises();
    selectOf(wrapper, false).vm.$emit("search", "v");
    pending.shift()();
    await flushPromises();
    await wrapper.setProps({ channelIdx: "b2b" });
    await flushPromises();
    pending.shift()();
    await flushPromises();
    const b2bPages = mockGetFeatureAttributes.mock.calls.filter((call) => call[1] === "b2b").map((call) => call[2].page);
    expect(b2bPages).toEqual([1]);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  // Plan 61c: A → B → A while a loop runs is a new scope too — the old loop stops, the new query runs one loop.
  it("a search loop stops after a channel switch there and back: one loop, one notice", async () => {
    let resolveOld;
    mockGetFeatureAttributes
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = () => resolve({ data: { results: values(0, 100), next: "next" } }))))
      .mockImplementation((idx, channel, { page: n }) => page(values((n - 1) * 100, 100), "next"));
    const wrapper = mountEditor();
    await flushPromises();
    selectOf(wrapper, false).vm.$emit("search", "v");
    await wrapper.setProps({ channelIdx: "b2b" });
    await wrapper.setProps({ channelIdx: "default-europe" });
    await flushPromises();
    selectOf(wrapper, false).vm.$emit("search", "v");
    resolveOld();
    await flushPromises();
    expect(optionCount(wrapper)).toBe(2000);
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it("a prefetch round of the previous channel that fails after the switch raises no notice", async () => {
    let failOld;
    mockGetFeatureAttributes.mockImplementation((idx, channel) =>
      channel === "default-europe"
        ? new Promise((_, reject) => (failOld = () => reject(new Error("down"))))
        : page([{ idx: "red", name: "Red" }])
    );
    const wrapper = mountEditor([{ feature_idx: "colour", attribute_idx: "red" }]);
    await flushPromises();
    await wrapper.setProps({ channelIdx: "b2b" });
    await flushPromises();
    failOld();
    await flushPromises();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(optionValues(wrapper)).toEqual(["red"]);
  });

  it("a listed value reads in the editor's default language, else its name", async () => {
    mockGetFeatureAttributes.mockImplementation(() =>
      page([
        { idx: "red", name: "Red", name_t9n: { pl: "Czerwony" } },
        { idx: "blue", name: "Blue", name_t9n: { en: "Blue EN" } },
      ])
    );
    const wrapper = mountEditor([], { languages: ["pl"] });
    await flushPromises();
    await openSelect(wrapper, false);
    expect(selectOf(wrapper, false).props("options")).toEqual([
      { label: "Czerwony", value: "red" },
      { label: "Blue", value: "blue" },
    ]);
  });

  it("a select the operator opens keeps its own notice", async () => {
    mockGetFeatureAttributes.mockRejectedValue(new Error("down"));
    const wrapper = mountEditor();
    await flushPromises();
    await openSelect(wrapper, false);
    await openSelect(wrapper, true);
    expect(mockNotify).toHaveBeenCalledTimes(2);
  });
});
