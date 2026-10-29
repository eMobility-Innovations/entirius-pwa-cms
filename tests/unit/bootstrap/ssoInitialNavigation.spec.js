import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";

const state = vi.hoisted(() => ({ app: null, router: null, user: null, resolveCallback: null,
  restoreAuth: false, begin: vi.fn(), exchange: vi.fn() }));
vi.mock("vue", async (original) => {
  const vue = await original();
  return { ...vue, createApp: (...args) => (state.app = vue.createApp(...args)) };
});
vi.mock("@/router", () => ({ get default() { return state.router; } }));
vi.mock("@/stores/user", async () => {
  const { reactive } = await import("vue");
  const readCookies = vi.fn(() => {
    state.user.isAuth = state.restoreAuth;
    state.user.token = state.restoreAuth ? "restored-token" : null;
  });
  state.user = reactive({ isAuth: false, token: null, readCookies, appInit: vi.fn(() => readCookies()), user: {} });
  return { useUserStore: () => state.user };
});
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loading: false }) }));
vi.mock("@/stores/handy", () => ({ useHandyStore: () => ({ handyType: null }) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ ensureLoaded: vi.fn(),
  isModuleEnabled: () => false, healthAvailable: false }) }));
vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ isStaff: true, loaded: false,
  can: () => false, ensureLoaded: vi.fn(), reset: vi.fn() }) }));
vi.mock("@/stores/notifications", () => ({ useNotificationsStore: () => ({ start: vi.fn(), stop: vi.fn() }) }));
vi.mock("@/stores/configHealth", () => ({ useConfigHealthStore: () => ({ start: vi.fn(), stop: vi.fn() }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ start: vi.fn(), stop: vi.fn() }) }));
vi.mock("@/stores/leadTypes", () => ({ useLeadTypesStore: () => ({ reset: vi.fn() }) }));
vi.mock("@/composables/useIsDesktop", async () => ({ useIsDesktop: () => false }));
vi.mock("@/composables/useNav", () => ({ useActiveNav: () => ({ panelIdx: "", tree: {} }), tabBarShown: () => false }));
vi.mock("@/utils/env-check", () => ({ envStatus: { valid: true } }));
vi.mock("@/utils/client-config-check", () => ({}));
vi.mock("@/composables/useLoginSession", () => ({ useLoginSession: () => ({ completeLogin: async () => {
  state.user.isAuth = true;
} }), consumeReturnRoute: () => null }));
vi.mock("@/api/sso/api", () => ({ POST_SsoLoginUrl: (...args) => state.begin(...args),
  POST_SsoCallback: (...args) => state.exchange(...args) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("swiper", () => ({ default: vi.fn() }));
vi.mock("flatpickr", () => ({ default: vi.fn() }));
vi.mock("@/utils/leadsCompanyNames", () => ({ clearCompanyNames: vi.fn() }));
vi.mock("@/boots/register-elems", () => ({ default: vi.fn() }));
vi.mock("@/configs/builder/components/register-elems", () => ({ default: vi.fn() }));
vi.mock("@/boots/Icons/fa-icons", () => ({ default: vi.fn() }));
vi.mock("@/i18n", () => ({ default: { install: (app) => { app.config.globalProperties.$t = (key) => key; } }, t: (key) => key, uiLocale: () => "en", getLang: () => "EN", setLang: vi.fn() }));
vi.mock("@/functionals/Handy-kit/Handy-kit.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/Notifications/Notifications.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/boots/AppHeader/index.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/boots/SidebarNav/index.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/boots/BottomTabBar/index.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/boots/MobileMenu/index.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/Shell/ShellPageHeader.vue", () => ({ default: { template: "<div><slot /></div>" } }));

// Compile the real actors during collection, as normal component specs do. The
// explicitly held lazy loader below models the cold network route independently.
import "@/App.vue";
import "@/views/SsoCallback/SsoCallback.vue";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.app = null; state.resolveCallback = null; state.restoreAuth = false;
  if (state.user) { state.user.isAuth = false; state.user.token = null; }
  vi.stubEnv("VUE_APP_SSO_ENABLED", "true");
  vi.stubEnv("VUE_APP_SSO_ONLY", "true");
  sessionStorage.clear();
  sessionStorage.setItem("sso_state", "original-state");
  state.begin.mockReturnValue(new Promise(() => {}));
  state.exchange.mockResolvedValue({ data: { access: "a", refresh: "r", customer_id: "c" } });
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(async () => {
  state.app?.unmount();
  state.resolveCallback?.();
  await flushPromises();
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
});

it("cold callback bootstrap resolves its lazy route before mounting the login wall", async () => {
  const { createRouter, createMemoryHistory } = await vi.importActual("vue-router");
  const history = createMemoryHistory();
  history.replace("/sso/callback?code=provider-code&state=original-state");
  state.router = createRouter({ history, routes: [
    { path: "/", component: { template: "<div>home</div>" } },
    { path: "/sso/callback", meta: { requiresAuth: false }, component: () => new Promise((resolve) => {
      state.resolveCallback = () => resolve(import("@/views/SsoCallback/SsoCallback.vue"));
    }) },
  ] });
  await import("@/main.js");
  await flushPromises();
  expect(state.begin).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("sso_state")).toBe("original-state");
  state.resolveCallback();
  await state.router.isReady();
  await flushPromises();
  expect(state.exchange).toHaveBeenCalledTimes(1);
  expect(state.begin).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("sso_state")).toBeNull();
});


it("restores cookie authentication before the first protected-route guard", async () => {
  state.restoreAuth = true;
  const { createRouter, createMemoryHistory } = await vi.importActual("vue-router");
  const history = createMemoryHistory();
  history.replace("/secure");
  state.router = createRouter({ history, routes: [
    { path: "/", component: { template: "<div>home</div>" } },
    { path: "/secure", component: { template: "<div>protected</div>" } },
  ] });
  let authenticatedAtGuard = false;
  state.router.beforeEach((to) => {
    if (to.path !== "/secure") return;
    authenticatedAtGuard = state.user.isAuth;
    if (!authenticatedAtGuard) return "/";
  });
  await import("@/main.js");
  await state.router.isReady();
  await flushPromises();
  expect(authenticatedAtGuard).toBe(true);
  expect(state.router.currentRoute.value.path).toBe("/secure");
  expect(state.user.appInit).toHaveBeenCalledTimes(1);
});
