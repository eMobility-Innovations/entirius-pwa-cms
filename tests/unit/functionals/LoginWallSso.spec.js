/**
 * The login wall with SSO OFF and ON.
 *
 * The flag-off block is the guard that protects every deployment that never asked for
 * this feature: no button, no request, and the password form untouched. It is the
 * property an upstream maintainer cares about most, so it is asserted directly rather
 * than inferred from the flag.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// This repo's happy-dom environment provides sessionStorage but not localStorage, and the
// component reads the return route from it. Supply the minimum the component uses.
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

const postSsoLoginUrl = vi.fn();
const postLogin = vi.fn();
const spawnNotification = vi.fn();

vi.mock("@/api/sso/api", () => ({
  POST_SsoLoginUrl: (...a) => postSsoLoginUrl(...a),
}));
vi.mock("../../api/contentDB/api", () => ({
  POST_Login: (...a) => postLogin(...a),
  GET_User: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  GET_UserDetails: vi.fn(() => Promise.resolve({ data: { data: {} } })),
  POST_PasswordReset: vi.fn(() => Promise.resolve({})),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification }),
}));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({ setAuth: vi.fn(), setUser: vi.fn(), loadPreferences: vi.fn() }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ fetchModules: vi.fn() }),
}));

import LoginWall from "@/functionals/Login-wall/Login-wall.vue";

/** BasicButton is globally stubbed, so its label is an attribute, not rendered text. */
const buttonLabels = (wrapper) =>
  wrapper.findAll("basic-button-stub").map((b) => b.attributes("text"));

let assign;

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  assign = vi.fn();
  // happy-dom's location is read-only; replace only the method under test.
  vi.spyOn(window.location, "assign").mockImplementation((...a) => assign(...a));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("login wall with SSO off", () => {
  beforeEach(() => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "false");
  });

  it("renders no SSO button and sends no SSO request", async () => {
    const wrapper = mount(LoginWall);
    await flushPromises();

    expect(wrapper.vm.ssoEnabled).toBe(false);
    expect(wrapper.find('[data-test="sso-login"]').exists()).toBe(false);
    expect(postSsoLoginUrl).not.toHaveBeenCalled();
  });

  it("leaves the password form exactly as it was", async () => {
    const wrapper = mount(LoginWall);
    await flushPromises();

    // The upstream form: both fields, the submit button and the reset link, untouched.
    expect(buttonLabels(wrapper)).toEqual(["login.submit"]);
    expect(wrapper.text()).toContain("login.forgot_password");
    expect(wrapper.findAll("basic-input-stub").length).toBe(2);
  });
});

describe("login wall with SSO on", () => {
  beforeEach(() => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "true");
  });

  it("renders the SSO button alongside the password form", async () => {
    const wrapper = mount(LoginWall);
    await flushPromises();

    expect(wrapper.vm.ssoEnabled).toBe(true);
    expect(wrapper.find('[data-test="sso-login"]').exists()).toBe(true);
    // Added to, never replacing: the password path stays available.
    expect(buttonLabels(wrapper)).toEqual(["login.submit", "login.sso_submit"]);
  });

  it("stashes state, then leaves for the provider", async () => {
    postSsoLoginUrl.mockResolvedValueOnce({
      data: {
        authorization_url: "https://auth.example.com/auth?state=abc",
        state: "abc",
      },
    });

    const wrapper = mount(LoginWall);
    await wrapper.vm.ssoLogin();

    expect(postSsoLoginUrl).toHaveBeenCalledWith({
      redirect_uri: `${window.location.origin}/sso/callback`,
    });
    // Stashed BEFORE the redirect — after it, this code no longer runs.
    expect(window.sessionStorage.getItem("sso_state")).toBe("abc");
    expect(assign).toHaveBeenCalledWith("https://auth.example.com/auth?state=abc");
  });

  it("reads the FLAT login-url body, not the password path's envelope", async () => {
    // { data, meta } is what POST_Login returns. If this handler ever copies that
    // destructure it gets undefined for both fields and must refuse, not redirect.
    postSsoLoginUrl.mockResolvedValueOnce({
      data: {
        data: { authorization_url: "https://auth.example.com/auth", state: "abc" },
        meta: {},
      },
    });

    const wrapper = mount(LoginWall);
    await wrapper.vm.ssoLogin();

    expect(assign).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("sso_state")).toBe(null);
    expect(spawnNotification).toHaveBeenCalledTimes(1);
  });

  it("surfaces a backend refusal instead of leaving the page", async () => {
    postSsoLoginUrl.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          error: "service_unavailable",
          message: "Staff SSO is not configured on this deployment.",
          debug_id: "aa11bb22",
        },
      },
    });

    const wrapper = mount(LoginWall);
    await wrapper.vm.ssoLogin();

    expect(assign).not.toHaveBeenCalled();
    expect(spawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Staff SSO is not configured on this deployment.",
        type: "negative",
      })
    );
  });
});
