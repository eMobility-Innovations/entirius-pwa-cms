// Plan 54b: a rule that failed to load must not be saved, deleted or toggled — the form under the header is the
// empty default, and a save would overwrite the stored rule with it.
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
  PATCH_DiscountRule: vi.fn(),
  DELETE_DiscountRule: vi.fn(),
}));
vi.mock("@/api/promo/api", () => api);
vi.mock("@/stores/checkoutChannel", () => ({
  useCheckoutChannelStore: () => ({ channels: [], activeChannelIdx: "default-europe", fetchChannels: vi.fn() }),
}));

import PromoEdit from "@/views/Promo/PromoEdit.vue";
import ActionBar from "@/boots/ActionBar/index.vue";
import BasicButton from "@/boots/BasicButton/index.vue";
import BasicSwitch from "@/boots/BasicSwitch/index.vue";

const empty = { data: { results: [], count: 0, modifiers: [], targets: [] } };
const rule = { data: { id: 7, name: "Summer", modifier: null, is_active: true, channels: [] } };


async function mountEdit(ruleResponse) {
  for (const fn of Object.values(api)) fn.mockResolvedValue(empty);
  if (ruleResponse instanceof Error) api.GET_DiscountRule.mockRejectedValue(ruleResponse);
  else api.GET_DiscountRule.mockResolvedValue(ruleResponse);
  const wrapper = mount(PromoEdit, {
    global: {
      plugins: [createPinia()],
      components: { ActionBar, BasicButton, BasicSwitch },
      stubs: { BasicButton, PageHeader: { template: "<div><slot name='actions' /></div>" } },
      mocks: { $route: { params: { id: "7" }, query: {} } },
    },
  });
  await flushPromises();
  return wrapper;
}

const disabledKeys = (wrapper) =>
  wrapper.findComponent(ActionBar).props("actions").filter((action) => action.disabled).map((action) => action.key);

describe("PromoEdit — failed rule load", () => {
  it("keeps Save, Delete and the Active switch disabled", async () => {
    const wrapper = await mountEdit(new Error("503"));
    expect(disabledKeys(wrapper)).toEqual(["delete", "save"]);
    expect(wrapper.findComponent(BasicSwitch).props("disabled")).toBe(true);
  });

  it("the rendered controls are inert: a click on Save or the switch sends and changes nothing", async () => {
    const wrapper = await mountEdit(new Error("503"));
    const save = wrapper.findAll(".action-bar button").find((button) => button.text() === "common.save");
    expect(save.attributes("disabled")).toBeDefined();
    const checked = wrapper.get('[role="switch"]').attributes("aria-checked");
    await save.trigger("click");
    await wrapper.get('[role="switch"]').trigger("click");
    await flushPromises();
    expect(api.PATCH_DiscountRule).not.toHaveBeenCalled();
    expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(checked);
    expect(wrapper.findComponent(BasicSwitch).emitted("update:modelValue")).toBeUndefined();
  });

  it("saveRule and deleteRule themselves refuse to run (saveAndLeave calls saveRule directly)", async () => {
    const wrapper = await mountEdit(new Error("503"));
    Object.assign(wrapper.vm.form, { name: "Filled in", modifier: "percentage" }); // past the required-field check
    await wrapper.vm.saveRule();
    await wrapper.vm.deleteRule();
    await flushPromises();
    expect(api.PATCH_DiscountRule).not.toHaveBeenCalled();
    expect(api.DELETE_DiscountRule).not.toHaveBeenCalled();
  });

  it("enables them once the rule loaded", async () => {
    const wrapper = await mountEdit(rule);
    expect(disabledKeys(wrapper)).toEqual([]);
    expect(wrapper.findComponent(BasicSwitch).props("disabled")).toBe(false);
  });
});
