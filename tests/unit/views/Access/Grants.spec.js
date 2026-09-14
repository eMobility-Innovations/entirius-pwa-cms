import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// vi.mock hoists, so the shared refs are declared first and the factory spreads into them.
const mockGetGrants = vi.fn();
const mockPostGrant = vi.fn();
const mockDeleteGrant = vi.fn();
const mockGetGroups = vi.fn();
const mockGetUsers = vi.fn();

vi.mock("@/api/access/api", () => ({
  GET_Grants: (...a) => mockGetGrants(...a),
  POST_Grant: (...a) => mockPostGrant(...a),
  DELETE_Grant: (...a) => mockDeleteGrant(...a),
  GET_Groups: (...a) => mockGetGroups(...a),
  GET_Users: (...a) => mockGetUsers(...a),
}));

import Grants from "@/views/Access/Grants.vue";
import { useAccessMatrixStore } from "@/stores/accessMatrix";

const GRANTS = [
  {
    id: 1,
    role: "SYSADMIN",
    grantee_type: "user",
    grantee: "patryk",
    group_name: null,
    name_resolved: true,
    granted_by: "ops",
  },
  {
    id: 2,
    role: "USER",
    grantee_type: "group",
    grantee: "grp-dead-uuid",
    group_name: null,
    name_resolved: false,
    granted_by: "ops",
  },
];

async function mountWith(canWrite) {
  setActivePinia(createPinia());
  const store = useAccessMatrixStore();
  store.me = {
    permissions: canWrite ? ["page:access", "feature:edit_role_mappings"] : ["page:access"],
  };
  store.catalog = { roles: ["SYSADMIN", "ADMIN", "USER"], pages: [], features: [] };
  const wrapper = mount(Grants);
  await flushPromises();
  return wrapper;
}

describe("the grants view", () => {
  beforeEach(() => {
    mockGetGrants.mockReset().mockResolvedValue({ data: GRANTS });
    mockGetGroups.mockReset().mockResolvedValue({ data: [] });
    mockGetUsers.mockReset().mockResolvedValue({ data: [] });
    mockPostGrant.mockReset().mockResolvedValue({ data: {} });
    mockDeleteGrant.mockReset().mockResolvedValue({});
  });

  it("submits a group by NAME so the server resolves the key", async () => {
    const wrapper = await mountWith(true);
    await wrapper.vm.createGrant({ role: "USER", granteeKind: "group", groupName: "buyers" });
    expect(mockPostGrant).toHaveBeenCalledWith({ role: "USER", group_name: "buyers" });
  });

  it("submits a person by their KEYCLOAK username", async () => {
    const wrapper = await mountWith(true);
    await wrapper.vm.createGrant({ role: "USER", granteeKind: "user", kcUsername: "patryk" });
    expect(mockPostGrant).toHaveBeenCalledWith({ role: "USER", user: "patryk" });
  });

  it("marks a group grant whose key the directory no longer knows", async () => {
    const wrapper = await mountWith(true);
    // setup.js stubs $t to return the key verbatim, so the raw key is what renders.
    expect(wrapper.text()).toContain("access.unresolved_group");
  });

  it("offers no write controls to somebody who may only read", async () => {
    const wrapper = await mountWith(false);
    expect(wrapper.find('[data-test="revoke-1"]').exists()).toBe(false);
  });

  it("says the directory is unreachable rather than showing an empty group list", async () => {
    mockGetGroups.mockRejectedValue({ error: { message: "Keycloak unreachable" } });
    const wrapper = await mountWith(true);
    expect(wrapper.text()).toContain("Keycloak unreachable");
  });
});
