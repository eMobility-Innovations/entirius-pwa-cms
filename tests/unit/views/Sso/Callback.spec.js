/**
 * The SSO callback view.
 *
 * The case this file exists for is the SHAPE of a successful response. The staff-SSO
 * endpoint answers FLAT — { access, refresh, customer_id, token_type } — while the
 * password path answers with a { data, meta } envelope. Reading this body the way the
 * password path reads its own yields three undefineds, writes empty cookies and leaves
 * the user logged out on an HTTP 200 with nothing in any log. The success test below
 * pins the flat read; `refuses an enveloped body` pins the failure it would otherwise
 * have become.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

const postCallback = vi.fn();
const setAuth = vi.fn();
const setUser = vi.fn();
const loadPreferences = vi.fn();
const fetchModules = vi.fn();
const replace = vi.fn();

vi.mock("@/api/sso/api", () => ({
  POST_SsoCallback: (...a) => postCallback(...a),
}));
vi.mock("@/api/contentDB/api", () => ({
  GET_User: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  GET_UserDetails: vi.fn(() => Promise.resolve({ data: { data: {} } })),
}));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({ setAuth, setUser, loadPreferences }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ fetchModules }),
}));

import Callback from "@/views/Sso/Callback.vue";

const STASHED = "stashed-state-value";

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
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.sessionStorage.setItem("sso_state", STASHED);
});

describe("SSO callback — success", () => {
  it("reads the FLAT body and fills the existing session store", async () => {
    postCallback.mockResolvedValueOnce({
      data: {
        access: "access-jwt",
        refresh: "refresh-jwt",
        customer_id: "cust-42",
        token_type: "Bearer",
      },
    });

    const wrapper = mountCallback();
    await flushPromises();

    expect(postCallback).toHaveBeenCalledWith({
      code: "the-code",
      state: STASHED,
      redirect_uri: `${window.location.origin}/sso/callback`,
    });
    expect(setAuth).toHaveBeenCalledTimes(1);
    const auth = setAuth.mock.calls[0][0];
    expect(auth.token).toBe("access-jwt");
    expect(auth.refresh).toBe("refresh-jwt");
    expect(auth.customer_id).toBe("cust-42");
    expect(auth.expiryDate).toBeInstanceOf(Date);

    expect(setUser).toHaveBeenCalledTimes(1);
    expect(fetchModules).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
    expect(wrapper.find('[data-test="sso-error-message"]').exists()).toBe(false);
  });

  it("consumes the stashed state so a replayed code cannot reuse it", async () => {
    postCallback.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", customer_id: "c" },
    });

    mountCallback();
    await flushPromises();

    expect(window.sessionStorage.getItem("sso_state")).toBe(null);
  });

  it("returns the user to where the session expired", async () => {
    window.localStorage.setItem("cms_return_route", "/pim/products");
    postCallback.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", customer_id: "c" },
    });

    mountCallback();
    await flushPromises();

    expect(replace).toHaveBeenCalledWith("/pim/products");
    expect(window.localStorage.getItem("cms_return_route")).toBe(null);
  });
});

describe("SSO callback — a body that is not the shape we were promised", () => {
  it("refuses an enveloped body instead of writing an empty session", async () => {
    // Exactly what the PASSWORD path returns. If this view ever destructures
    // `data.data`, the assertions above pass and this one is the only thing standing
    // between a 200 and three empty cookies.
    postCallback.mockResolvedValueOnce({
      data: {
        data: { access: "access-jwt", refresh: "refresh-jwt", customer_id: "c" },
        meta: { message: "ok" },
      },
    });

    const wrapper = mountCallback();
    await flushPromises();

    expect(setAuth).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="sso-error-message"]').text()).toBe(
      "login.sso_error_no_tokens"
    );
  });

  it("refuses a body with no access token", async () => {
    postCallback.mockResolvedValueOnce({ data: { refresh: "r", customer_id: "c" } });

    const wrapper = mountCallback();
    await flushPromises();

    expect(setAuth).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="sso-error-message"]').exists()).toBe(true);
  });
});

describe("SSO callback — bad state", () => {
  it("refuses a state that does not match the one stashed before the redirect", async () => {
    const wrapper = mountCallback({ code: "the-code", state: "someone-elses-state" });
    await flushPromises();

    expect(postCallback).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="sso-error-message"]').text()).toBe(
      "login.sso_error_state"
    );
  });

  it("refuses a callback this browser never started", async () => {
    window.sessionStorage.clear();

    const wrapper = mountCallback();
    await flushPromises();

    expect(postCallback).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="sso-error-message"]').text()).toBe(
      "login.sso_error_state"
    );
  });

  it("refuses a redirect that carries no code", async () => {
    const wrapper = mountCallback({ state: STASHED });
    await flushPromises();

    expect(postCallback).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="sso-error-message"]').text()).toBe(
      "login.sso_error_no_code"
    );
  });
});

describe("SSO callback — the backend refuses", () => {
  it("surfaces the v2 envelope's message and debug_id", async () => {
    // Errors, unlike successes, ARE enveloped — and the debug_id is the only handle
    // anyone has on the server-side log line.
    postCallback.mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          error: "permission_denied",
          message: "No access has been granted to this account.",
          debug_id: "7f3c9a12",
        },
      },
    });

    const wrapper = mountCallback();
    await flushPromises();

    expect(setAuth).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="sso-error-message"]').text()).toBe(
      "No access has been granted to this account."
    );
    expect(wrapper.find('[data-test="sso-debug-id"]').text()).toContain("7f3c9a12");
  });

  it("still says something useful when the error carries no message", async () => {
    postCallback.mockRejectedValueOnce(new Error("Network Error"));

    const wrapper = mountCallback();
    await flushPromises();

    expect(setAuth).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="sso-error-message"]').text()).toBe(
      "login.sso_error_generic"
    );
    expect(wrapper.find('[data-test="sso-debug-id"]').exists()).toBe(false);
  });
});
