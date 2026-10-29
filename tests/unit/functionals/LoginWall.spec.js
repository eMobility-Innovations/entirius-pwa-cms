import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";

const mockAxiosPost = vi.fn();
const mockPostLogin = vi.fn();
const completeLogin = vi.fn();

// Login errors also notify through the application store; this fixture isolates that boundary.
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));

vi.mock("axios", () => ({ default: { post: (...a) => mockAxiosPost(...a) } }));
vi.mock("@/api/contentDB/api", () => ({
  POST_Login: (...a) => mockPostLogin(...a),
  POST_PasswordReset: vi.fn(),
}));
vi.mock("@/composables/useLoginSession", () => ({
  useLoginSession: () => ({ completeLogin }),
  consumeReturnRoute: () => null,
}));

import LoginWall from "@/functionals/Login-wall/Login-wall.vue";
import BasicButton from "@/boots/BasicButton/index.vue";
import BasicInput from "@/boots/BasicInput/index.vue";
import FormField from "@/boots/FormField/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import { POST_PasswordReset } from "@/api/contentDB/api";

const mountWall = () => mount(LoginWall);
// Plan 61c: the boots resolved, so a test reads what the button and the inputs render, not a stub's attributes. The
// global setup stubs three of them; handing the real component in as the "stub" is what reaches PasswordField too.
const mountWithBoots = () =>
  mount(LoginWall, { global: { components: { IconButton }, stubs: { BasicButton, BasicInput, FormField } } });
const ssoButton = (wrapper) => wrapper.find('[data-testid="sso-login"]');
const summary = (wrapper) => wrapper.find('[aria-live="polite"]').text();
// The fields through the instance: the error-clearing watchers pin them to `data`, where setData would not write.
const fill = async (wrapper, values) => {
  Object.assign(wrapper.vm, values);
  await nextTick();
};

describe("Login-wall", () => {
  const originalEnv = { ...process.env };
  let assign;

  beforeEach(() => {
    vi.clearAllMocks();
    window.dispatchEvent(new Event("pagehide"));
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

  it("stays on the login wall with the reason in the live summary when SSO cannot start", async () => {
    process.env.VUE_APP_SSO_API_BASE = "/api/sso/v2/staff";
    mockAxiosPost.mockRejectedValue({ response: { status: 503, data: { message: "Not configured." } } });
    const wrapper = mountWall();

    await wrapper.vm.startSsoLogin();

    expect(assign).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("cms_sso_state")).toBeNull();
    await nextTick();
    expect(summary(wrapper)).toBe("Not configured.");
  });

  it("keeps the SSO button busy until the browser actually leaves", async () => {
    process.env.VUE_APP_SSO_ENABLED = "true";
    process.env.VUE_APP_SSO_ONLY = "false";
    let answer;
    mockAxiosPost.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    const wrapper = mountWithBoots();
    const pending = wrapper.vm.ssoLogin();
    await nextTick();
    expect(ssoButton(wrapper).attributes("disabled")).toBeDefined();
    expect(ssoButton(wrapper).attributes("aria-busy")).toBe("true");
    answer({ data: { authorization_url: "https://idp.test/auth", state: "one-state" } });
    await pending;
    await nextTick();
    expect(ssoButton(wrapper).attributes("disabled")).toBeDefined();
    window.dispatchEvent(new Event("pagehide"));
    await nextTick();
    expect(ssoButton(wrapper).attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  it("password login hands the token pair to the shared session setup", async () => {
    mockPostLogin.mockResolvedValue({ data: { data: { access: "a", refresh: "r", customer_id: "c" } } });
    const wrapper = mountWall();
    await fill(wrapper, { username: "ops", password: "pw" });

    await wrapper.vm.login();
    await flushPromises();

    expect(mockPostLogin).toHaveBeenCalledWith({ username: "ops", password: "pw" });
    expect(completeLogin).toHaveBeenCalledWith({ access: "a", refresh: "r", customer_id: "c" });
  });

  // Plan 32: the fields sit in a <form>, so Enter in a field submits it (implicit submission).
  it("submitting the login form logs in", async () => {
    mockPostLogin.mockResolvedValue({ data: { data: { access: "a", refresh: "r" } } });
    const wrapper = mountWall();
    await fill(wrapper, { username: "ops", password: "pw" });

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mockPostLogin).toHaveBeenCalledWith({ username: "ops", password: "pw" });
  });

  it("submitting the forgot-password form sends the reset link", async () => {
    const wrapper = mountWall();
    await fill(wrapper, { showForgotPassword: true, resetEmail: "ops@example.test" });

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(POST_PasswordReset).toHaveBeenCalledWith({ email: "ops@example.test" });
    expect(wrapper.vm.resetEmailSent).toBe(true);
  });

  // Plan 59: errors show under the field and once in the live summary, never as a toast.
  it("an empty submit marks both fields and states it once, without a request", async () => {
    const wrapper = mountWall();

    await wrapper.get("form").trigger("submit");

    expect(mockPostLogin).not.toHaveBeenCalled();
    expect(wrapper.vm.errors).toMatchObject({ username: "login.username_required", password: "login.password_required" });
    expect(summary(wrapper)).toBe("login.empty_credentials");
  });

  it("editing a field clears the errors", async () => {
    const wrapper = mountWall();
    await wrapper.get("form").trigger("submit");

    await fill(wrapper, { username: "ops" });

    expect(wrapper.vm.errors.username).toBe("");
    expect(summary(wrapper)).toBe("");
  });

  it("a refused login shows the API message in the summary", async () => {
    mockPostLogin.mockRejectedValue({ response: { status: 401, data: { message: "Bad credentials." } } });
    const wrapper = mountWall();
    await fill(wrapper, { username: "ops", password: "bad" });

    await wrapper.vm.login();
    await flushPromises();

    expect(completeLogin).not.toHaveBeenCalled();
    expect(summary(wrapper)).toBe("Bad credentials.");
  });

  it("the submit button shows its loading state while signing in", async () => {
    let answer;
    mockPostLogin.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const wrapper = mountWithBoots();
    await fill(wrapper, { username: "ops", password: "pw" });
    const submit = () => wrapper.get('button[type="submit"]');
    expect(submit().attributes("aria-busy")).toBeUndefined();

    const pending = wrapper.vm.login();
    await nextTick();
    expect(submit().attributes("aria-busy")).toBe("true");
    expect(submit().attributes("disabled")).toBeDefined();
    expect(submit().find(".button-basic__spinner").exists()).toBe(true);

    answer({ data: { data: {} } });
    await pending;
    await nextTick();
    expect(submit().attributes("aria-busy")).toBeUndefined();
    expect(submit().attributes("disabled")).toBeUndefined();
  });

  it("an expired session is stated in the summary as a warning", async () => {
    localStorage.setItem("session_expired", "1");
    const wrapper = mountWall();
    await nextTick();

    expect(summary(wrapper)).toBe("login.session_expired");
    expect(wrapper.find(".auth-layout__status--warning").exists()).toBe(true);
    expect(localStorage.getItem("session_expired")).toBeNull();
  });

  it("the fields carry their autocomplete purpose", () => {
    const wrapper = mountWithBoots();

    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true);
    expect(wrapper.find('input[autocomplete="current-password"]').exists()).toBe(true);
  });
});
