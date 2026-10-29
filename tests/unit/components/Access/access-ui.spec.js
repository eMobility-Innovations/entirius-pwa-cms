import { describe, it, expect, vi, beforeEach } from "vitest";
import { reactive } from "vue";
import { mount, shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// Plan 18: Home's access notices, the non-staff wall (also as App's branch) and content create from `me`.
const access = reactive({});
vi.mock("@/stores/access", () => ({ useAccessStore: () => access }));
const logout = vi.fn();
const user = reactive({ isAuth: true, user: {}, appInit: vi.fn(), logout });
vi.mock("@/stores/user", () => ({ useUserStore: () => user }));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isModuleEnabled: () => false, healthAvailable: false, ensureLoaded: vi.fn() }),
}));
vi.mock("@/utils/env-check", () => ({ envStatus: { valid: true } }));
vi.mock("vue-router", () => ({ useRoute: () => ({ path: "/", meta: {}, params: {}, query: {} }), useRouter: () => null }));

import AccessNotices from "@/components/Access/AccessNotices.vue";
import StaffOnlyWall from "@/components/Access/StaffOnlyWall.vue";
import App from "@/App.vue";
import Builds from "@/views/Builder/Builds.vue";

const STATE = { status: "ready", deniedPanel: null, managesAccess: false, gateMode: "enforce", isStaff: true };
const set = (state) => Object.assign(access, STATE, { ensureLoaded: vi.fn() }, state);
const testids = (wrapper) => wrapper.findAll("[data-testid]").map((el) => el.attributes("data-testid"));

describe("AccessNotices (Home)", () => {
  beforeEach(() => set({}));

  it("shows nothing for a user with permissions and an enforcing gate", () => {
    expect(mount(AccessNotices).html()).not.toContain("access-notice");
  });

  it("warns an access manager when the gate does not enforce", () => {
    set({ managesAccess: true, gateMode: "observe" });
    const wrapper = mount(AccessNotices);
    expect(testids(wrapper)).toEqual(["access-gate-mode"]);
    expect(wrapper.text()).toContain('access.gate_mode::{"mode":"observe"}');
  });

  it("says nothing about a gate mode `me` does not carry", () => {
    set({ managesAccess: true, gateMode: null });
    expect(testids(mount(AccessNotices))).toEqual([]);
  });

  it("never warns a user who does not manage access", () => {
    set({ managesAccess: false, gateMode: "off" });
    expect(testids(mount(AccessNotices))).toEqual([]);
  });

  it("names a refused panel from the registry and forgets it on leaving Home", () => {
    set({ deniedPanel: "pim" });
    const wrapper = mount(AccessNotices);
    expect(wrapper.text()).toContain("access.denied_panel");
    expect(wrapper.text()).toContain("PIM");
    wrapper.unmount();
    expect(access.deniedPanel).toBeNull();
  });

  it("offers a retry when the permissions failed to load", async () => {
    set({ status: "error" });
    const wrapper = mount(AccessNotices);
    expect(testids(wrapper)).toContain("access-load-failed");
    await wrapper.find("[data-testid='access-load-failed'] basic-button-stub").trigger("click");
    expect(access.ensureLoaded).toHaveBeenCalled();
  });
});

describe("non-staff wall", () => {
  beforeEach(() => {
    set({ isStaff: false });
    logout.mockClear();
  });

  it("tells a customer account it has no admin access and logs it out", async () => {
    const wrapper = mount(StaffOnlyWall);
    expect(wrapper.text()).toContain("access.staff_only_title");
    await wrapper.find("[data-testid='staff-only-logout']").trigger("click");
    expect(logout).toHaveBeenCalled();
  });

  it("replaces the shell in App for a non-staff `me`", () => {
    setActivePinia(createPinia());
    const wrapper = shallowMount(App, { global: { mocks: { $router: { afterEach: vi.fn() } } } });
    expect(wrapper.findComponent(StaffOnlyWall).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "SidebarNav" }).exists()).toBe(false);
  });
});

describe("Builds canCreate", () => {
  const canCreate = (accessState, buildTypes = []) =>
    Builds.computed.canCreate.call({ access: accessState, user: { buildTypes } });

  it("follows content.pages write when django-access is there", () => {
    const can = (area, level) => area === "content.pages" && level === "write";
    expect(canCreate({ available: true, can })).toBe(true);
    expect(canCreate({ available: true, can: () => false }, [{ actions: ["create"] }])).toBe(false);
  });

  it("keeps the content-permissions logic without it", () => {
    expect(canCreate({ available: false }, [{ actions: ["create"] }])).toBe(true);
    expect(canCreate({ available: false }, [{ actions: ["read"] }])).toBe(false);
  });
});
