// Plan 61f: PriceDetail checks the money formats before the PATCH (real useFormErrors).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockPatchPmPrice = vi.fn();

vi.mock("@/api/pricemanager/api", () => ({
  GET_PmPriceDetail: vi.fn().mockResolvedValue({ data: { prices: [] } }),
  GET_PmPrices: vi.fn().mockResolvedValue({ data: { results: [] } }),
  PATCH_PmPrice: (...args) => mockPatchPmPrice(...args),
  DELETE_PmPrice: vi.fn(),
  POST_PmFlushSpecial: vi.fn(),
  GET_PmPriceHistory: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart: () => {}, loaderEnd: () => {}, loaderFinish: () => {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: () => {} }),
}));
vi.mock("@/functionals/Confirmation-modal/index.vue", () => ({ default: { template: "<div />" } }));

import PriceDetail from "@/views/PriceManager/PriceDetail.vue";

async function mountDetail() {
  const wrapper = mount(PriceDetail, {
    props: { sku: "CHAIR-001", channelIdxProp: "b2c-europe", embedded: true },
    global: {
      provide: {
        pmChannelIdx: "b2c-europe",
        pmActiveChannel: { calculate_direction: "from_net_to_gross", default_country: "PL" },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("PriceDetail.save — money format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchPmPrice.mockResolvedValue({ data: {} });
  });

  it("blocks the save and reports a field error on an invalid value", async () => {
    const wrapper = await mountDetail();
    wrapper.vm.form.value = "2.345";
    await wrapper.vm.$nextTick(); // the deep form watcher clears errors — let it run before save
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPatchPmPrice).not.toHaveBeenCalled();
    expect(wrapper.vm.formErrors.errors.value?.msg).toBeTruthy();
  });

  it("sends the PATCH for a valid value typed with a decimal comma", async () => {
    const wrapper = await mountDetail();
    wrapper.vm.form.value = "240,5";
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPatchPmPrice).toHaveBeenCalledTimes(1);
    expect(mockPatchPmPrice.mock.calls[0][2]).toMatchObject({ value: "240.5" });
  });
});
