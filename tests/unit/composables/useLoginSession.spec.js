import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockGetUserDetails = vi.fn();
const setAuth = vi.fn();
const setUser = vi.fn();
const loadPreferences = vi.fn();
const fetchModules = vi.fn();

vi.mock("@/api/contentDB/api", () => ({
  GET_User: (...a) => mockGetUser(...a),
  GET_UserDetails: (...a) => mockGetUserDetails(...a),
}));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({ setAuth, setUser, loadPreferences }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ fetchModules }),
}));

import { useLoginSession, consumeReturnRoute } from "@/composables/useLoginSession";

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

  it("stores the token pair with a 15-minute expiry", async () => {
    const before = Date.now();
    await useLoginSession().completeLogin(TOKENS);

    const auth = setAuth.mock.calls[0][0];
    expect(auth).toMatchObject({ token: "a-token", refresh: "r-token", customer_id: "cust-1" });
    const minutes = (auth.expiryDate.getTime() - before) / 60000;
    expect(minutes).toBeGreaterThanOrEqual(14.9);
    expect(minutes).toBeLessThanOrEqual(15.1);
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

  it("does not abort when the optional profile and permissions calls fail", async () => {
    mockGetUser.mockRejectedValue(new Error("404"));
    mockGetUserDetails.mockRejectedValue(new Error("404"));

    await useLoginSession().completeLogin(TOKENS);

    expect(loadPreferences).toHaveBeenCalledWith(null);
    expect(setUser).toHaveBeenCalledWith({ username: "", first_name: "", last_name: "", email: "", permissions: [] });
    expect(fetchModules).toHaveBeenCalled();
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
