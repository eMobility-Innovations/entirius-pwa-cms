import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import Cookies from "universal-cookie";
import { setActivePinia, createPinia } from "pinia";
import { useUserStore } from "@/stores/user";
import { useNotifyStore } from "@/stores/notify";
import { createApiClient } from "@/api/createClient";
import { api } from "@/api/contentDB/client";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotify } from "@/composables/useNotify";
import { tokenExpiry } from "@/utils/jwt";
import { jwtExpiringIn } from "../helpers/jwt";

const cookies = new Cookies();
const SESSION_COOKIES = ["token", "refresh", "customer_id", "expiryDate"];
const isBlacklist = (url) => url.endsWith("/customer/tokens/blacklist/");
const isRefresh = (url) => url.endsWith("/customer/tokens/refresh/");
const unauthorized = () => Object.assign(new Error("401"), { response: { status: 401, data: {} } });

// r04 §9 defect 1: the service issues 300 s access tokens, the client assumed 15 min and refreshed far too late.
// The proactive refresh is scheduled from the lifetime the token carries: 60 s before expiry, never sooner than 10 s.
const login = (seconds, skewSeconds = 0) => {
  const token = jwtExpiringIn(seconds, skewSeconds);
  useUserStore().setAuth({ token, refresh: "r-token", customer_id: "cust-1", expiryDate: tokenExpiry(token) });
};

// An API client whose first call to each URL answers 401 — its retry goes through the shared refresh.
const clientWith401 = (build = createApiClient) => {
  const client = build("http://service.test", { tokenRefresh: true });
  const seen = new Set();
  client.defaults.adapter = async (config) => {
    if (seen.has(config.url)) return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    seen.add(config.url);
    throw Object.assign(new Error("401"), { config, response: { status: 401, config, data: {} } });
  };
  return client;
};

describe("user store — proactive token refresh", () => {
  let post;
  let reload;
  // POST urls in order: the refresh and the blacklist both go through plain `axios.post`
  const posted = () => post.mock.calls.map(([url]) => (isBlacklist(url) ? "blacklist" : isRefresh(url) ? "refresh" : url));

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setActivePinia(createPinia());
    post = vi.spyOn(axios, "post").mockImplementation(async () => ({ data: { data: { access: jwtExpiringIn(300) } } }));
    reload = vi.spyOn(window.location, "assign").mockImplementation(() => {});
  });

  afterEach(() => {
    useUserStore().clearAuth();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("refreshes a 300 s token 60 s before its exp, not earlier", async () => {
    login(300);

    await vi.advanceTimersByTimeAsync(239_000);
    expect(post).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({ refresh: "r-token" });
  });

  it("refreshes a token about to expire after the 10 s floor", async () => {
    login(30);

    await vi.advanceTimersByTimeAsync(9_000);
    expect(post).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("schedules the next refresh from the refreshed token", async () => {
    login(300);
    await vi.advanceTimersByTimeAsync(240_000);

    await vi.advanceTimersByTimeAsync(240_000);
    expect(post).toHaveBeenCalledTimes(2);
  });

  // Review finding: `exp` read against a client clock 5 min ahead looked expired on arrival → a refresh every 10 s.
  it("a client clock 5 min ahead of the server still refreshes once per token lifetime", async () => {
    post.mockImplementation(async () => ({ data: { data: { access: jwtExpiringIn(300, -300) } } }));
    login(300);
    await vi.advanceTimersByTimeAsync(240_000);

    await vi.advanceTimersByTimeAsync(239_000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  // Plan 04 review finding 3: the lifetime comes from the claims, so a server clock an hour ahead changes nothing.
  it("takes the lifetime from the token's claims", async () => {
    login(120, 3600);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(post).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  // Plan 04 review finding 2: a refresh by an API client left the timer on the old token's schedule.
  it("an API client refresh re-arms the timer from the new token", async () => {
    login(300);
    await vi.advanceTimersByTimeAsync(100_000);
    const fresh = jwtExpiringIn(300);
    post.mockResolvedValueOnce({ data: { data: { access: fresh } } });

    await clientWith401().get("/me/");
    expect(post).toHaveBeenCalledTimes(1);
    expect(useUserStore().token).toBe(fresh);

    await vi.advanceTimersByTimeAsync(140_000);
    expect(post).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100_000);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("the timer and an API client refreshing at once send one refresh request", async () => {
    let answer;
    post.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    login(30);

    await vi.advanceTimersByTimeAsync(10_000);
    const request = clientWith401().get("/me/");
    await vi.advanceTimersByTimeAsync(0);
    answer({ data: { data: { access: jwtExpiringIn(300) } } });
    await request;

    expect(post).toHaveBeenCalledTimes(1);
  });

  // FIX-04 review: the refresh check before a request is the third trigger — it joins the same in-flight call.
  it("the timer, the pre-request check and a 401 retry send one refresh request", async () => {
    let answer;
    post.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const fresh = jwtExpiringIn(300);
    login(12);
    const sent = [];
    const expiring = createApiClient("http://service.test", {
      authHeaderFn: () => `Bearer ${cookies.get("token")}`,
      tokenRefresh: true,
    });
    expiring.defaults.adapter = async (config) => {
      sent.push(config.headers.Authorization);
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await vi.advanceTimersByTimeAsync(10_000);
    const requests = [expiring.get("/a/"), clientWith401().get("/me/")];
    await vi.advanceTimersByTimeAsync(0);
    answer({ data: { data: { access: fresh } } });
    await Promise.all(requests);

    expect(post).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([`Bearer ${fresh}`]);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  // FIX-04 review: a refresh answered after a logout wrote the session back and re-armed the timer.
  it("a logout during an in-flight refresh stays logged out and writes no cookie", async () => {
    let answer;
    post.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    login(30);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(post).toHaveBeenCalledTimes(1);

    useUserStore().clearAuth();
    const set = vi.spyOn(Cookies.prototype, "set");
    answer({ data: { data: { access: jwtExpiringIn(300), refresh: "rotated" } } });
    await vi.advanceTimersByTimeAsync(600_000);

    expect(set).not.toHaveBeenCalled();
    expect(SESSION_COOKIES.map((name) => cookies.get(name))).toEqual([undefined, undefined, undefined, undefined]);
    expect(useUserStore().token).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
    // the dropped answer is not a session expiry: no second logout, no return route to the page left behind
    expect(localStorage.getItem("cms_return_route")).toBeNull();
  });

  // FIX-04b review: the logout blacklists the refresh token, so the refresh racing it fails with a 401 — that failure
  // redirected to "session expired" and wiped a login made in the meantime.
  it("a refresh that fails after a logout neither redirects nor wipes the next login", async () => {
    const fails = [];
    post.mockImplementation(() => new Promise((_, reject) => fails.push(reject)));
    login(30);
    await vi.advanceTimersByTimeAsync(10_000);

    useUserStore().clearAuth();
    login(300);
    const token = useUserStore().token;
    fails[0](Object.assign(new Error("401"), { response: { status: 401, data: {} } }));
    await vi.advanceTimersByTimeAsync(0);

    expect(useUserStore().token).toBe(token);
    expect(SESSION_COOKIES.map((name) => cookies.get(name) !== undefined)).toEqual([true, true, true, true]);
    expect(localStorage.getItem("cms_return_route")).toBeNull();
    expect(localStorage.getItem("session_expired")).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  // FIX-04c review: the logout request blacklisted the refresh token before `clearAuth` moved the session on, so the
  // refresh racing it failed as an expired session. Both redirect paths store `cms_return_route` before reloading.
  it("a refresh that fails while the logout request is pending neither redirects nor reloads", async () => {
    let failRefresh;
    let loggedOut;
    post.mockImplementation((url) =>
      new Promise((resolve, reject) => (isBlacklist(url) ? (loggedOut = resolve) : (failRefresh = reject)))
    );
    login(30);
    await vi.advanceTimersByTimeAsync(10_000);

    const logout = useUserStore().logout();
    await vi.advanceTimersByTimeAsync(0);
    failRefresh(unauthorized());
    await vi.advanceTimersByTimeAsync(0);

    expect(post.mock.calls[1][1]).toEqual({ refresh: "r-token" });
    expect(localStorage.getItem("cms_return_route")).toBeNull();
    expect(localStorage.getItem("session_expired")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
    loggedOut({});
    await logout;
    expect(useUserStore().token).toBeNull();
    expect(localStorage.getItem("cms_return_route")).toBeNull();
    expect(reload).toHaveBeenCalledWith("/");
  });

  // FIX-04d review: the blacklist went through the contentDB client, whose interceptors refreshed the session it ended.
  it("logout with an expiring access token refreshes once, then blacklists with the new token, clears and reloads", async () => {
    const fresh = jwtExpiringIn(300);
    post.mockImplementation(async (url) => ({ data: isRefresh(url) ? { data: { access: fresh, refresh: "rotated" } } : {} }));
    login(5);
    reload.mockImplementation(() => expect(SESSION_COOKIES.map((name) => cookies.get(name))).toEqual([undefined, undefined, undefined, undefined]));

    await useUserStore().logout();

    expect(posted()).toEqual(["refresh", "blacklist"]);
    const [, body, config] = post.mock.calls[1];
    expect(body).toEqual({ refresh: "rotated" });
    expect(config.headers.Authorization).toBe(`Bearer ${fresh}`);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith("/");
    await vi.advanceTimersByTimeAsync(600_000);
    expect(posted()).toEqual(["refresh", "blacklist"]);
  });

  it("the blacklist call never goes through the refresh interceptors: its 401 starts no refresh and no redirect", async () => {
    const client = vi.spyOn(api, "post");
    post.mockImplementation(async () => Promise.reject(unauthorized()));
    login(-60);

    await useUserStore().logout();

    // one refresh — the logout's own, while the session is current — then the blacklist, never retried
    expect(posted()).toEqual(["refresh", "blacklist"]);
    expect(client).not.toHaveBeenCalled();
    expect(localStorage.getItem("cms_return_route")).toBeNull();
    expect(localStorage.getItem("session_expired")).toBeNull();
    expect(useUserStore().token).toBeNull();
    expect(reload).toHaveBeenCalledWith("/");
  });

  it.each([
    ["fails", new Error("Network Error")],
    ["times out", Object.assign(new Error("timeout of 5000ms exceeded"), { code: "ECONNABORTED" })],
  ])("a blacklist request that %s still clears the session and reloads", async (_, error) => {
    post.mockRejectedValue(error);
    login(300);

    await useUserStore().logout();

    expect(post.mock.calls[0][2].timeout).toBe(5000);
    expect(useUserStore().token).toBeNull();
    expect(SESSION_COOKIES.map((name) => cookies.get(name))).toEqual([undefined, undefined, undefined, undefined]);
    expect(reload).toHaveBeenCalledWith("/");
  });

  // FIX-04e review: a refresh request without a timeout kept logout pending forever.
  it("a stalled refresh cannot keep the user logged in: logout ends locally after its budget", async () => {
    post.mockImplementation((url) => (isRefresh(url) ? new Promise(() => {}) : Promise.resolve({})));
    login(5);

    const logout = useUserStore().logout();
    await vi.advanceTimersByTimeAsync(6000);
    await logout;

    expect(useUserStore().token).toBeNull();
    expect(SESSION_COOKIES.map((name) => cookies.get(name))).toEqual([undefined, undefined, undefined, undefined]);
    expect(reload).toHaveBeenCalledWith("/");
  });

  it("a second logout while one runs sends one blacklist request", async () => {
    login(300);

    await Promise.all([useUserStore().logout(), useUserStore().logout()]);

    expect(posted()).toEqual(["blacklist"]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // FIX-04c review: a request waiting on the dropped refresh rejected into its caller's catch, which toasted.
  it("a request waiting on the refresh when the user logs out never settles and raises no toast", async () => {
    let fail;
    post.mockImplementation((url) => (isBlacklist(url) ? Promise.resolve({}) : new Promise((_, reject) => (fail = reject))));
    login(30);
    await vi.advanceTimersByTimeAsync(10_000);
    const notify = useNotify();
    const settled = [];
    const panelLoad = (request) =>
      request.then(
        () => settled.push("resolved"),
        (err) => settled.push(notify.error(extractApiMessage(err, "Loading failed")))
      );
    panelLoad(clientWith401().get("/me/"));
    panelLoad(clientWith401().get("/a/"));
    await vi.advanceTimersByTimeAsync(0);

    await useUserStore().logout();
    fail(unauthorized());
    // below the 5 s toast timeout: a toast spawned by the catch would still be listed
    await vi.advanceTimersByTimeAsync(1_000);

    expect(settled).toEqual([]);
    expect(useNotifyStore().notifications).toEqual([]);
    expect(localStorage.getItem("cms_return_route")).toBeNull();
  });

  // Code review: a login right after the logout joined the still-pending old refresh and was wiped by its drop.
  it("a login after a logout never joins the dropped refresh", async () => {
    const answers = [];
    post.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const fresh = jwtExpiringIn(300);
    login(30);
    await vi.advanceTimersByTimeAsync(10_000);

    useUserStore().clearAuth();
    login(300);
    const request = clientWith401().get("/me/");
    await vi.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledTimes(2);

    answers[0]({ data: { data: { access: jwtExpiringIn(300) } } });
    answers[1]({ data: { data: { access: fresh } } });
    await request;

    expect(useUserStore().token).toBe(fresh);
    expect(cookies.get("token")).toBe(fresh);
  });

  it("a refresh keeps the customer id and never writes an unknown one", async () => {
    login(300);
    cookies.remove("customer_id", { path: "/" });

    await clientWith401().get("/me/");
    expect(useUserStore().customer_id).toBe("cust-1");
    expect(cookies.get("customer_id")).toBe("cust-1");

    useUserStore().clearAuth();
    useUserStore().setAuth({ token: jwtExpiringIn(300), refresh: "r-token", expiryDate: null });
    expect(useUserStore().customer_id).toBeNull();
    expect(cookies.get("customer_id")).toBeUndefined();
  });

  it("a store never hydrated keeps the customer_id cookie after a refresh", async () => {
    cookies.set("refresh", "r-token", { path: "/" });
    cookies.set("customer_id", "cust-2", { path: "/" });

    await clientWith401().get("/me/");

    expect(useUserStore().customer_id).toBe("cust-2");
    expect(cookies.get("customer_id")).toBe("cust-2");
  });

  it("setAuth with customer_id null keeps the existing id", () => {
    login(300);

    useUserStore().setAuth({ token: jwtExpiringIn(300), refresh: "r-token", customer_id: null, expiryDate: null });

    expect(useUserStore().customer_id).toBe("cust-1");
    expect(cookies.get("customer_id")).toBe("cust-1");
  });
});

// Last in the file: it resets the module registry. FIX-04 review: a client built before the store module loaded
// got `storeAuth is not a function` after a successful refresh and signed the user out.
describe("token refresh — module load order", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    SESSION_COOKIES.forEach((name) => cookies.remove(name, { path: "/" }));
  });

  it("a client created before the user store is imported refreshes without error", async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    const { createApiClient: buildBeforeStore } = await import("@/api/createClient");
    const fresh = jwtExpiringIn(300);
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { access: fresh } } });
    cookies.set("refresh", "r-token", { path: "/" });

    await clientWith401(buildBeforeStore).get("/me/");

    const { useUserStore: loadedStore } = await import("@/stores/user");
    expect(loadedStore().token).toBe(fresh);
    expect(cookies.get("token")).toBe(fresh);
    loadedStore().clearAuth();
  });
});
