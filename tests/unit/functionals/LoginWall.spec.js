import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockAxiosPost = vi.fn();
const mockPostLogin = vi.fn();
const completeLogin = vi.fn();
const spawnNotification = vi.fn();

vi.mock("axios", () => ({ default: { post: (...a) => mockAxiosPost(...a) } }));
vi.mock("@/api/contentDB/api", () => ({
  POST_Login: (...a) => mockPostLogin(...a),
  POST_PasswordReset: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));
vi.mock("@/composables/useLoginSession", () => ({
  useLoginSession: () => ({ completeLogin }),
  consumeReturnRoute: () => null,
}));

import LoginWall from "@/functionals/Login-wall/Login-wall.vue";

const mountWall = () => mount(LoginWall);
const ssoButton = (wrapper) => wrapper.find('[data-testid="sso-login"]');

describe("Login-wall", () => {
  const originalEnv = { ...process.env };
  let assign;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    process.env.VUE_APP_API_URL = "http://api.test";
    assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    assign.mockRestore();
  });

  it("has no SSO button when SSO is not configured", () => {
    delete process.env.VUE_APP_SSO_API_BASE;

    expect(ssoButton(mountWall()).exists()).toBe(false);
  });

  it("starts SSO: keeps the state for this tab and leaves for the provider", async () => {
    process.env.VUE_APP_SSO_API_BASE = "/api/sso/v2/staff/";
    mockAxiosPost.mockResolvedValue({
      data: { authorization_url: "https://idp.test/auth?x=1", state: "st-1" },
    });
    const wrapper = mountWall();
    expect(ssoButton(wrapper).exists()).toBe(true);

    await wrapper.vm.startSsoLogin();

    expect(mockAxiosPost).toHaveBeenCalledWith("http://api.test/api/sso/v2/staff/login-url/", {
      redirect_uri: `${window.location.origin}/sso/callback`,
    });
    expect(sessionStorage.getItem("cms_sso_state")).toBe("st-1");
    expect(assign).toHaveBeenCalledWith("https://idp.test/auth?x=1");
  });

  it("stays on the login wall with a notification when SSO cannot start", async () => {
    process.env.VUE_APP_SSO_API_BASE = "/api/sso/v2/staff";
    mockAxiosPost.mockRejectedValue({ response: { status: 503, data: { message: "Not configured." } } });
    const wrapper = mountWall();

    await wrapper.vm.startSsoLogin();

    expect(assign).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("cms_sso_state")).toBeNull();
    expect(spawnNotification).toHaveBeenCalledWith(expect.objectContaining({ title: "Not configured." }));
  });

  it("password login hands the token pair to the shared session setup", async () => {
    mockPostLogin.mockResolvedValue({ data: { data: { access: "a", refresh: "r", customer_id: "c" } } });
    const wrapper = mountWall();
    await wrapper.setData({ username: "ops", password: "pw" });

    await wrapper.vm.login();
    await flushPromises();

    expect(mockPostLogin).toHaveBeenCalledWith({ username: "ops", password: "pw" });
    expect(completeLogin).toHaveBeenCalledWith({ access: "a", refresh: "r", customer_id: "c" });
  });
});
