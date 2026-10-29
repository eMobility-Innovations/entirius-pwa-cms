// Plan 54b: a drag handle is a keyboard reorder control too (Alt+Arrow moves its row, named after the row), and the
// page header stays while the document loads.
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";

vi.mock("@/api/contentDB/api", () => ({ GET_ContentTypes: vi.fn(() => Promise.resolve({ data: { data: [] } })) }));

import IconButton from "@/boots/IconButton/index.vue";
import NavigationEditor from "@/views/LayoutExtenders/NavigationEditor.vue";

const item = (id, links = []) => ({ id, label: id, display_as: "megamenu", columns: [{ id: `${id}-c`, type: "links", heading: "H", links }] });
const link = (id) => ({ id, label: id });
const PageHeader = { name: "PageHeader", props: ["title"], template: "<header><slot name='actions' /></header>" };

const mountEditor = (state) =>
  mount(
    {
      ...NavigationEditor,
      data() {
        return { ...NavigationEditor.data.call(this), ...state };
      },
      methods: { ...NavigationEditor.methods, init: vi.fn() },
    },
    {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        components: { IconButton },
        stubs: { PageHeader, BasicTooltip: { template: "<span><slot /></span>" }, ActionBar: true, SubscriberSetter: true,
          ChannelMultiSelect: true, Tag: true, BasicButton: true, BasicInput: true, BasicModal: true, ConfirmDialog: true,
          TranslationsDrawer: true, EditBannerModal: true },
      },
    }
  );

const press = (el, key) => el.trigger("keydown", { key, altKey: true });

describe("NavigationEditor — keyboard reorder", () => {
  it("moves an item down and up with Alt+Arrow, never past the ends", async () => {
    const wrapper = mountEditor({ navigationItems: [item("a"), item("b"), item("c")] });
    const handles = () => wrapper.findAll("button.handle");
    expect(handles()[0].attributes("aria-label")).toBe("layout_extender.reorder_item::{\"label\":\"a\"}");

    await press(handles()[0], "ArrowDown");
    expect(wrapper.vm.navigationItems.map((i) => i.id)).toEqual(["b", "a", "c"]);
    await press(handles()[0], "ArrowUp");
    expect(wrapper.vm.navigationItems.map((i) => i.id)).toEqual(["b", "a", "c"]);
    await press(handles()[2], "ArrowUp");
    expect(wrapper.vm.navigationItems.map((i) => i.id)).toEqual(["b", "c", "a"]);
    await flushPromises();
    // The moved row's handle keeps the focus, so the operator can press again.
    expect(document.activeElement.getAttribute("aria-label")).toContain('"label":"c"');
    wrapper.unmount();
  });

  it("moves a link inside its column", async () => {
    const wrapper = mountEditor({ navigationItems: [item("a", [link("x"), link("y")])], expandedItems: ["a"] });
    await press(wrapper.findAll("button.link-handle")[1], "ArrowUp");
    expect(wrapper.vm.navigationItems[0].columns[0].links.map((l) => l.id)).toEqual(["y", "x"]);
    wrapper.unmount();
  });

  it("keeps the page header while the document loads", () => {
    const wrapper = mountEditor({ loading: true });
    expect(wrapper.findComponent(PageHeader).exists()).toBe(true);
    wrapper.unmount();
  });
});

describe("LayoutExtenderList — refetch", () => {
  it("keeps the same table mounted while the list reloads", async () => {
    const { default: LayoutExtenderList } = await import("@/views/LayoutExtenders/LayoutExtenderList.vue");
    const DataTable = { name: "DataTable", props: ["rows"], template: "<div />" };
    const wrapper = mount(LayoutExtenderList, {
      global: { plugins: [createPinia()], stubs: { DataTable, ConfirmDialog: true, BasicModal: true, FilterChip: true } },
    });
    await flushPromises();
    const table = wrapper.findComponent(DataTable);
    await wrapper.vm.fetchItems();
    await flushPromises();
    expect(wrapper.findComponent(DataTable).vm).toBe(table.vm);
  });
});
