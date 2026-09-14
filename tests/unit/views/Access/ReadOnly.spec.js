import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mockGetAudit = vi.fn();
const mockGetServiceAccounts = vi.fn();

vi.mock("@/api/access/api", () => ({
  GET_Audit: (...a) => mockGetAudit(...a),
  GET_ServiceAccounts: (...a) => mockGetServiceAccounts(...a),
}));

import AuditLog from "@/views/Access/AuditLog.vue";
import ServiceAccounts from "@/views/Access/ServiceAccounts.vue";

describe("the read-only tabs", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockGetAudit.mockReset();
    mockGetServiceAccounts.mockReset();
  });

  it("shows who made each change and how — UI or host command", async () => {
    mockGetAudit.mockResolvedValue({
      data: [
        {
          actor: "patryk",
          action: "grant",
          target: "user:silvana",
          details: { role: "USER", via: "api" },
          created_at: "2026-09-14T10:00:00Z",
        },
        {
          actor: "ops",
          action: "grant",
          target: "user:svc-nexus",
          details: { role: "USER", via: "escaccess_grant" },
          created_at: "2026-09-13T10:00:00Z",
        },
      ],
    });
    const wrapper = mount(AuditLog);
    await flushPromises();
    expect(wrapper.text()).toContain("patryk");
    // The `via` column is the point: a change made here and one made with manage.py sit in
    // one stream, and telling them apart is how somebody answers "who did this, and where".
    expect(wrapper.text()).toContain("escaccess_grant");
  });

  it("names the staff accounts nobody has classified", async () => {
    mockGetServiceAccounts.mockResolvedValue({
      data: {
        declared: [{ username: "svc-nexus", purpose: "Nexus Procurement Cockpit" }],
        unclassified_staff: ["leftover-admin"],
      },
    });
    const wrapper = mount(ServiceAccounts);
    await flushPromises();
    expect(wrapper.text()).toContain("leftover-admin");
  });

  it("offers no control that writes — these two tabs are read-only by construction", async () => {
    mockGetAudit.mockResolvedValue({ data: [] });
    mockGetServiceAccounts.mockResolvedValue({ data: { declared: [], unclassified_staff: [] } });
    const audit = mount(AuditLog);
    const accounts = mount(ServiceAccounts);
    await flushPromises();
    expect(audit.findAll("button")).toHaveLength(0);
    expect(accounts.findAll("button")).toHaveLength(0);
  });
});
