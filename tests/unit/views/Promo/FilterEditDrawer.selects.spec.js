import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// The four product-filter pickers and the customer groups picker are BasicSelect `multiple` on `v-model` (plan 18):
// the chosen ids reach the payload, the options read "idx — name".
const mockPostProduct = vi.fn();
const mockPostCustomer = vi.fn();

const mockCategories = vi.fn();
const mockCategory = vi.fn();
vi.mock("@/api/pim/api", () => ({
  GET_Products: vi.fn(),
  GET_Categories: (...a) => mockCategories(...a),
  GET_Category: (...a) => mockCategory(...a),
  GET_Attributes: () => Promise.resolve({ data: { results: [] } }),
  GET_Features: () => Promise.resolve({ data: { results: [] } }),
  GET_Feature: vi.fn(),
}));
vi.mock("@/api/accounts/api", () => ({
  GET_Customers: vi.fn(),
  GET_AccountsGroups: () => Promise.resolve({ data: { results: [{ code: "vip", name: "VIP" }] } }),
}));
vi.mock("@/api/promo/api", () => ({
  POST_ProductFilter: (...a) => mockPostProduct(...a),
  POST_CustomerFilter: (...a) => mockPostCustomer(...a),
  POST_ThresholdFilter: vi.fn(),
  PATCH_ProductFilter: vi.fn(),
  PATCH_ThresholdFilter: vi.fn(),
  PATCH_CustomerFilter: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ channels: [{ idx: "default", default_language: "en" }] }) }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));

import FilterEditDrawer from "@/views/Promo/FilterEditDrawer.vue";

const SelectProbe = {
  name: "BasicSelect",
  props: ["options", "modelValue", "multiple", "placeholder", "moreLabel"],
  emits: ["update:modelValue"],
  template: "<div class='select-probe' />",
};

async function openDrawer(kind, filter = null) {
  const wrapper = mount(FilterEditDrawer, {
    props: { visible: false, kind, channel: "default", ruleId: 7, filter },
    global: {
      stubs: {
        SideDrawer: { template: "<div><slot /></div>" },
        FormField: { template: "<div><slot /></div>" },
        BasicSelect: SelectProbe,
        // The footer is an ActionBar (plan 44): one button per action, named by its label.
        ActionBar: {
          props: ["actions"],
          template: "<div><button v-for='a in actions' :key='a.key' :data-key='a.key' @click='a.onClick()'>{{ a.label }}</button></div>",
        },
        BasicSwitch: true,
        NumberInput: true,
      },
    },
  });
  await wrapper.setProps({ visible: true });
  await flushPromises();
  return wrapper;
}

const multiSelects = (wrapper) => wrapper.findAllComponents(SelectProbe).filter((s) => s.props("multiple") !== undefined);
const save = (wrapper) => wrapper.find("button[data-key='save']").trigger("click");

describe("FilterEditDrawer — multi selects", () => {
  beforeEach(() => {
    mockCategories
      .mockReset()
      .mockResolvedValue({ data: { results: [{ idx: "shoes", name: "Shoes" }, { idx: "hats" }], next: null } });
    mockCategory.mockReset();
    mockPostProduct.mockReset().mockResolvedValue({ data: {} });
    mockPostCustomer.mockReset().mockResolvedValue({ data: {} });
  });

  it("shows categories by name with the idx as the second line and posts the chosen ones", async () => {
    const wrapper = await openDrawer("product");
    const categories = multiSelects(wrapper)[0];

    expect(categories.props("options")).toEqual([
      { label: "Shoes", description: "shoes", value: "shoes" },
      { label: "hats", description: "hats", value: "hats" },
    ]);
    await categories.vm.$emit("update:modelValue", ["hats"]);
    await save(wrapper);
    await flushPromises();

    expect(mockPostProduct).toHaveBeenCalledWith("default", 7, expect.objectContaining({ categories: ["hats"] }));
  });

  it("labels a saved category that is not on the loaded page, from the detail endpoint", async () => {
    mockCategory.mockResolvedValue({ data: { idx: "deep-1", name: "Deep one" } });
    const wrapper = await openDrawer("product", { categories: ["deep-1"] });
    const labels = multiSelects(wrapper)[0].props("options").map((o) => o.label);

    expect(mockCategory).toHaveBeenCalledWith("default", "deep-1");
    expect(labels).toEqual(["Deep one", "Shoes", "hats"]);
  });

  it("searches categories on the server and pages them with more", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockCategories.mockResolvedValueOnce({ data: { results: [{ idx: "a", name: "A" }], next: "page2" } });
    const wrapper = await openDrawer("product");
    const categories = multiSelects(wrapper)[0];
    expect(categories.attributes("more-label") ?? categories.props("moreLabel")).toBeTruthy();

    mockCategories.mockResolvedValue({ data: { results: [{ idx: "b", name: "B" }], next: null } });
    await categories.vm.$emit("more");
    await flushPromises();
    expect(mockCategories).toHaveBeenLastCalledWith("default", { page: 2, page_size: 50 });

    await categories.vm.$emit("search", "fl 10");
    await vi.advanceTimersByTimeAsync(350);
    expect(mockCategories).toHaveBeenLastCalledWith("default", { search: "fl 10", page: 1, page_size: 50 });
    vi.useRealTimers();
  });

  it("posts the chosen customer groups", async () => {
    const wrapper = await openDrawer("customer");
    const groups = multiSelects(wrapper)[0];

    expect(groups.props("options")).toEqual([{ label: "vip — VIP", value: "vip" }]);
    await groups.vm.$emit("update:modelValue", ["vip"]);
    await save(wrapper);
    await flushPromises();

    expect(mockPostCustomer).toHaveBeenCalledWith("default", 7, expect.objectContaining({ groups: ["vip"] }));
  });
});
