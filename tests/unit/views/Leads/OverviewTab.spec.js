import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const munin = vi.hoisted(() => ({ isModuleInstalled: vi.fn(() => false) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => munin }));
vi.mock("vue-router", () => ({ useRoute: () => ({ fullPath: "/leads/companies/100" }) }));

import OverviewTab from "@/views/Leads/tabs/OverviewTab.vue";
import { leadsFrame } from "./leadsFrame";

const { components } = leadsFrame;

const company = {
  name: "Example Shop 2",
  domain: "example-shop-2.test",
  lead_type: "UNKNOWN",
  stage: { label: "New" },
  last_activity_at: null,
  customer_uid: "91010000-0000-0000-0000-000000000000",
  customer_name: "Jan Kowalski",
  activities: [
    { id: 1, created_at: null, message: "draft review_required" },
    { id: 2, created_at: null, message: "blocked: no_eligible_contact" },
    { id: 3, created_at: null, message: "legal basis None -> legitimate_interest" },
    { id: 4, created_at: null, message: "stage new -> replied" },
  ],
};

// FIX-17 item 14: no raw uid, no raw status and no raw enum value on the Overview tab.
describe("Company overview tab", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("names the customer, the lead type and the activity status", () => {
    const text = mount(OverviewTab, { props: { company }, global: { components } }).text();
    expect(text).toContain("Jan Kowalski");
    expect(text).not.toContain("91010000");
    expect(text).toContain("Type unknown");
    expect(text).toContain("Draft — to review");
    expect(text).not.toContain("review_required");
  });

  it("falls back to the uid while the name is unknown", () => {
    const text = mount(OverviewTab, { props: { company: { ...company, customer_name: "" } }, global: { components } }).text();
    expect(text).toContain("91010000-0000-0000-0000-000000000000");
  });

  // FIX-17b item 1: every activity line reads as a sentence — no snake_case, no None, no ASCII arrow.
  it("reads the activity lines as sentences", () => {
    const text = mount(OverviewTab, { props: { company }, global: { components } }).text();
    expect(text).toContain("Blocked: no eligible contact");
    expect(text).toContain("Legal basis set to legitimate interest");
    expect(text).toContain("Stage: new → replied");
    expect(text).not.toMatch(/no_eligible|None|->/);
  });

  // FIX-17b item 4: with accounts the Customer row links to the customer, with the way back to this card.
  it("links the customer row when accounts is installed", () => {
    munin.isModuleInstalled.mockReturnValue(true);
    const RouterLink = { props: ["to"], template: "<a :data-uid='to.params.uid' :data-back='to.query.back'><slot /></a>" };
    const link = mount(OverviewTab, { props: { company }, global: { components, stubs: { RouterLink } } }).get('[data-testid="overview-customer"] a');
    expect(link.attributes("data-uid")).toBe(company.customer_uid);
    expect(link.attributes("data-back")).toBe("/leads/companies/100");
    expect(link.text()).toBe("Jan Kowalski");
    munin.isModuleInstalled.mockReturnValue(false);
  });

  // Plan 57: a truncated cell adds nothing to a max-content track, so the field names were cut to the header's width.
  it("keeps the field names whole", () => {
    const wrapper = mount(OverviewTab, { props: { company }, global: { components } });
    const cells = wrapper.findAll(".data-table__cell").filter((cell) => cell.text() === "Last activity");
    expect(cells).toHaveLength(1);
    expect(cells[0].classes()).not.toContain("data-table__cell--truncate");
  });
});
