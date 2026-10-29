import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const patchBulk = vi.fn();
const notify = vi.fn();
// The flat list (a currency filter): one row per country, every row of a SKU shares its currency.
const COUNTRY_ROWS = ["CH", "DE", "PL"].map((country) => ({ sku: "1C01/N", tax_class: "std", country, currency: "EUR", net: "232", gross: "285.36" }));

vi.mock("@/api/pricemanager/api", () => ({
  GET_PmPrices: () => Promise.resolve({ data: { results: COUNTRY_ROWS, count: 3 } }),
  GET_PmPriceDetail: vi.fn(),
  GET_PmPriceProducts: () => Promise.resolve({ data: { results: [] } }),
  PATCH_PmBulkPrices: (...args) => patchBulk(...args),
  DELETE_PmPrice: vi.fn(),
  POST_PmFlushSpecial: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import PriceList from "@/views/PriceManager/PriceList.vue";
import BasicInput from "@/boots/BasicInput/index.vue";
import FormField from "@/boots/FormField/index.vue";

async function mountList() {
  const wrapper = mount(PriceList, {
    global: {
      provide: { pmChannelIdx: "default-europe", pmActiveChannel: { calculate_direction: "from_net_to_gross" } },
      components: { BasicInput, FormField },
      stubs: { PmChannelSelect: true, BasicDatePicker: true, BasicInput: false, FormField: false, BasicTooltip: true },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("PriceList — money cells and the unsaved state (plan 61)", () => {
  it("shows a stored price with two places", async () => {
    const wrapper = await mountList();
    expect(wrapper.find(".pm-price-input input").element.value).toBe("232.00");
  });

  it("an edited price goes to the row as the API decimal", async () => {
    const wrapper = await mountList();
    await wrapper.find(".pm-price-input input").setValue("240,5");
    expect(wrapper.vm.dirtyRows.get("1C01/N|EUR").value).toBe("240.50");
  });

  it("the counter names the price and the rows it marks", async () => {
    const wrapper = await mountList();
    await wrapper.find(".pm-price-input input").setValue("240");
    expect(wrapper.findAll(".pm-price-table__row--dirty")).toHaveLength(3);
    expect(wrapper.vm.unsavedLabel).toBe('pm.unsaved_prices_rows::{"prices":1,"rows":3}');
  });

  it("a price typed back to its stored value leaves the row clean", async () => {
    const wrapper = await mountList();
    const input = wrapper.find(".pm-price-input input");
    await input.setValue("2321");
    expect(wrapper.vm.dirtyCount).toBe(1);
    await input.setValue("232");
    expect(wrapper.vm.dirtyCount).toBe(0);
  });

  it("an invalid price blocks the save: no request, a message", async () => {
    const wrapper = await mountList();
    await wrapper.find(".pm-price-input input").setValue("2.345");
    await wrapper.vm.saveAll();
    expect(patchBulk).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "formats.invalid_rows" });
  });

  it("a refused save marks the invalid cell: red border and its message, named by the input", async () => {
    const wrapper = await mountList();
    const input = wrapper.find(".pm-price-input input");
    await input.setValue("2.345");
    await wrapper.vm.saveAll();
    await flushPromises();
    const error = wrapper.find(".pm-price-input .form-field__error");
    expect(error.text()).toContain("Enter an amount with at most two decimal places");
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(input.attributes("aria-describedby")).toBe(error.attributes("id"));
    await input.setValue("2.34");
    expect(wrapper.find(".pm-price-input .form-field__error").exists()).toBe(false);
  });

  it("the refused-save marks go once no price is unsaved: a later invalid value waits for the next save", async () => {
    const wrapper = await mountList();
    const input = wrapper.find(".pm-price-input input");
    await input.setValue("2.345");
    await wrapper.vm.saveAll();
    await input.setValue("232");
    expect(wrapper.vm.dirtyCount).toBe(0);
    await input.setValue("2.345");
    await flushPromises();
    expect(wrapper.find(".pm-price-input .form-field__error").exists()).toBe(false);
  });
});
