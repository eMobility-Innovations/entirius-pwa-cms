import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Plan 17: the Dropdown `@onSelect` handlers now hang on BasicSelect `@update:model-value`; picking a value must
// still reach them with the value (not an array).
vi.mock("@/api/pricemanager/api", () => ({
  GET_PmChannels: vi.fn().mockResolvedValue({ data: [{ idx: "b2c", name: "B2C" }, { idx: "b2b", name: "B2B" }] }),
  GET_PmChannel: vi.fn(),
  POST_PmChannel: vi.fn(),
  PATCH_PmChannel: vi.fn(),
  DELETE_PmChannel: vi.fn(),
  GET_PmTaxClasses: vi.fn().mockResolvedValue({ data: [] }),
  GET_PmTaxClass: vi.fn(),
  GET_PmPrices: vi.fn().mockResolvedValue({ data: { results: [] } }),
  GET_PmPriceDetail: vi.fn().mockResolvedValue({ data: { prices: [] } }),
  GET_PmPriceProducts: vi.fn().mockResolvedValue({ data: { results: [] } }),
  PATCH_PmPrice: vi.fn(),
  DELETE_PmPrice: vi.fn(),
  POST_PmFlushSpecial: vi.fn(),
  GET_PmPriceHistory: vi.fn(),
  POST_PmPrice: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderEnd() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));
vi.mock("vue-router", () => ({ useRoute: () => ({ name: "PmPriceList" }) }));

import { GET_PmPrices } from "@/api/pricemanager/api";
import PmPanel from "@/views/PriceManager/index.vue";
import PmChannelSelect from "@/views/PriceManager/PmChannelSelect.vue";
import ChannelDetail from "@/views/PriceManager/ChannelDetail.vue";
import PriceList from "@/views/PriceManager/PriceList.vue";
import PriceDetail from "@/views/PriceManager/PriceDetail.vue";

const BasicSelect = {
  name: "BasicSelect",
  props: ["modelValue", "options"],
  emits: ["update:modelValue"],
  template: "<div />",
};
const stubs = {
  Teleport: true,
  RouterView: true,
  IconButton: true,
  ConfirmDialog: true,
  DataTable: true,
  BasicSelect,
  FormField: { template: "<div><slot /></div>" },
};
const pick = (wrapper, value, at = 0) =>
  wrapper.findAllComponents({ name: "BasicSelect" })[at].vm.$emit("update:modelValue", value);

describe("PriceManager pickers on BasicSelect", () => {
  it("panel: picking a channel in the header selector makes it the active channel", async () => {
    // The routed view renders the selector (PageHeader meta); it reads and sets the panel's channel.
    const wrapper = mount(PmPanel, { global: { stubs: { ...stubs, RouterView: PmChannelSelect } } });
    await flushPromises();
    const select = wrapper.findComponent({ name: "BasicSelect" });
    expect(select.props("modelValue")).toBe("b2c");
    await pick(wrapper, "b2b");
    expect(select.props("modelValue")).toBe("b2b");
  });

  it("channel detail: deselecting a country toggles it off and drops it as the default", async () => {
    const wrapper = mount(ChannelDetail, { global: { stubs } });
    await flushPromises();
    wrapper.vm.form.calculate_country_codes = ["PL", "DE"];
    wrapper.vm.form.default_country_code = "DE";
    await pick(wrapper, ["PL"], 1);
    expect(wrapper.vm.form.calculate_country_codes).toEqual(["PL"]);
    expect(wrapper.vm.form.default_country_code).toBe(null);
    await pick(wrapper, ["PL", "CZ"], 1);
    expect(wrapper.vm.form.calculate_country_codes).toEqual(["PL", "CZ"]);
  });

  it("channel detail: direction and default country store the picked value itself", async () => {
    const wrapper = mount(ChannelDetail, { global: { stubs } });
    await flushPromises();
    await pick(wrapper, "from_gross_to_net", 0);
    expect(wrapper.vm.form.calculate_direction).toBe("from_gross_to_net");
    wrapper.vm.form.calculate_country_codes = ["PL"];
    await pick(wrapper, "PL", 2);
    expect(wrapper.vm.form.default_country_code).toBe("PL");
  });

  it("price list: toggles the picked currency, keeps at least one", async () => {
    GET_PmPrices.mockResolvedValue({ data: { results: [{ currency: "EUR" }, { currency: "PLN" }] } });
    const wrapper = mount(PriceList, { global: { stubs, provide: { pmChannelIdx: "b2c", pmActiveChannel: null } } });
    await flushPromises();
    expect(wrapper.vm.selectedCurrencies).toEqual(["EUR", "PLN"]);
    await pick(wrapper, ["PLN"]);
    expect(wrapper.vm.selectedCurrencies).toEqual(["PLN"]);
    expect(wrapper.vm.activeCurrency).toBe("PLN");
    await pick(wrapper, []);
    expect(wrapper.vm.selectedCurrencies).toEqual(["PLN"]);
  });

  it("price detail: picking a currency makes it active", async () => {
    const wrapper = mount(PriceDetail, {
      props: { sku: "CHAIR-001", channelIdxProp: "b2c", embedded: true },
      global: { stubs, provide: { pmChannelIdx: "b2c", pmActiveChannel: null } },
    });
    await flushPromises();
    await wrapper.setData({ productNotFound: false, loading: false });
    await pick(wrapper, "EUR");
    expect(wrapper.vm.activeCurrency).toBe("EUR");
  });
});
