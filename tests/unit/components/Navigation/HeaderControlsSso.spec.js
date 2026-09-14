/**
 * "Change password" must not be offered to an account that has no password.
 *
 * In SSO-only deployments the identity provider owns the credential and the Django user
 * has `set_unusable_password()`, so the form cannot succeed — it can only waste the
 * user's time and look broken.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/api/contentDB/api", () => ({ POST_Logout: vi.fn() }));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({
    user: { username: "someone", first_name: "", last_name: "", email: "" },
    refresh: "r",
    isAuth: true,
    theme: "default",
    lang: "EN",
    activeApp: "pim",
    isSidebarCollapsed: false,
    clearAuth: vi.fn(),
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
  }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isPanelEnabled: () => true, loaded: true, ensureLoaded: vi.fn() }),
}));

import HeaderControls from "@/components/Navigation/HeaderControls.vue";

beforeEach(() => {
  vi.stubEnv("VUE_APP_SSO_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const openMenu = async () => {
  const wrapper = mount(HeaderControls);
  wrapper.vm.isUserMenuOpen = true;
  await wrapper.vm.$nextTick();
  return wrapper;
};

describe("HeaderControls — change password", () => {
  it("is hidden when the provider owns the credential", async () => {
    vi.stubEnv("VUE_APP_SSO_ONLY", "true");

    const wrapper = await openMenu();

    expect(wrapper.vm.ssoOnly).toBe(true);
    expect(wrapper.find('[data-test="change-password"]').exists()).toBe(false);
  });

  it("is still offered when local passwords exist", async () => {
    vi.stubEnv("VUE_APP_SSO_ONLY", "false");

    const wrapper = await openMenu();

    expect(wrapper.vm.ssoOnly).toBe(false);
    expect(wrapper.find('[data-test="change-password"]').exists()).toBe(true);
  });

  it("is offered on a deployment with no SSO at all", async () => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "false");
    vi.stubEnv("VUE_APP_SSO_ONLY", "true");

    const wrapper = await openMenu();

    expect(wrapper.find('[data-test="change-password"]').exists()).toBe(true);
  });
});
