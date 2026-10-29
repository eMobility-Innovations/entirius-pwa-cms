import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockGetUserDetails = vi.fn();
const setAuth = vi.fn();
const markAuthenticated = vi.fn();
const setUser = vi.fn();
const loadPreferences = vi.fn();
const fetchModules = vi.fn();
const ensureAccessLoaded = vi.fn();
const replace = vi.fn();
const currentRoute = { value: { path: "/pim/products", query: { page: "2" }, hash: "" } };

vi.mock("@/api/contentDB/api", () => ({
  GET_User: (...a) => mockGetUser(...a),
  GET_UserDetails: (...a) => mockGetUserDetails(...a),
}));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({ setAuth, markAuthenticated, setUser, loadPreferences }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ fetchModules }),
}));
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({ ensureLoaded: ensureAccessLoaded }),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ currentRoute, replace }),
}));

import { useLoginSession, consumeReturnRoute } from "@/composables/useLoginSession";
import { jwtExpiringIn } from "../helpers/jwt";

const TOKENS = { access: "a-token", refresh: "r-token", customer_id: "cust-1" };

describe("useLoginSession.completeLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { data: [{ slug: "header" }, { slug: "blog" }] } });
    mockGetUserDetails.mockResolvedValue({
      data: { data: { username: "ops", first_name: "Ann", last_name: "Lee", email: "ops@example.com", extra: { cms_lang: "EN" } } },
    });
  });

  it("stores the token pair with the expiry the access token carries", async () => {
    const access = jwtExpiringIn(300);
    await useLoginSession().completeLogin({ ...TOKENS, access });

    const auth = setAuth.mock.calls[0][0];
    expect(auth).toMatchObject({ token: access, refresh: "r-token", customer_id: "cust-1" });
    const seconds = (auth.expiryDate.getTime() - Date.now()) / 1000;
    expect(seconds).toBeGreaterThan(295);
    expect(seconds).toBeLessThanOrEqual(300);
  });

  it("loads the profile, preferences, permissions and modules", async () => {
    await useLoginSession().completeLogin(TOKENS);

    expect(mockGetUserDetails).toHaveBeenCalledWith({ uid: "cust-1" });
    expect(loadPreferences).toHaveBeenCalledWith({ cms_lang: "EN" });
    expect(setUser).toHaveBeenCalledWith({
      username: "ops",
      first_name: "Ann",
      last_name: "Lee",
      email: "ops@example.com",
      permissions: [
        { slug: "header", _for: "layout-extender", _limit: 1 },
        { slug: "blog", _for: "content", _limit: null },
      ],
    });
    expect(fetchModules).toHaveBeenCalled();
  });

  // Plan 61e: `null` is kept for "no profile answered", so the store keeps the stored hints choice only then.
  it("a profile without extra loads empty preferences, not null", async () => {
    mockGetUserDetails.mockResolvedValue({ data: { data: { username: "ops", extra: null } } });

    await useLoginSession().completeLogin(TOKENS);

    expect(loadPreferences).toHaveBeenCalledWith({});
  });

  it("does not abort when the optional profile and permissions calls fail", async () => {
    mockGetUser.mockRejectedValue(new Error("404"));
    mockGetUserDetails.mockRejectedValue(new Error("404"));

    await useLoginSession().completeLogin(TOKENS);

    expect(loadPreferences).toHaveBeenCalledWith(null);
    expect(setUser).toHaveBeenCalledWith({ username: "", first_name: "", last_name: "", email: "", permissions: [] });
    expect(fetchModules).toHaveBeenCalled();
  });

  // FIX-09 #6: a deep link opened before login passed the guard without the access check.
  it("re-runs the guard on the current route after the access check and before leaving the wall", async () => {
    await useLoginSession().completeLogin(TOKENS);

    expect(replace).toHaveBeenCalledWith({ path: "/pim/products", query: { page: "2" }, hash: "", force: true });
    expect(ensureAccessLoaded.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
    expect(replace.mock.invocationCallOrder[0]).toBeLessThan(markAuthenticated.mock.invocationCallOrder[0]);
  });
});

describe("consumeReturnRoute", () => {
  beforeEach(() => localStorage.clear());

  it("returns the stored route once and forgets it", () => {
    localStorage.setItem("cms_return_route", "/pim/products?page=2");

    expect(consumeReturnRoute()).toBe("/pim/products?page=2");
    expect(consumeReturnRoute()).toBeNull();
  });

  it("ignores the home page", () => {
    localStorage.setItem("cms_return_route", "/");

    expect(consumeReturnRoute()).toBeNull();
    expect(localStorage.getItem("cms_return_route")).toBeNull();
  });
});
