import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { t } from "@/i18n";

const rows = vi.hoisted(() => ({ list: [] }));
const api = vi.hoisted(() => ({
  GET_LeadTypes: vi.fn(() => Promise.resolve({ data: { results: rows.list.map((row) => ({ ...row })) } })),
  POST_LeadType: vi.fn(() => Promise.resolve({ data: {} })),
  PATCH_LeadType: vi.fn(() => Promise.resolve({ data: {} })),
  DELETE_LeadType: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/api/leads/api", () => api);

import LeadTypes from "@/views/Leads/LeadTypes.vue";
import { fieldError, leadsFrame, setControl } from "./leadsFrame";

const mountScreen = async () => {
  const wrapper = mount(LeadTypes, { global: leadsFrame });
  await flushPromises();
  return wrapper;
};
const row = (wrapper, code) => wrapper.get(`[data-code="${code}"]`);

// UX-004: Leads → Settings → Lead types — the Stages pattern.
describe("Leads → Settings → Lead types", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    rows.list = [
      { id: 1, code: "RETAILER", label: "Retailer", order: 0, is_active: true },
      { id: 2, code: "WHOLESALE", label: "Wholesale", order: 10, is_active: true },
    ];
  });

  it("adds a type with an upper-case code after the last one", async () => {
    const wrapper = await mountScreen();
    await setControl(wrapper, "lead-type-new-code", "agency");
    await setControl(wrapper, "lead-type-new-label", "Agency");
    await wrapper.get('[data-testid="lead-type-add"]').trigger("submit");
    await flushPromises();
    expect(api.POST_LeadType).toHaveBeenCalledWith({ code: "AGENCY", label: "Agency", order: 20 });
  });

  it("renames, deactivates and reorders by PATCH", async () => {
    const wrapper = await mountScreen();
    const label = row(wrapper, "WHOLESALE").findComponent('[data-testid="lead-type-label"]');
    label.vm.$emit("update:modelValue", "B2B");
    label.vm.$emit("onFocusout");
    row(wrapper, "RETAILER").findComponent('[data-testid="lead-type-active"]').vm.$emit("update:modelValue", false);
    await flushPromises();
    expect(api.PATCH_LeadType).toHaveBeenCalledWith(2, { label: "B2B" });
    expect(api.PATCH_LeadType).toHaveBeenCalledWith(1, { is_active: false });
    api.PATCH_LeadType.mockClear();
    await row(wrapper, "WHOLESALE").findAll("button")[0].trigger("click");
    await flushPromises();
    expect(api.PATCH_LeadType.mock.calls).toEqual([[2, { order: 0 }], [1, { order: 10 }]]);
  });

  it("a type in use cannot be deleted: the 409 shows on its row", async () => {
    api.DELETE_LeadType.mockRejectedValueOnce({ error: "LEAD_TYPE_IN_USE", message: "companies still carry lead type 'RETAILER'" });
    const wrapper = await mountScreen();
    await row(wrapper, "RETAILER").get('[data-testid="lead-type-delete"]').trigger("click");
    await flushPromises();
    expect(row(wrapper, "RETAILER").get('[data-testid="lead-type-error"]').text()).toContain("companies still carry");
  });

  it("a move locks ↑/↓ until its PATCHes settle, and a failed reorder says so", async () => {
    let fail;
    api.PATCH_LeadType.mockImplementationOnce(() => new Promise((resolve, reject) => (fail = reject)));
    const wrapper = await mountScreen();
    await row(wrapper, "WHOLESALE").findAll("button")[0].trigger("click");
    const arrows = () => wrapper.findAll('[data-testid="lead-type-row"]').flatMap((r) => r.findAll("button").slice(0, 2));
    expect(arrows().every((button) => button.attributes("disabled") !== undefined)).toBe(true);
    fail({ message: "Order not saved" });
    await flushPromises();
    expect(wrapper.get('[data-testid="lead-type-order-error"]').text()).toBe("Order not saved");
    expect(row(wrapper, "RETAILER").findAll("button")[1].attributes("disabled")).toBeUndefined();
  });
});

// Plan 53: the label field (BasicInput) commits on blur and Enter like the native change did — only when it changed.
it("a blur without an edit renames nothing", async () => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  const wrapper = await mountScreen();
  row(wrapper, "RETAILER").findComponent('[data-testid="lead-type-label"]').vm.$emit("onFocusout");
  row(wrapper, "RETAILER").findComponent('[data-testid="lead-type-label"]').vm.$emit("onKeyDown");
  await flushPromises();
  expect(api.PATCH_LeadType).not.toHaveBeenCalled();
});

// Plan 53: the code is checked before the request, as the native pattern did.
it("a code outside letters, digits and _ is refused before the request", async () => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  const wrapper = await mountScreen();
  await setControl(wrapper, "lead-type-new-code", "B2B-SHOP");
  await setControl(wrapper, "lead-type-new-label", "Shop");
  await wrapper.get('[data-testid="lead-type-add"]').trigger("submit");
  await flushPromises();
  expect(api.POST_LeadType).not.toHaveBeenCalled();
  expect(wrapper.get('[data-testid="lead-type-add-error"]').text()).toBe(t("leads.lead_types.code_invalid"));
});

// Plan 56b: a refused rename is not remembered as saved; an empty label never reaches the API.
it("a failed rename is retried by the next blur", async () => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  api.PATCH_LeadType.mockRejectedValueOnce({ response: { data: { detail: "Busy" } } });
  const wrapper = await mountScreen();
  const label = () => row(wrapper, "RETAILER").findComponent('[data-testid="lead-type-label"]');
  label().vm.$emit("update:modelValue", "Shops");
  label().vm.$emit("onFocusout");
  await flushPromises();
  expect(wrapper.get('[data-testid="lead-type-error"]').text()).toBe("Busy");
  label().vm.$emit("onKeyDown");
  await flushPromises();
  expect(api.PATCH_LeadType.mock.calls).toEqual([[1, { label: "Shops" }], [1, { label: "Shops" }]]);
});

// Plan 61c: a rename that fails after a newer one was committed does not bring its old label back as saved.
it("a failed rename keeps a label committed while it ran", async () => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  let failFirst;
  api.PATCH_LeadType.mockReturnValueOnce(new Promise((_, reject) => (failFirst = reject))).mockImplementationOnce((id, body) => {
    rows.list[0].label = body.label;
    return Promise.resolve({ data: {} });
  });
  const wrapper = await mountScreen();
  const label = () => row(wrapper, "RETAILER").findComponent('[data-testid="lead-type-label"]');
  label().vm.$emit("update:modelValue", "Shops");
  label().vm.$emit("onFocusout");
  label().vm.$emit("update:modelValue", "Stores");
  label().vm.$emit("onKeyDown");
  await flushPromises();
  failFirst({ response: { data: { detail: "Busy" } } });
  await flushPromises();
  label().vm.$emit("onFocusout");
  await flushPromises();
  expect(api.PATCH_LeadType.mock.calls).toEqual([[1, { label: "Shops" }], [1, { label: "Stores" }]]);
});

it("an empty label is a field error before the request", async () => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  const wrapper = await mountScreen();
  await setControl(wrapper, "lead-type-new-code", "SHOP");
  await setControl(wrapper, "lead-type-new-label", "");
  await wrapper.get('[data-testid="lead-type-add"]').trigger("submit");
  await flushPromises();
  expect(api.POST_LeadType).not.toHaveBeenCalled();
  expect(fieldError(wrapper, "leads.lead_types.label")).toBe(t("leads.lead_types.label_required"));
});

describe("lead types store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    rows.list = [{ id: 1, code: "RETAILER", label: "Retailer", order: 0, is_active: true }];
  });

  it("a failed load is not cached: the next caller asks again; reset (logout) drops the list", async () => {
    const { useLeadTypesStore } = await import("@/stores/leadTypes");
    const store = useLeadTypesStore();
    api.GET_LeadTypes.mockRejectedValueOnce(new Error("offline"));
    await store.load();
    expect(store.all).toEqual([]);
    await store.load();
    expect(store.all.map((type) => type.code)).toEqual(["RETAILER"]);
    await store.load();
    expect(api.GET_LeadTypes).toHaveBeenCalledTimes(2);
    store.reset();
    expect(store.all).toEqual([]);
    await store.load();
    expect(api.GET_LeadTypes).toHaveBeenCalledTimes(3);
  });
});
