import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mockGetOverrides = vi.fn();
const mockPutUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockGetUsers = vi.fn();

vi.mock("@/api/access/api", () => ({
  GET_Overrides: (...a) => mockGetOverrides(...a),
  PUT_UserOverride: (...a) => mockPutUser(...a),
  DELETE_UserOverride: (...a) => mockDeleteUser(...a),
  GET_Users: (...a) => mockGetUsers(...a),
}));

import UserOverrides from "@/views/Access/UserOverrides.vue";
import { useAccessMatrixStore } from "@/stores/accessMatrix";

async function mountIt() {
  setActivePinia(createPinia());
  const store = useAccessMatrixStore();
  store.catalog = { roles: [], pages: ["page:catalogue"], features: [], effective: {} };
  store.me = { permissions: ["page:access", "feature:edit_role_mappings"] };
  const wrapper = mount(UserOverrides);
  await flushPromises();
  return wrapper;
}

describe("the per-person overrides", () => {
  beforeEach(() => {
    mockGetOverrides.mockReset().mockResolvedValue({
      data: { roles: [], users: [{ kc_username: "patryk", permissions: ["page:catalogue"] }] },
    });
    mockPutUser.mockReset().mockResolvedValue({});
    mockDeleteUser.mockReset().mockResolvedValue({});
    mockGetUsers.mockReset().mockResolvedValue({ data: [] });
  });

  it("keys a row on the KEYCLOAK username and renders no CMS username anywhere", async () => {
    const wrapper = await mountIt();
    expect(wrapper.vm.people).toEqual(["patryk"]);
    expect(wrapper.text()).toContain("patryk");
    expect(wrapper.text()).not.toContain("patryk_1");
  });

  it("saves an EMPTY set as an empty override rather than sending nothing", async () => {
    const wrapper = await mountIt();
    await wrapper.vm.save("patryk", []);
    expect(mockPutUser).toHaveBeenCalledWith("patryk", []);
  });

  it("clearing an override is a DELETE, not a save of the role's current set", async () => {
    const wrapper = await mountIt();
    await wrapper.vm.clear("patryk");
    expect(mockDeleteUser).toHaveBeenCalledWith("patryk");
    expect(mockPutUser).not.toHaveBeenCalled();
  });

  it("surfaces the server's refusal verbatim", async () => {
    const wrapper = await mountIt();
    mockPutUser.mockRejectedValue({ error: { message: "use manage.py escaccess_grant" } });
    await wrapper.vm.save("patryk", []);
    await flushPromises();
    expect(wrapper.text()).toContain("escaccess_grant");
  });
});
