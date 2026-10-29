import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { h } from "vue";

import DataTable from "@/boots/DataTable/index.vue";

const columns = [
  { key: "name", label: "Name" },
  { key: "value", label: "Value" },
];

const rows = [
  { uid: 1, name: "Row A", value: 10 },
  { uid: 2, name: "Row B", value: 20 },
];

const expandSlot = { expand: ({ row }) => h("div", { class: "expand-content" }, row.name) };

describe("DataTable boot — expand row (opt-in)", () => {
  it("does not render the expand toggle column or slot when expandable is unset (default)", () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows },
      slots: expandSlot,
    });
    expect(wrapper.find(".data-table__expand-toggle").exists()).toBe(false);
    expect(wrapper.find(".data-table__header-cell--expand").exists()).toBe(false);
    expect(wrapper.find(".expand-content").exists()).toBe(false);
  });

  it("renders one collapsed toggle per row when expandable=true, no expand content yet", () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, expandable: true },
      slots: expandSlot,
    });
    expect(wrapper.findAll(".data-table__expand-toggle").length).toBe(rows.length);
    expect(wrapper.find(".data-table__expand-row").exists()).toBe(false);
  });

  it("toggles the #expand slot open/closed on click, emits expand-toggle, and flips aria-expanded", async () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, expandable: true },
      slots: expandSlot,
    });
    const toggles = wrapper.findAll(".data-table__expand-toggle");

    expect(toggles[0].attributes("aria-expanded")).toBe("false");

    await toggles[0].trigger("click");
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(1);
    expect(wrapper.find(".expand-content").text()).toBe("Row A");
    expect(wrapper.emitted("expand-toggle")[0]).toEqual([{ row: rows[0], expanded: true }]);
    expect(toggles[0].attributes("aria-expanded")).toBe("true");

    await toggles[0].trigger("click");
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(0);
    expect(wrapper.emitted("expand-toggle")[1]).toEqual([{ row: rows[0], expanded: false }]);
    expect(toggles[0].attributes("aria-expanded")).toBe("false");
  });

  it("tracks each row's expand state independently — expanding row A leaves row B collapsed, and vice versa", async () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, expandable: true },
      slots: expandSlot,
    });
    const toggles = wrapper.findAll(".data-table__expand-toggle");

    await toggles[0].trigger("click");
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(1);
    expect(wrapper.find(".expand-content").text()).toBe("Row A");

    await toggles[1].trigger("click");
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(2);
    expect(wrapper.findAll(".expand-content").map((el) => el.text())).toEqual(["Row A", "Row B"]);

    await toggles[0].trigger("click");
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(1);
    expect(wrapper.find(".expand-content").text()).toBe("Row B");
  });

  it("expand state is keyed by rowKey — two rows sharing a key expand together", async () => {
    const collidingRows = [
      { uid: 1, name: "Row A", value: 10 },
      { uid: 1, name: "Row A duplicate key", value: 99 },
    ];
    const wrapper = mount(DataTable, {
      props: { columns, rows: collidingRows, expandable: true },
      slots: expandSlot,
    });

    await wrapper.findAll(".data-table__expand-toggle")[0].trigger("click");
    // Documents the real (unguarded) behavior: rowKey is the only identity DataTable has,
    // so a shared key expands both rows. Callers with non-unique natural keys (e.g. a
    // multi-market listing) must build a composite rowKey — see GapTable.vue's `_rowKey`.
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(2);
  });

  it("keeps selectable + multiSelect working when expandable is also on, without cross-triggering", async () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, expandable: true, selectable: true, multiSelect: true },
      slots: expandSlot,
    });

    // Clicking the expand toggle must not select the row.
    await wrapper.findAll(".data-table__expand-toggle")[0].trigger("click");
    expect(wrapper.emitted("select")).toBeFalsy();
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(1);

    // Clicking the checkbox must not toggle expand state.
    await wrapper.find('input[type="checkbox"][aria-label="Select row"]').trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.findAll(".data-table__expand-row").length).toBe(1);
  });
});

describe("DataTable boot — empty state", () => {
  it("renders EmptyState with the empty text outside the scrolling grid", () => {
    const wrapper = mount(DataTable, { props: { columns, rows: [], emptyText: "No bookings" } });
    const empty = wrapper.find(".data-table__empty");
    expect(empty.exists()).toBe(true);
    expect(wrapper.find(".data-table__grid .data-table__empty").exists()).toBe(false);
    expect(empty.find("empty-state-stub").attributes("title")).toBe("No bookings");
  });

  it("renders no empty state while there are rows", () => {
    const wrapper = mount(DataTable, { props: { columns, rows } });
    expect(wrapper.find(".data-table__empty").exists()).toBe(false);
  });
});

// The query strings DataTable asks for, answered as a phone (up to 768 px, `max-tablet`) or a tablet (769–1023 px).
function stubViewport(width) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: width <= Number(query.match(/max-width: (\d+)px/)?.[1] ?? 0),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const cells = (wrapper, key) => wrapper.findAll(`.data-table__cell[data-column="${key}"]`);

describe("DataTable boot — cell model", () => {
  it("truncates a cell without a slot and gives it the full value as title", () => {
    const wrapper = mount(DataTable, { props: { columns, rows } });
    const cell = cells(wrapper, "name")[0];
    expect(cell.classes()).toContain("data-table__cell--truncate");
    expect(cell.text()).toBe("Row A");
    expect(cell.attributes("title")).toBe("Row A");
  });

  it("leaves a slot cell untruncated unless the column opts in, with title(row) as the title", () => {
    const opted = [
      { key: "name", label: "Name", truncate: true, title: (row) => `${row.name} (${row.uid})` },
      { key: "value", label: "Value" },
    ];
    const slots = { "cell-name": "<b>custom</b>", "cell-value": "<i>badge</i>" };
    const wrapper = mount(DataTable, { props: { columns: opted, rows }, slots });
    expect(cells(wrapper, "name")[0].attributes("title")).toBe("Row A (1)");
    expect(cells(wrapper, "value")[0].classes()).not.toContain("data-table__cell--truncate");
    expect(cells(wrapper, "value")[0].attributes("title")).toBeUndefined();
  });

  it("titles a truncated slot cell without title(row) by its rendered text, never the raw value", async () => {
    const opted = [{ key: "value", label: "Value", truncate: true }];
    const slots = { "cell-value": ({ value }) => h("span", `Label ${value}`) };
    const wrapper = mount(DataTable, { props: { columns: opted, rows }, slots });
    expect(cells(wrapper, "value")[0].attributes("title")).toBe("Label 10");

    await wrapper.setProps({ rows: [{ uid: 3, value: 30 }] });
    expect(cells(wrapper, "value")[0].attributes("title")).toBe("Label 30");
  });

  it("renders an em dash for an empty value, without a title", () => {
    const empty = [{ uid: 1, name: "", value: null }];
    const wrapper = mount(DataTable, { props: { columns, rows: empty } });
    expect(cells(wrapper, "name")[0].text()).toBe("\u2014");
    expect(cells(wrapper, "value")[0].text()).toBe("\u2014");
    expect(cells(wrapper, "name")[0].attributes("title")).toBeUndefined();
  });

  it("leaves a slot that renders nothing empty, without the dash", () => {
    const wrapper = mount(DataTable, { props: { columns, rows }, slots: { "cell-value": "" } });
    expect(cells(wrapper, "value")[0].text()).toBe("");
  });

  it("right-aligns numeric and action cells and never truncates them", () => {
    const typed = [
      { key: "value", label: "Value", numeric: true },
      { key: "actions", label: "", actions: true },
    ];
    const wrapper = mount(DataTable, { props: { columns: typed, rows } });
    const [value, actions] = [cells(wrapper, "value")[0], cells(wrapper, "actions")[0]];
    expect(value.classes()).toContain("data-table__cell--numeric");
    expect(value.attributes("style")).toContain("justify-content: flex-end");
    expect(value.classes()).not.toContain("data-table__cell--truncate");
    expect(actions.classes()).toContain("data-table__cell--actions");
    expect(actions.attributes("style")).toContain("justify-content: flex-end");
  });

  it("builds tracks: px floored by content, truncated fr floored by its header and 120 px, actions sized to their buttons", () => {
    const sized = [
      { key: "name", label: "Name", width: "1fr" },
      { key: "value", label: "Value", width: "100px" },
      { key: "actions", label: "", actions: true },
      { key: "extra", label: "Extra", width: "minmax(80px, 1fr)" },
    ];
    const wrapper = mount(DataTable, { props: { columns: sized, rows, selectable: true } });
    const [name, value] = wrapper.findAll(".data-table__header-cell").slice(1);
    expect(name.attributes("style")).toContain("min-width: 120px");
    expect(value.attributes("style")).not.toContain("min-width");
    expect(wrapper.find(".data-table__grid").attributes("style")).toContain(
      "grid-template-columns: 40px minmax(min-content, 1fr) minmax(min-content, 100px) max-content minmax(80px, 1fr)"
    );
  });
});

describe("DataTable boot — column priority", () => {
  afterEach(() => vi.restoreAllMocks());

  const prioritised = [
    { key: "name", label: "Name", width: "1fr" },
    { key: "value", label: "Value", width: "100px", priority: 2 },
    { key: "extra", label: "Extra", width: "80px", priority: 3 },
  ];

  it("shows every column on a desktop", () => {
    stubViewport(1680);
    const wrapper = mount(DataTable, { props: { columns: prioritised, rows } });
    expect(wrapper.findAll(".data-table__header-cell").length).toBe(3);
  });

  it("hides priority 3 below 1024 px and priority 2 at max-tablet (≤ 768 px), header, cells and track alike", () => {
    stubViewport(900);
    const tablet = mount(DataTable, { props: { columns: prioritised, rows } });
    expect(tablet.findAll(".data-table__header-cell").map((h) => h.text())).toEqual(["Name", "Value"]);

    stubViewport(393);
    const phone = mount(DataTable, { props: { columns: prioritised, rows } });
    expect(phone.findAll(".data-table__header-cell").map((h) => h.text())).toEqual(["Name"]);
    expect(cells(phone, "value").length).toBe(0);
    expect(phone.find(".data-table__grid").attributes("style")).toContain(
      "grid-template-columns: minmax(min-content, 1fr);"
    );
  });

  it("switches to the phone layout at 768 px, the same breakpoint as the max-tablet mixin", () => {
    stubViewport(768);
    const wrapper = mount(DataTable, { props: { columns: prioritised, rows } });
    expect(wrapper.findAll(".data-table__header-cell").map((h) => h.text())).toEqual(["Name"]);
  });

  it("shrinks a px column to its content on a phone, so the name takes the free width", () => {
    stubViewport(393);
    const sized = [prioritised[0], { key: "value", label: "V", width: "100px" }];
    const wrapper = mount(DataTable, { props: { columns: sized, rows } });
    expect(wrapper.find(".data-table__grid").attributes("style")).toContain(
      "grid-template-columns: minmax(min-content, 1fr) min-content;"
    );
  });
});

describe("DataTable boot — sort, selection and row click unchanged", () => {
  it("cycles a sortable header asc → desc → none and emits each state", async () => {
    const sortableColumns = [{ key: "name", label: "Name", sortable: true }];
    const wrapper = mount(DataTable, { props: { columns: sortableColumns, rows, sortable: true } });
    const header = wrapper.find(".data-table__header-cell--sortable");
    await header.trigger("click");
    await header.trigger("click");
    await header.trigger("click");
    expect(wrapper.emitted("sort").map(([e]) => e.direction)).toEqual(["asc", "desc", null]);
  });

  it("selects the clicked row and emits row-click with it", async () => {
    const wrapper = mount(DataTable, { props: { columns, rows, selectable: true } });
    await wrapper.findAll(".data-table__row")[1].trigger("click");
    expect(wrapper.emitted("select")[0][0]).toEqual([rows[1]]);
    expect(wrapper.emitted("row-click")[0][0]).toEqual(rows[1]);
  });
});
