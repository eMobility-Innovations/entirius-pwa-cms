import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Cookies from "universal-cookie";
import { setActivePinia, createPinia } from "pinia";
import { useUserStore } from "@/stores/user";

// The session cookies hold the access and refresh tokens. They are never sent on a request from another site
// (`sameSite: strict`) and, on an https page, never over plain http (`secure`); local http development keeps working.
const SESSION = { token: "a-token", refresh: "r-token", customer_id: "cust-1", expiryDate: Date.now() + 300000 };
const USER = { username: "ada", email: "ada@shop.test" };

describe("user store: session cookie attributes", () => {
  let set;

  const login = () => {
    const store = useUserStore();
    store.setAuth(SESSION);
    store.setUser(USER);
    store.markAuthenticated();
  };
  const written = () => Object.fromEntries(set.mock.calls.map(([name, , options]) => [name, options]));

  beforeEach(() => {
    setActivePinia(createPinia());
    set = vi.spyOn(Cookies.prototype, "set");
  });

  afterEach(() => {
    useUserStore().clearAuth();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("over https every session cookie is secure and sameSite strict", () => {
    vi.stubGlobal("location", { ...window.location, protocol: "https:" });
    login();
    const cookies = written();
    expect(Object.keys(cookies).sort()).toEqual(["customer_id", "expiryDate", "isAuth", "refresh", "token", "user"]);
    for (const options of Object.values(cookies)) {
      expect(options).toMatchObject({ path: "/", sameSite: "strict", secure: true });
    }
  });

  it("over http the cookies are sameSite strict and not secure, so the session still holds", () => {
    vi.stubGlobal("location", { ...window.location, protocol: "http:" });
    login();
    for (const options of Object.values(written())) {
      expect(options).toMatchObject({ path: "/", sameSite: "strict", secure: false });
    }
    expect(new Cookies().get("token")).toBe("a-token");
  });
});
