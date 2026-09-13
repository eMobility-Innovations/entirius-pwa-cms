import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockCallback = vi.fn();
const completeLogin = vi.fn();
const userStore = { isAuth: false };

vi.mock("axios", () => ({ default: { post: (...a) => mockCallback(...a) } }));
vi.mock("@/stores/user", () => ({ useUserStore: () => userStore }));
// consumeReturnRoute stays real; its module's own imports are not needed here.
vi.mock("@/api/contentDB/api", () => ({}));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({}) }));
vi.mock("@/composables/useLoginSession", async (importOriginal) => ({
  ...(await importOriginal()),
  useLoginSession: () => ({ completeLogin }),
}));

import SsoCallback from "@/views/SsoCallback/SsoCallback.vue";

const API_URL = "http://api.test";
const SSO_BASE = "/api/sso/v2/staff";
const STATE_KEY = "cms_sso_state";

const mountCallback = (query) => {
  const replace = vi.fn();
  const wrapper = mount(SsoCallback, {
    global: { mocks: { $route: { query, params: {}, path: "/sso/callback" }, $router: { push: vi.fn(), replace } } },
  });
  return { wrapper, replace };
};

describe("SsoCallback", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    userStore.isAuth = false;
    process.env.VUE_APP_API_URL = API_URL;
    process.env.VUE_APP_SSO_API_BASE = SSO_BASE;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("exchanges the code and opens the session", async () => {
    sessionStorage.setItem(STATE_KEY, "st-1");
    localStorage.setItem("cms_return_route", "/pim/products");
    const tokens = { access: "a", refresh: "r", customer_id: "c", token_type: "Bearer" };
    mockCallback.mockResolvedValue({ data: tokens });

    const { replace } = mountCallback({ code: "code-1", state: "st-1" });
    await flushPromises();

    expect(mockCallback).toHaveBeenCalledWith(`${API_URL}${SSO_BASE}/callback/`, {
      code: "code-1",
      state: "st-1",
      redirect_uri: `${window.location.origin}/sso/callback`,
    });
    expect(completeLogin).toHaveBeenCalledWith(tokens);
    expect(replace).toHaveBeenCalledWith("/pim/products");
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it("refuses a state it did not issue, without calling the backend", async () => {
    sessionStorage.setItem(STATE_KEY, "st-1");

    const { wrapper, replace } = mountCallback({ code: "code-1", state: "forged" });
    await flushPromises();

    expect(mockCallback).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="sso-error"]').text()).toBe("login.sso_state_mismatch");
    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it("refuses a callback when no login was started in this tab", async () => {
    const { wrapper } = mountCallback({ code: "code-1", state: "st-1" });
    await flushPromises();

    expect(mockCallback).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="sso-error"]').exists()).toBe(true);
  });

  it("shows the identity provider's error", async () => {
    sessionStorage.setItem(STATE_KEY, "st-1");

    const { wrapper } = mountCallback({ error: "access_denied", state: "st-1" });
    await flushPromises();

    expect(mockCallback).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="sso-error"]').text()).toBe(
      'login.sso_provider_error::{"error":"access_denied"}'
    );
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it("shows the backend's message when the exchange is refused", async () => {
    sessionStorage.setItem(STATE_KEY, "st-1");
    mockCallback.mockRejectedValue({
      response: { status: 403, data: { error: "PERMISSION_DENIED", message: "Staff role missing." } },
    });

    const { wrapper, replace } = mountCallback({ code: "code-1", state: "st-1" });
    await flushPromises();

    expect(completeLogin).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="sso-error"]').text()).toBe("Staff role missing.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("goes home when SSO is not configured", async () => {
    delete process.env.VUE_APP_SSO_API_BASE;
    sessionStorage.setItem(STATE_KEY, "st-1");

    const { replace } = mountCallback({ code: "code-1", state: "st-1" });
    await flushPromises();

    expect(mockCallback).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it("goes home when a session already exists", async () => {
    userStore.isAuth = true;
    sessionStorage.setItem(STATE_KEY, "st-1");

    const { replace } = mountCallback({ code: "code-1", state: "st-1" });
    await flushPromises();

    expect(mockCallback).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
  });
});
