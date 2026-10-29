// Plan 61f: editing a discount code checks only the formatted values the operator changed — a stored legacy code
// (a space in it) never blocks changing its limits.
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";

const api = vi.hoisted(() => ({
  GET_DiscountMeta: vi.fn(),
  GET_ShippingMethods: vi.fn(),
  GET_Currencies: vi.fn(),
  GET_DiscountRule: vi.fn(),
  GET_DiscountCodes: vi.fn(),
  GET_ProductFilters: vi.fn(),
  GET_CustomerFilters: vi.fn(),
  GET_ThresholdFilters: vi.fn(),
  PATCH_DiscountCode: vi.fn(),
}));
vi.mock("@/api/promo/api", () => api);
vi.mock("@/stores/checkoutChannel", () => ({
  useCheckoutChannelStore: () => ({ channels: [], activeChannelIdx: "default-europe", fetchChannels: vi.fn() }),
}));

import PromoEdit from "@/views/Promo/PromoEdit.vue";

const empty = { data: { results: [], count: 0, modifiers: [], targets: [] } };
const rule = { data: { id: 7, name: "Summer", modifier: null, is_active: true, channels: [] } };
const legacyCode = { id: 3, code: "OLD CODE", max_used: 5, current_used: 1 };

async function openLegacyCode() {
  vi.clearAllMocks();
  for (const fn of Object.values(api)) fn.mockResolvedValue(empty);
  api.GET_DiscountRule.mockResolvedValue(rule);
  const wrapper = mount(PromoEdit, {
    shallow: true,
    global: { plugins: [createPinia()], mocks: { $route: { params: { id: "7" }, query: {} } } },
  });
  await flushPromises();
  wrapper.vm.openEditCode(legacyCode);
  return wrapper;
}

describe("PromoEdit — edit code formats", () => {
  it("an unchanged legacy code saves the other changes", async () => {
    const wrapper = await openLegacyCode();
    wrapper.vm.editCode.max_used = 10;
    await wrapper.vm.saveEditCode();
    expect(api.PATCH_DiscountCode).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      3,
      expect.objectContaining({ code: "OLD CODE", max_used: 10 }),
    );
  });

  it("a changed invalid code blocks the save with a field error and no request", async () => {
    const wrapper = await openLegacyCode();
    wrapper.vm.editCode.code = "NEW CODE";
    await wrapper.vm.saveEditCode();
    expect(api.PATCH_DiscountCode).not.toHaveBeenCalled();
    expect(wrapper.vm.codeFormErrors.errors.code).toBeTruthy();
  });
});
