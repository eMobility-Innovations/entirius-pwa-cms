// A discount code is unique per channel and currency (django-checkout): the v2 admin API refuses a clash with 400
// VALIDATION_ERROR, issue UNIQUE, on `code`, `codes.<i>.code`, `currencies` or `channels`. The form shows the refusal on
// that field in the UI language; the toast keeps the server's sentence, which names the other rule.
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
  POST_DiscountCode: vi.fn(),
  PATCH_DiscountCode: vi.fn(),
  PATCH_DiscountRule: vi.fn(),
}));
vi.mock("@/api/promo/api", () => api);
vi.mock("@/stores/checkoutChannel", () => ({
  useCheckoutChannelStore: () => ({ channels: [], activeChannelIdx: "default-europe", fetchChannels: vi.fn() }),
}));
const spawnNotification = vi.hoisted(() => vi.fn());
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));

import PromoEdit from "@/views/Promo/PromoEdit.vue";
import { codeClash } from "@/views/Promo/promo-code-clash";

const empty = { data: { results: [], count: 0, modifiers: [], targets: [] } };
const rule = { data: { id: 7, name: "Summer", modifier: "percent", is_active: true, channels: ["default-europe"] } };
const stored = { id: 3, code: "SUMMER", max_used: 5, current_used: 1 };
const SENTENCE =
  "Code 'SUMMER' is already used by discount rule 140 in channel default-europe for EUR; a code is unique per channel and currency.";

// The body as createClient rejects it (unwrapped, any status but 401/403).
const refusal = (field, issue = "UNIQUE") => ({
  error: "VALIDATION_ERROR",
  message: "Request validation failed.",
  debug_id: "ab12cd34",
  details: [{ field, location: "body", issue, description: SENTENCE }],
});

// The view's fields resolve FormField globally (register-elems): registered here, so the spec can read its `error`.
const FormField = { name: "FormField", props: ["label", "hint", "hintLevel", "required", "error"], template: "<div><slot /></div>" };

// Shallow, with the page's default slot rendered: the fields are in it.
async function openRule() {
  vi.clearAllMocks();
  for (const fn of Object.values(api)) fn.mockResolvedValue(empty);
  api.GET_DiscountRule.mockResolvedValue(rule);
  const wrapper = mount(PromoEdit, {
    shallow: true,
    global: {
      plugins: [createPinia()],
      components: { FormField },
      renderStubDefaultSlot: true,
      mocks: { $route: { params: { id: "7" }, query: {} } },
    },
  });
  await flushPromises();
  return wrapper;
}

const lastToast = () => spawnNotification.mock.calls.at(-1)[0];

describe("codeClash", () => {
  it("reads the field of a clash from the body or an axios error, by its form key", () => {
    expect(codeClash(refusal("code"))).toEqual({ field: "code", description: SENTENCE });
    expect(codeClash({ response: { data: refusal("codes.0.code") } })).toEqual({ field: "code", description: SENTENCE });
    expect(codeClash(refusal("currencies"))?.field).toBe("currencies");
    expect(codeClash(refusal("channels"))?.field).toBe("channels");
  });

  it("is null for any other refusal", () => {
    expect(codeClash(refusal("code", "INVALID"))).toBeNull();
    expect(codeClash(refusal("name"))).toBeNull();
    expect(codeClash(new Error("Network Error"))).toBeNull();
    expect(codeClash(undefined)).toBeNull();
  });
});

describe("PromoEdit — a code that clashes in a channel and currency", () => {
  it("a new code shows the clash on its field and the server's sentence in the toast", async () => {
    const wrapper = await openRule();
    wrapper.vm.openAddCode();
    wrapper.vm.newCode.code = "SUMMER";
    await wrapper.vm.$nextTick();
    api.POST_DiscountCode.mockRejectedValue(refusal("code"));
    await wrapper.vm.saveNewCode();
    expect(wrapper.vm.codeFormErrors.getFieldError("code")?.msg).toBe("promo.code_clash");
    expect(wrapper.vm.showAddCode).toBe(true);
    expect(lastToast()).toEqual({ type: "negative", msg: SENTENCE });
  });

  it("a renamed code keeps the dialog open with the clash on its field", async () => {
    const wrapper = await openRule();
    wrapper.vm.openEditCode(stored);
    wrapper.vm.editCode.code = "WINTER";
    await wrapper.vm.$nextTick();
    api.PATCH_DiscountCode.mockRejectedValue(refusal("code"));
    await wrapper.vm.saveEditCode();
    expect(wrapper.vm.showEditCodeModal).toBe(true);
    expect(wrapper.vm.codeFormErrors.getFieldError("code")?.msg).toBe("promo.code_clash");
    expect(lastToast()).toEqual({ type: "negative", msg: SENTENCE });
  });

  it("editing the code again clears the clash", async () => {
    const wrapper = await openRule();
    wrapper.vm.openEditCode(stored);
    api.PATCH_DiscountCode.mockRejectedValue(refusal("code"));
    await wrapper.vm.saveEditCode();
    wrapper.vm.editCode.code = "WINTER";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.codeFormErrors.getFieldError("code")).toBeNull();
  });

  it("an error that names no field still closes the dialog", async () => {
    const wrapper = await openRule();
    wrapper.vm.openEditCode(stored);
    api.PATCH_DiscountCode.mockRejectedValue({ error: "INTERNAL_ERROR", message: "Internal server error [x1]" });
    await wrapper.vm.saveEditCode();
    expect(wrapper.vm.showEditCodeModal).toBe(false);
    expect(lastToast()).toEqual({ type: "negative", msg: "Internal server error [x1]" });
  });

  it.each(["currencies", "channels"])("a rule scope that makes a code clash shows it under %s", async (field) => {
    const wrapper = await openRule();
    api.PATCH_DiscountRule.mockRejectedValue(refusal(field));
    await wrapper.vm.saveRule();
    expect(wrapper.vm.formErrors.getFieldError(field)?.msg).toBe("promo.code_clash_scope");
    expect(lastToast()).toEqual({ type: "negative", msg: SENTENCE });
    await wrapper.vm.$nextTick();
    const fields = wrapper.findAllComponents({ name: "FormField" }).map((f) => f.props("error"));
    expect(fields).toContain("promo.code_clash_scope");
  });

  it("another refusal of the rule keeps the server's text on its field", async () => {
    const wrapper = await openRule();
    api.PATCH_DiscountRule.mockRejectedValue(refusal("name", "INVALID"));
    await wrapper.vm.saveRule();
    expect(wrapper.vm.formErrors.getFieldError("name")?.msg).toBe(SENTENCE);
    expect(lastToast()).toEqual({ type: "negative", msg: "Request validation failed." });
  });
});
