/**
 * A SECOND MOUNT IS NOT A FAILED SIGN-IN.
 *
 * SEEN IN A BROWSER on cms-pim-test, not in a test: after a correct Keycloak login the
 * CMS flashed "This sign-in could not be verified. Start again from the login page." and
 * then loaded the PIM home page anyway.
 *
 * The mechanism is App.vue, not the provider. It renders a <router-view> in its
 * unauthenticated branch (`v-else-if="isPublicRoute"`) AND another inside the
 * authenticated layout. `setAuth()` flips `isAuth`, so the instant the exchange succeeds
 * the first branch is destroyed and this component is mounted a SECOND time on the same
 * route — while the first instance is still awaiting hydrateUser(). The remount calls
 * takeStashedState(), which is single-use by design, finds nothing, and reports the
 * login-CSRF failure over a login that had in fact just worked.
 *
 * The visible flash is the smaller half. `fail()` also calls blockAutoLogin(), so a
 * SUCCESSFUL sign-in left `sso_autologin_blocked` set for the rest of the browser
 * session — and in an SSO-ONLY deployment that is the flag which stops the login wall
 * starting a login by itself when the token later expires.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

if (!window.localStorage) {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

const postCallback = vi.fn();
const setUser = vi.fn();
const loadPreferences = vi.fn();
const fetchModules = vi.fn();
const replace = vi.fn();

// The real store flips isAuth inside setAuth — that flip IS the trigger, so the fake has
// to reproduce it rather than record the call.
let authed = false;
const setAuth = vi.fn(() => {
  authed = true;
});

vi.mock("@/api/sso/api", () => ({ POST_SsoCallback: (...a) => postCallback(...a) }));
vi.mock("@/api/contentDB/api", () => ({
  GET_User: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  GET_UserDetails: vi.fn(() => Promise.resolve({ data: { data: {} } })),
}));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({
    setAuth,
    setUser,
    loadPreferences,
    get isAuth() {
      return authed;
    },
  }),
}));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ fetchModules }) }));

import Callback from "@/views/Sso/Callback.vue";

const STASHED = "stashed-state-value";
const BLOCKED_KEY = "sso_autologin_blocked";

const mountCallback = (query = { code: "the-code", state: STASHED }) =>
  mount(Callback, {
    global: {
      mocks: {
        $route: { query, params: {}, hash: "", path: "/sso/callback" },
        $router: { push: vi.fn(), replace },
      },
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  authed = false;
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.sessionStorage.setItem("sso_state", STASHED);
});

describe("SSO callback — the layout flip remounts this component", () => {
  it("does not accuse a successful sign-in of failing verification", async () => {
    postCallback.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", customer_id: "c" },
    });

    const first = mountCallback();
    // Not flushed: the remount happens WHILE the first instance is still awaiting
    // hydrateUser(), which is precisely when the state has been consumed but the
    // navigation has not yet happened.
    await Promise.resolve();
    const second = mountCallback();
    await flushPromises();

    expect(second.find('[data-test="sso-error-message"]').exists()).toBe(false);
    expect(first.find('[data-test="sso-error-message"]').exists()).toBe(false);
  });

  it("does not leave automatic login blocked after a login that worked", async () => {
    postCallback.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", customer_id: "c" },
    });

    mountCallback();
    await Promise.resolve();
    mountCallback();
    await flushPromises();

    // In SSO-ONLY mode this flag is what stops the login wall starting a login by itself
    // when the session later expires. A successful sign-in must not set it.
    expect(window.sessionStorage.getItem(BLOCKED_KEY)).toBe(null);
  });

  it("does not exchange the single-use code a second time", async () => {
    postCallback.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", customer_id: "c" },
    });

    mountCallback();
    await Promise.resolve();
    mountCallback();
    await flushPromises();

    expect(postCallback).toHaveBeenCalledTimes(1);
  });

  it("lets the instance that signed in choose where the user lands", async () => {
    window.localStorage.setItem("cms_return_route", "/pim/products");
    postCallback.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", customer_id: "c" },
    });

    mountCallback();
    await Promise.resolve();
    mountCallback();
    await flushPromises();

    // The remount must not send the user to "/" over the route they were bounced from.
    expect(replace).toHaveBeenCalledWith("/pim/products");
    expect(replace).not.toHaveBeenCalledWith("/");
  });

  it("still sends an already-signed-in visitor away from the callback route", async () => {
    // Nobody is mid-sign-in here: somebody opened /sso/callback by hand while logged in.
    // Rendering "signing in" for ever would be its own bug, so this one DOES navigate.
    authed = true;

    const wrapper = mountCallback({ code: "", state: "" });
    await flushPromises();

    expect(replace).toHaveBeenCalledWith("/");
    expect(wrapper.find('[data-test="sso-error-message"]').exists()).toBe(false);
    expect(postCallback).not.toHaveBeenCalled();
  });

  it("STILL refuses a genuine state mismatch — the login-CSRF guard is untouched", async () => {
    window.sessionStorage.setItem("sso_state", "a-different-state");

    const wrapper = mountCallback({ code: "the-code", state: STASHED });
    await flushPromises();

    expect(wrapper.find('[data-test="sso-error-message"]').exists()).toBe(true);
    expect(window.sessionStorage.getItem(BLOCKED_KEY)).toBe("1");
    expect(postCallback).not.toHaveBeenCalled();
  });
});
