import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Plan 39: the promo dates moved from native date inputs to BasicDatePicker; a picked date must still reach the save
// payloads (the bulk save of the price list, the PATCH of the price detail) as the same "Y-m-d" string.
const PRICE = { sku: "CHAIR-001", currency: "EUR", tax_class: "standard", countries: [{ net: "10.00", gross: "12.30" }] };

vi.mock("@/api/pricemanager/api", () => ({
  GET_PmPrices: vi.fn(),
  GET_PmPriceDetail: vi.fn(),
  GET_PmPriceProducts: vi.fn(),
  PATCH_PmBulkPrices: vi.fn(),
  PATCH_PmPrice: vi.fn(),
  DELETE_PmPrice: vi.fn(),
  POST_PmFlushSpecial: vi.fn(),
  GET_PmPriceHistory: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));

import {
  GET_PmPrices,
  GET_PmPriceDetail,
  GET_PmPriceProducts,
  PATCH_PmBulkPrices,
  PATCH_PmPrice,
} from "@/api/pricemanager/api";
import PriceList from "@/views/PriceManager/PriceList.vue";
import PriceDetail from "@/views/PriceManager/PriceDetail.vue";

const BasicDatePicker = {
  name: "BasicDatePicker",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<div />",
};
const stubs = {
  BasicDatePicker,
  FormField: { template: "<div><slot /></div>" },
  BasicCard: { template: "<div><slot /></div>" },
  IconButton: true,
  ConfirmDialog: true,
  BasicSelect: true,
  ActionBar: true,
  RouterLink: true,
};
const provide = { pmChannelIdx: "b2c", pmActiveChannel: { calculate_direction: "from_net_to_gross" } };
const pickDate = (wrapper, at, value) =>
  wrapper.findAllComponents({ name: "BasicDatePicker" })[at].vm.$emit("update:modelValue", value);

beforeEach(() => {
  vi.clearAllMocks();
  GET_PmPrices.mockResolvedValue({ data: { results: [PRICE], count: 1 } });
  GET_PmPriceProducts.mockResolvedValue({ data: { results: [] } });
  GET_PmPriceDetail.mockResolvedValue({ data: { prices: [{ ...PRICE, country: "PL", net: "10.00" }] } });
});

describe("PriceManager promo dates on BasicDatePicker", () => {
  it("price list: a picked promo start marks the row dirty and goes out with the bulk save", async () => {
    PATCH_PmBulkPrices.mockResolvedValue({ data: { updated: 1, logged: 1 } });
    const wrapper = mount(PriceList, { global: { stubs, provide } });
    await flushPromises();

    await pickDate(wrapper, 0, "2026-10-01");
    expect(wrapper.vm.dirtyCount).toBe(1);
    await wrapper.vm.saveAll();

    const [, payload] = PATCH_PmBulkPrices.mock.calls[0];
    expect(payload.items[0]).toMatchObject({ sku: "CHAIR-001", special_from_date: "2026-10-01" });
  });

  it("price detail: picked promo dates go out with the price PATCH", async () => {
    PATCH_PmPrice.mockResolvedValue({ data: {} });
    const wrapper = mount(PriceDetail, {
      props: { sku: "CHAIR-001", channelIdxProp: "b2c", embedded: true },
      global: { stubs, provide },
    });
    await flushPromises();

    await pickDate(wrapper, 0, "2026-10-01");
    await pickDate(wrapper, 1, "2026-10-31");
    await wrapper.vm.save();

    expect(PATCH_PmPrice).toHaveBeenCalledWith(
      "b2c",
      "CHAIR-001",
      expect.objectContaining({ special_from_date: "2026-10-01", special_to_date: "2026-10-31" })
    );
  });
});
