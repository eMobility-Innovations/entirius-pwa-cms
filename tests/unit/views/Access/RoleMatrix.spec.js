import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mockGetOverrides = vi.fn();
const mockPutRole = vi.fn();
const mockDeleteRole = vi.fn();

vi.mock("@/api/access/api", () => ({
  GET_Overrides: (...a) => mockGetOverrides(...a),
  PUT_RoleOverride: (...a) => mockPutRole(...a),
  DELETE_RoleOverride: (...a) => mockDeleteRole(...a),
}));

import RoleMatrix from "@/views/Access/RoleMatrix.vue";
import { useAccessMatrixStore } from "@/stores/accessMatrix";

const CATALOG = {
  roles: ["SYSADMIN", "ADMIN", "USER"],
  pages: ["page:catalogue", "page:access"],
  features: ["feature:edit_role_mappings"],
  role_defaults: { USER: ["page:catalogue"], ADMIN: [], SYSADMIN: [] },
  effective: { USER: ["page:catalogue"], ADMIN: [], SYSADMIN: ["page:access"] },
};

async function mountIt() {
  setActivePinia(createPinia());
  const store = useAccessMatrixStore();
  store.catalog = CATALOG;
  store.me = { permissions: ["page:access", "feature:edit_role_mappings"] };
  const wrapper = mount(RoleMatrix);
  await flushPromises();
  return wrapper;
}

describe("the role matrix", () => {
  beforeEach(() => {
    mockGetOverrides.mockReset().mockResolvedValue({ data: { roles: [], users: [] } });
    mockPutRole.mockReset().mockResolvedValue({});
    mockDeleteRole.mockReset().mockResolvedValue({});
  });

  it("saves an EMPTY set as an empty override rather than sending nothing", async () => {
    const wrapper = await mountIt();
    await wrapper.vm.save("USER", []);
    expect(mockPutRole).toHaveBeenCalledWith("USER", []);
  });

  it("clearing an override is a DELETE, not a save of the defaults", async () => {
    const wrapper = await mountIt();
    await wrapper.vm.clear("USER");
    expect(mockDeleteRole).toHaveBeenCalledWith("USER");
    expect(mockPutRole).not.toHaveBeenCalled();
  });

  it("surfaces the refusal when a save would leave nobody able to edit the matrix", async () => {
    const wrapper = await mountIt();
    mockPutRole.mockRejectedValue({ error: { message: "use manage.py escaccess_grant" } });
    await wrapper.vm.save("SYSADMIN", ["page:catalogue"]);
    await flushPromises();
    expect(wrapper.text()).toContain("escaccess_grant");
  });

  it("seeds a role's boxes from its EFFECTIVE set when nothing overrides it", async () => {
    const wrapper = await mountIt();
    // Not role_defaults: what the checkbox must show is what the role carries TODAY,
    // which is the defaults only while no override is stored.
    expect(wrapper.vm.selected.SYSADMIN).toEqual(["page:access"]);
  });
});
