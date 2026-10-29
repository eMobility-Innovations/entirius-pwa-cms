import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const push = vi.hoisted(() => vi.fn());
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
const api = vi.hoisted(() => ({
  GET_LeadTypes: vi.fn(() =>
    Promise.resolve({ data: { results: [{ code: "RETAILER", label: "Retailer", is_active: true }, { code: "OLD", label: "Old", is_active: false }] } })
  ),
  GET_Companies: vi.fn(() => Promise.resolve({ data: { results: [{ id: 104, name: "Example Shop 6", domain: "example-shop-6.test" }] } })),
  POST_Company: vi.fn(() => Promise.resolve({ data: { id: 200, name: "New Shop", domain: "new-shop.test" } })),
  POST_Contact: vi.fn(() => Promise.resolve({ data: { id: 300 } })),
}));
vi.mock("@/api/leads/api", () => api);

import CompanyNew from "@/views/Leads/CompanyNew.vue";
import { control, fieldError, leadsFrame, setControl } from "./leadsFrame";

const RouterLink = { props: ["to"], template: "<a :data-to='JSON.stringify(to)'><slot /></a>" };
const mountForm = () =>
  mount(CompanyNew, { global: { components: leadsFrame.components, stubs: { ...leadsFrame.stubs, RouterLink } } });
const fill = async (wrapper, fields) => {
  for (const [id, value] of Object.entries(fields)) await setControl(wrapper, `add-lead-${id}`, value);
};
const submit = async (wrapper) => {
  await wrapper.get('[data-testid="add-lead"]').trigger("submit");
  await flushPromises();
};

// UX-006: one lead by hand — the company, then its contact, then the company card.
describe("Leads — add one lead", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("offers the channel's active lead types and Unknown", async () => {
    const wrapper = mountForm();
    await flushPromises();
    const options = control(wrapper, "add-lead-type").props("options").map((option) => option.value);
    expect(options).toEqual(["UNKNOWN", "RETAILER"]);
  });

  it("creates the company, then its contact, and opens the company card", async () => {
    const wrapper = mountForm();
    await flushPromises();
    await fill(wrapper, { domain: "https://new-shop.test", type: "RETAILER", email: "anna@new-shop.test", "first-name": "Anna", basis: "legitimate_interest" });
    await submit(wrapper);
    expect(api.POST_Company).toHaveBeenCalledWith({ domain: "https://new-shop.test", lead_type: "RETAILER" });
    expect(api.POST_Contact).toHaveBeenCalledWith({ company_id: 200, email: "anna@new-shop.test", first_name: "Anna", legal_basis: "legitimate_interest" });
    expect(push).toHaveBeenCalledWith({ name: "LeadsThread", params: { id: 200 } });
  });

  it("a company without a contact skips the contact create", async () => {
    const wrapper = mountForm();
    await flushPromises();
    await fill(wrapper, { domain: "new-shop.test" });
    await submit(wrapper);
    expect(api.POST_Contact).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({ name: "LeadsThread", params: { id: 200 } });
  });

  it("a domain already in Leads says so with a link to that company, never a toast", async () => {
    api.POST_Company.mockRejectedValueOnce({ error: "DOMAIN_EXISTS", message: "company on example-shop-6.test already exists" });
    const wrapper = mountForm();
    await flushPromises();
    await fill(wrapper, { domain: "https://www.example-shop-6.test/pl" });
    await submit(wrapper);
    expect(api.GET_Companies).toHaveBeenCalledWith({ search: "example-shop-6.test" });
    const exists = wrapper.get('[data-testid="add-lead-exists"]');
    expect(exists.text()).toContain("Example Shop 6");
    expect(JSON.parse(exists.get("a").attributes("data-to"))).toEqual({ name: "LeadsThread", params: { id: 104 } });
    expect(push).not.toHaveBeenCalled();
  });

  it("a field error shows under its field", async () => {
    api.POST_Company.mockRejectedValueOnce({ error: "VALIDATION_ERROR", message: "Invalid", details: [{ field: "domain", description: "Not a domain" }] });
    const wrapper = mountForm();
    await flushPromises();
    await fill(wrapper, { domain: "???" });
    await submit(wrapper);
    expect(fieldError(wrapper, "leads.add.domain")).toBe("Not a domain");
  });

  it("a failed contact keeps the saved company and retries the contact only", async () => {
    api.POST_Contact.mockRejectedValueOnce({ error: "VALIDATION_ERROR", message: "Invalid", details: [{ field: "email", description: "Enter a valid email" }] });
    const wrapper = mountForm();
    await flushPromises();
    await fill(wrapper, { domain: "new-shop.test", email: "anna@" });
    await submit(wrapper);
    expect(wrapper.get('[data-testid="add-lead-company-saved"]').text()).toContain("New Shop");
    expect(fieldError(wrapper, "leads.contacts.email")).toBe("Enter a valid email");
    expect(push).not.toHaveBeenCalled();
    await fill(wrapper, { email: "anna@new-shop.test" });
    await submit(wrapper);
    expect(api.POST_Company).toHaveBeenCalledTimes(1);
    expect(api.POST_Contact).toHaveBeenLastCalledWith({ company_id: 200, email: "anna@new-shop.test" });
    expect(push).toHaveBeenCalledWith({ name: "LeadsThread", params: { id: 200 } });
  });

  // Plan 53: Save is the PageHeader's one primary — disabled until a domain is typed, the same save as the form's.
  it("the header Save waits for a domain and saves like the form", async () => {
    const wrapper = mountForm();
    await flushPromises();
    expect(wrapper.get('[data-testid="add-lead-save"]').attributes("disabled")).toBe("true");
    await fill(wrapper, { domain: "new-shop.test" });
    expect(wrapper.get('[data-testid="add-lead-save"]').attributes("disabled")).toBe("false");
    await wrapper.get('[data-testid="add-lead-save"]').trigger("click");
    await flushPromises();
    expect(push).toHaveBeenCalledWith({ name: "LeadsThread", params: { id: 200 } });
  });

  it("Enter in a field saves once a domain is typed, never before", async () => {
    const wrapper = mountForm();
    await flushPromises();
    const enter = () => wrapper.get('[data-testid="add-lead"] input').trigger("keydown", { key: "Enter" });
    await wrapper.get('[data-testid="add-lead"]').element.insertAdjacentHTML("afterbegin", "<input />");
    await enter();
    await flushPromises();
    expect(api.POST_Company).not.toHaveBeenCalled();
    await fill(wrapper, { domain: "new-shop.test" });
    await enter();
    await flushPromises();
    expect(api.POST_Company).toHaveBeenCalledTimes(1);
  });
});
