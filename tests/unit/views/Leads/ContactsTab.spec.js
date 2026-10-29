import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const leads = vi.hoisted(() => ({
  POST_Contact: vi.fn(() =>
    Promise.resolve({ status: 201, data: { id: 300 } })
  ),
  PATCH_Contact: vi.fn(() => Promise.resolve({ status: 200, data: {} })),
  DELETE_Contact: vi.fn(() => Promise.resolve({ status: 204, data: "" })),
}));
vi.mock("@/api/leads/api", () => leads);
vi.mock("@/api/communicator/api", () => ({
  GET_Suppressions: vi.fn(() => Promise.resolve({ data: { results: [] } })),
}));

import ContactsTab from "@/views/Leads/tabs/ContactsTab.vue";
import { fieldError, leadsFrame, setControl } from "./leadsFrame";

const contact = (fields) => ({
  first_name: "",
  last_name: "",
  job_title: "",
  phone: "",
  language: null,
  is_primary: false,
  legal_basis: null,
  opt_out_at: null,
  anonymised_at: null,
  ...fields,
});
const company = {
  id: 7,
  domain: "shop.pl",
  contacts: [
    contact({
      id: 1,
      email: "anna@shop.pl",
      first_name: "Anna",
      last_name: "Nowak",
      is_primary: true,
      legal_basis: "consent",
    }),
    contact({ id: 2, email: "", first_name: "Marek" }),
    contact({
      id: 3,
      email: "anon-1@anonymised.invalid",
      anonymised_at: "2026-09-01T10:00:00Z",
    }),
  ],
};

const mountTab = async () => {
  const wrapper = mount(ContactsTab, { props: { company }, global: leadsFrame });
  await flushPromises();
  return wrapper;
};
const rows = (wrapper) => wrapper.findAll(".data-table__row");
const fill = async (wrapper, prefix, fields) => {
  for (const [id, value] of Object.entries(fields))
    await setControl(wrapper, `${prefix}-${id}`, value);
};
const submit = async (wrapper, form) => {
  await wrapper.get(`[data-testid="${form}"]`).trigger("submit");
  await flushPromises();
};

// UX-011: contacts are managed in the company card — add, edit in place, remove, primary star.
describe("Company card — Contacts tab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the contact-row test id sits on the row: its star, Edit and Remove are inside it", async () => {
    const wrapper = await mountTab();
    const row = wrapper.findAll('[data-testid="contact-row"]')[0];
    expect(row.classes()).toContain("data-table__row");
    expect(row.attributes("data-contact")).toBeDefined();
    ["contact-primary", "contact-edit", "contact-remove"].forEach((id) => expect(row.find(`[data-testid="${id}"]`).exists()).toBe(true));
  });

  it("adds a contact with the add-lead fields plus job title, phone, language and primary", async () => {
    const wrapper = await mountTab();
    await wrapper.get('[data-testid="contact-add"]').trigger("click");
    await fill(wrapper, "contact-new", {
      email: "ola@shop.pl",
      "first-name": "Ola",
      "job-title": "CEO",
      language: "PL",
      basis: "consent",
    });
    await fill(wrapper, "contact-new", {
      "consent-ref": "call 2026-09-26",
      primary: true,
    });
    await submit(wrapper, "contact-add-form");
    expect(leads.POST_Contact).toHaveBeenCalledWith({
      company_id: 7,
      email: "ola@shop.pl",
      first_name: "Ola",
      job_title: "CEO",
      language: "pl",
      legal_basis: "consent",
      consent_ref: "call 2026-09-26",
      is_primary: true,
    });
    expect(wrapper.emitted("changed")).toHaveLength(1);
    expect(wrapper.find('[data-testid="contact-add-form"]').exists()).toBe(
      false
    );
    expect(wrapper.get('[data-testid="contact-status"]').text()).toBe(
      "Contact added."
    );
  });

  it("a duplicate email says so under the email field and keeps the form", async () => {
    leads.POST_Contact.mockRejectedValueOnce({
      error: "CONTACT_EXISTS",
      message: "contact anna@shop.pl already exists",
    });
    const wrapper = await mountTab();
    await wrapper.get('[data-testid="contact-add"]').trigger("click");
    await fill(wrapper, "contact-new", { email: "anna@shop.pl" });
    await submit(wrapper, "contact-add-form");
    expect(fieldError(wrapper, "leads.contacts.email")).toBe(
      "Already a contact of this company."
    );
    expect(wrapper.find('[data-testid="contact-error"]').exists()).toBe(false);
    expect(wrapper.emitted("changed")).toBeUndefined();
  });

  it("edits a row in the form above the table: email read-only once set, only the changed fields are sent", async () => {
    const wrapper = await mountTab();
    await rows(wrapper)[0].get('[data-testid="contact-edit"]').trigger("click");
    expect(
      wrapper.get('[data-testid="contact-edit-email"]').attributes("readonly")
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="contact-edit-consent-ref"]').exists()
    ).toBe(false); // consent already recorded
    await fill(wrapper, "contact-edit", {
      "last-name": "Kowalska",
      phone: "+48 600 000 000",
    });
    await submit(wrapper, "contact-edit-form");
    expect(leads.PATCH_Contact).toHaveBeenCalledWith(1, {
      last_name: "Kowalska",
      phone: "+48 600 000 000",
    });
    expect(wrapper.get('[data-testid="contact-status"]').text()).toBe(
      "Contact saved."
    );
  });

  it("a contact without an email gets one, and a cleared legal basis goes as null", async () => {
    const wrapper = await mountTab();
    await rows(wrapper)[1].get('[data-testid="contact-edit"]').trigger("click");
    const email = wrapper.get('[data-testid="contact-edit-email"]');
    expect(email.attributes("readonly")).toBeUndefined();
    await setControl(wrapper, "contact-edit-email", "marek@shop.pl");
    await submit(wrapper, "contact-edit-form");
    expect(leads.PATCH_Contact).toHaveBeenCalledWith(2, {
      email: "marek@shop.pl",
    });
  });

  it("a field error from the edit stays under its field", async () => {
    leads.PATCH_Contact.mockRejectedValueOnce({
      error: "VALIDATION_ERROR",
      message: "Invalid",
      details: [{ field: "language", description: "unknown language" }],
    });
    const wrapper = await mountTab();
    await rows(wrapper)[1].get('[data-testid="contact-edit"]').trigger("click");
    await fill(wrapper, "contact-edit", { language: "xx" });
    await submit(wrapper, "contact-edit-form");
    expect(fieldError(wrapper, "leads.contacts.language")).toBe(
      "unknown language"
    );
    expect(wrapper.find('[data-testid="contact-edit-form"]').exists()).toBe(
      true
    );
  });

  it("remove asks first; a never-used contact is deleted (204)", async () => {
    const wrapper = await mountTab();
    await rows(wrapper)[1]
      .get('[data-testid="contact-remove"]')
      .trigger("click");
    expect(leads.DELETE_Contact).not.toHaveBeenCalled();
    expect(wrapper.findComponent({ name: "ConfirmDialog" }).text()).toContain(
      'remove_title::{"name":"Marek"}'
    ); // $t is the key in tests
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger("click");
    await flushPromises();
    expect(leads.DELETE_Contact).toHaveBeenCalledWith(2);
    expect(wrapper.get('[data-testid="contact-status"]').text()).toBe(
      "Contact removed."
    );
    expect(wrapper.emitted("changed")).toHaveLength(1);
  });

  it("a used contact is anonymised instead (200) and the line says so", async () => {
    leads.DELETE_Contact.mockResolvedValueOnce({
      status: 200,
      data: { id: 1, anonymised_at: "2026-09-26T10:00:00Z" },
    });
    const wrapper = await mountTab();
    await rows(wrapper)[0]
      .get('[data-testid="contact-remove"]')
      .trigger("click");
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="contact-status"]').text()).toContain(
      "anonymised"
    );
  });

  it("cancel in the confirmation removes nothing", async () => {
    const wrapper = await mountTab();
    await rows(wrapper)[1]
      .get('[data-testid="contact-remove"]')
      .trigger("click");
    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger("click");
    expect(leads.DELETE_Contact).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="confirm-dialog-confirm"]').exists()).toBe(false);
  });

  it("the star toggles primary; an anonymised row has no star, edit or remove", async () => {
    const wrapper = await mountTab();
    const [primary, other, anonymised] = rows(wrapper);
    expect(
      primary.get('[data-testid="contact-primary"]').attributes("aria-pressed")
    ).toBe("true");
    await other.get('[data-testid="contact-primary"]').trigger("click");
    await flushPromises();
    expect(leads.PATCH_Contact).toHaveBeenCalledWith(2, { is_primary: true });
    await primary.get('[data-testid="contact-primary"]').trigger("click");
    await flushPromises();
    expect(leads.PATCH_Contact).toHaveBeenCalledWith(1, { is_primary: false });
    expect(wrapper.emitted("changed")).toHaveLength(2);
    expect(anonymised.find('[data-testid="contact-primary"]').exists()).toBe(
      false
    );
    expect(anonymised.find('[data-testid="contact-edit"]').exists()).toBe(
      false
    );
    expect(anonymised.find('[data-testid="contact-remove"]').exists()).toBe(
      false
    );
    expect(
      anonymised.findComponent({ name: "StatusBadge" }).attributes("label")
    ).toBe("leads.contacts.anonymised");
  });
});
