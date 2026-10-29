import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// P5 Atlas sources (plan 47): the bindings that moved — OverviewTab's Save into SourceDetail's PageHeader, the
// product drawer's footer into an ActionBar, the category mapping's source value (a text field plus a menu of the feed's values).

const mockGetSource = vi.fn();
const mockGetDataValues = vi.fn();
const mockGetSupplierProducts = vi.fn();

vi.mock("@/api/atlas/api", async (importOriginal) => ({
  ...(await importOriginal()),
  GET_Source: (...args) => mockGetSource(...args),
  GET_DataValues: (...args) => mockGetDataValues(...args),
  GET_SupplierProducts: (...args) => mockGetSupplierProducts(...args),
}));
vi.mock("@/api/pim/api", () => ({ GET_Categories: vi.fn() }));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isPanelEnabled: () => true }),
}));
vi.mock("@/stores/regional", () => ({
  useRegionalStore: () => ({
    fetchAll: vi.fn(),
    languageOptions: [],
    currencyOptions: [],
    countryOptions: [],
  }),
}));

import SourceDetail from "@/views/Atlas/SourceDetail.vue";
import OverviewTab from "@/views/Atlas/tabs/OverviewTab.vue";
import ProductsTab from "@/views/Atlas/tabs/ProductsTab.vue";
import CategoryMappingRow from "@/views/Atlas/components/CategoryMappingRow.vue";
import BasicInput from "@/boots/BasicInput/index.vue";

const supplier = { idx: "acme", name: "Acme Corp", kind: "procurement" };
const $t = (key) => key;

function mountDetail(query = {}) {
  return mount(SourceDetail, {
    global: {
      mocks: {
        $t,
        $route: { params: { idx: "acme" }, query, path: "/atlas/acme" },
        $router: { replace: vi.fn() },
      },
      stubs: {
        PageLayout: { template: "<div><slot name='header'/><slot name='toolbar'/><slot/></div>" },
        PageHeader: { props: ["title", "back"], template: "<header><slot name='actions'/></header>" },
        ActionBar: { props: ["actions"], template: "<div class='stub-actions'/>" },
        BasicTabs: { props: ["options", "modelValue", "idPrefix"], template: "<div class='stub-tabs'/>" },
        Loader: true,
        EmptyState: true,
        OverviewTab: {
          name: "OverviewTab",
          emits: ["header-actions"],
          template: "<div class='stub-overview'/>",
        },
        FeedsTab: { name: "FeedsTab", template: "<div class='stub-feeds'/>" },
        MappingsTab: true,
        ProductsTab: true,
        LinkedTab: true,
        LogsTab: true,
      },
    },
  });
}

describe("SourceDetail — page frame", () => {
  beforeEach(() => {
    mockGetSource.mockReset();
  });

  it("puts the actions the open tab emits into the PageHeader ActionBar", async () => {
    mockGetSource.mockResolvedValue({ data: supplier });
    const wrapper = mountDetail();
    await flushPromises();
    expect(wrapper.find(".stub-actions").exists()).toBe(false);

    const save = [{ key: "save", label: "Save", role: "primary", onClick: vi.fn() }];
    wrapper.findComponent({ name: "OverviewTab" }).vm.$emit("header-actions", save);
    await flushPromises();
    expect(wrapper.findComponent(".stub-actions").props("actions")).toEqual(save);
  });

  it("names the tab panel after the visible tab, falling back to overview for a hidden one", async () => {
    mockGetSource.mockResolvedValue({ data: { ...supplier, kind: "monitoring" } });
    const wrapper = mountDetail({ tab: "mappings" });
    await flushPromises();
    const panel = wrapper.find("[role='tabpanel']");
    expect(panel.attributes("id")).toBe("atlas-source-panel-overview");
    expect(panel.attributes("aria-labelledby")).toBe("atlas-source-tab-overview");
    const tabs = wrapper.findComponent(".stub-tabs");
    expect(tabs.props("modelValue")).toBe("overview");
    expect(tabs.props("options").map((o) => o.testid)).not.toContain("suppliers-tab-mappings");
  });

  it("shows the empty state when the source does not load", async () => {
    mockGetSource.mockRejectedValue(new Error("404"));
    const wrapper = mountDetail();
    await flushPromises();
    expect(wrapper.find("empty-state-stub").exists()).toBe(true);
    expect(wrapper.find("[role='tabpanel']").exists()).toBe(false);
  });
});

describe("OverviewTab — Save in the page header", () => {
  function mountOverview() {
    return mount(OverviewTab, {
      props: { supplier: { ...supplier, sku_prefix: "AC" } },
      global: {
        mocks: { $t },
        stubs: {
          FormField: { template: "<div><slot/></div>" },
          BasicInput: true,
          BasicSelect: true,
          BasicSwitch: true,
          NumberInput: true,
        },
      },
    });
  }
  const lastActions = (wrapper) => wrapper.emitted("header-actions").at(-1)[0];

  it("emits a disabled primary Save until the form is dirty", async () => {
    const wrapper = mountOverview();
    const [save] = lastActions(wrapper);
    expect(save).toMatchObject({ key: "save", role: "primary", disabled: true, testid: "suppliers-overview-save" });

    wrapper.vm.$data.form.name = "Acme Renamed";
    await flushPromises();
    expect(lastActions(wrapper)[0].disabled).toBe(false);
  });

  it("clears the header actions when it unmounts", () => {
    const wrapper = mountOverview();
    wrapper.unmount();
    expect(lastActions(wrapper)).toEqual([]);
  });
});

describe("ProductsTab — drawer ActionBar", () => {
  function mountProducts() {
    mockGetSupplierProducts.mockResolvedValue({ data: { results: [], count: 0 } });
    return mount(ProductsTab, {
      props: { supplier },
      global: { mocks: { $t }, stubs: { DataTable: true, SideDrawer: true, BulkActionBar: true, FilterChip: true } },
    });
  }
  const keysFor = async (wrapper, status) => {
    wrapper.vm.$data.detailProduct = { id: 1, status };
    await flushPromises();
    return wrapper.vm.detailActions.map((a) => `${a.key}:${a.role}`);
  };

  it("offers the actions of each status, with one primary at most", async () => {
    const wrapper = mountProducts();
    expect(await keysFor(wrapper, "new")).toEqual(["approve:primary", "skip:secondary", "reject:danger"]);
    expect(await keysFor(wrapper, "queued")).toEqual(["approve:primary", "reject:danger"]);
    expect(await keysFor(wrapper, "approved")).toEqual(["reject:danger", "push:primary"]);
    expect(await keysFor(wrapper, "pushed")).toEqual(["repush:primary"]);
  });

  it("disables the drawer actions while one is in flight", async () => {
    const wrapper = mountProducts();
    wrapper.vm.$data.detailProduct = { id: 1, status: "new" };
    wrapper.vm.$data.detailBusy = true;
    await flushPromises();
    expect(wrapper.vm.detailActions.every((a) => a.disabled)).toBe(true);
  });
});

describe("CategoryMappingRow — source value", () => {
  // The value is a text field (stored as typed); a menu beside it lists the feed's values of the source field.
  const BasicMenuStub = {
    props: ["items", "label"],
    emits: ["open", "select"],
    template: `<div class="stub-menu"><slot name="trigger"/>
      <button class="stub-open" @click="$emit('open')"/>
      <p v-for="item in items" :key="item.key" :class="item.heading ? 'stub-heading' : 'stub-item'"
        @click="item.heading || $emit('select', item)">{{ item.label }}</p></div>`,
  };

  function mountRow(local = {}) {
    return mount(CategoryMappingRow, {
      props: { supplierIdx: "acme", mapping: { source_field: "", source_value: "", ...local } },
      global: {
        mocks: { $t },
        stubs: {
          BasicInput,
          FormField: { template: "<div><slot/></div>" },
          EntitySearchPicker: true,
          IconButton: { props: ["disabled"], template: "<button class='stub-values' :disabled='disabled'/>" },
          BasicMenu: BasicMenuStub,
        },
      },
    });
  }

  async function openValues(wrapper) {
    await wrapper.find(".stub-open").trigger("click");
    await flushPromises();
  }

  const labels = (wrapper, cls) => wrapper.findAll(cls).map((p) => p.text());

  beforeEach(() => {
    mockGetDataValues.mockReset();
  });

  it("stores the typed text as it is, without a pick from the list", async () => {
    const wrapper = mountRow({ source_field: "category" });
    await wrapper.find('[data-testid="cat-mapping-value-new"] input').setValue("Games/Board");
    await wrapper.find('[data-testid="cat-mapping-save-new"]').trigger("click");
    expect(wrapper.emitted("save")[0][0].source_value).toBe("Games/Board");
    expect(mockGetDataValues).not.toHaveBeenCalled();
  });

  it("lists the feed's values with their counts, skipping null and reading numbers as text", async () => {
    mockGetDataValues.mockResolvedValue({
      data: { values: [{ value: null, count: 4 }, { value: 42, count: 2 }, { value: "Drills", count: 12 }] },
    });
    const wrapper = mountRow({ source_field: "category" });
    await openValues(wrapper);
    expect(mockGetDataValues).toHaveBeenCalledWith("acme", { source_field: "category" });
    expect(labels(wrapper, ".stub-item")).toEqual([
      "42 · 2 atlas.mappings.category.source_value_picker_count_suffix",
      "Drills · 12 atlas.mappings.category.source_value_picker_count_suffix",
    ]);
  });

  it("filters the values by the typed text, sets a picked one, and asks once per source field", async () => {
    mockGetDataValues.mockResolvedValue({
      data: { values: [{ value: "Drills", count: 12 }, { value: "Saws", count: 3 }] },
    });
    const wrapper = mountRow({ source_field: "category", source_value: "dri" });
    await openValues(wrapper);
    expect(wrapper.findAll(".stub-item")).toHaveLength(1);
    await wrapper.find(".stub-item").trigger("click");
    expect(wrapper.find('[data-testid="cat-mapping-value-new"] input').element.value).toBe("Drills");
    await openValues(wrapper);
    expect(mockGetDataValues).toHaveBeenCalledTimes(1);
  });

  it("reopens the full list after a pick, and filters again on typing, an exact list value included", async () => {
    mockGetDataValues.mockResolvedValue({
      data: { values: [{ value: "S", count: 12 }, { value: "SM", count: 3 }, { value: "XL", count: 1 }] },
    });
    const wrapper = mountRow({ source_field: "category" });
    await openValues(wrapper);
    await wrapper.findAll(".stub-item")[1].trigger("click");
    await openValues(wrapper);
    expect(wrapper.findAll(".stub-item")).toHaveLength(3);
    await wrapper.find('[data-testid="cat-mapping-value-new"] input').setValue("S");
    expect(wrapper.findAll(".stub-item")).toHaveLength(2);
  });

  it("shows the API message when the values fail to load, and asks again on the next open", async () => {
    mockGetDataValues.mockRejectedValueOnce({ response: { data: { message: "Feed unavailable" } } });
    mockGetDataValues.mockResolvedValueOnce({ data: { values: [{ value: "Hammers", count: 2 }] } });
    const wrapper = mountRow({ source_field: "category" });
    await openValues(wrapper);
    expect(labels(wrapper, ".stub-heading")).toEqual(["Feed unavailable"]);
    await openValues(wrapper);
    expect(labels(wrapper, ".stub-heading")).toEqual([]);
    expect(wrapper.findAll(".stub-item")).toHaveLength(1);
  });

  it("drops a late answer for a source field that is no longer chosen", async () => {
    let answerCategory;
    mockGetDataValues.mockReturnValueOnce(new Promise((resolve) => (answerCategory = resolve)));
    mockGetDataValues.mockResolvedValueOnce({ data: { values: [{ value: "Nails", count: 5 }] } });
    const wrapper = mountRow({ source_field: "category" });
    await openValues(wrapper);
    wrapper.vm.local.source_field = "group";
    await openValues(wrapper);
    answerCategory({ data: { values: [{ value: "Drills", count: 12 }] } });
    await flushPromises();
    expect(labels(wrapper, ".stub-item")).toEqual(["Nails · 5 atlas.mappings.category.source_value_picker_count_suffix"]);
  });

  it("offers no values before a source field is chosen", async () => {
    const wrapper = mountRow();
    expect(wrapper.find(".stub-values").element.disabled).toBe(true);
    await openValues(wrapper);
    expect(mockGetDataValues).not.toHaveBeenCalled();
  });
});
