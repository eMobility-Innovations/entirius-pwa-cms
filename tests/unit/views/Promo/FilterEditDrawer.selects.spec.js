import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// The four product-filter pickers and the customer groups picker are BasicSelect `multiple` on `v-model` (plan 18):
// the chosen ids reach the payload, the options read "idx — name".
const mockPostProduct = vi.fn();
const mockPostCustomer = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Products: vi.fn(),
  GET_Categories: () => Promise.resolve({ data: { results: [{ idx: "shoes", name: "Shoes" }, { idx: "hats" }] } }),
  GET_Attributes: () => Promise.resolve({ data: { results: [] } }),
  GET_Features: () => Promise.resolve({ data: { results: [] } }),
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
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));

import FilterEditDrawer from "@/views/Promo/FilterEditDrawer.vue";

const SelectProbe = {
  name: "BasicSelect",
  props: ["options", "modelValue", "multiple", "placeholder"],
  emits: ["update:modelValue"],
  template: "<div class='select-probe' />",
};

async function openDrawer(kind) {
  const wrapper = mount(FilterEditDrawer, {
    props: { visible: false, kind, channel: "default", ruleId: 7 },
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
    mockPostProduct.mockReset().mockResolvedValue({ data: {} });
    mockPostCustomer.mockReset().mockResolvedValue({ data: {} });
  });

  it("labels categories as idx — name and posts the chosen ones", async () => {
    const wrapper = await openDrawer("product");
    const categories = multiSelects(wrapper)[0];

    expect(categories.props("options")).toEqual([
      { label: "shoes — Shoes", value: "shoes" },
      { label: "hats", value: "hats" },
    ]);
    await categories.vm.$emit("update:modelValue", ["hats"]);
    await save(wrapper);
    await flushPromises();

    expect(mockPostProduct).toHaveBeenCalledWith("default", 7, expect.objectContaining({ categories: ["hats"] }));
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
