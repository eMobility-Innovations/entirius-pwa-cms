import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import Cookies from "universal-cookie";
import { setActivePinia, createPinia } from "pinia";
import { jwtExpiringIn } from "../helpers/jwt";

// With VUE_APP_DEBUG on, createClient logs every request and response body. The login call carries the password and
// answers with the token pair: flagged `sensitive`, both bodies are logged as [redacted]. The refresh call goes
// through plain axios, outside the debug interceptors, so nothing of it is logged at all. Fakes, shorter than real values.
const PASSWORD = "example-not-a-password";
const REFRESH = "example-not-a-refresh-token";
const answer = (data) => async (config) => ({ data, status: 200, statusText: "OK", headers: {}, config });

describe("debug log: login and refresh", () => {
  let log;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VUE_APP_DEBUG", "true");
    setActivePinia(createPinia());
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    new Cookies().remove("refresh", { path: "/" });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const logged = () => JSON.stringify(log.mock.calls);

  it("the login call logs neither the password nor the token pair", async () => {
    const { api } = await import("@/api/contentDB/client");
    const access = jwtExpiringIn(300);
    api.defaults.adapter = answer({ access, refresh: REFRESH });
    const { POST_Login } = await import("@/api/contentDB/api");

    expect((await POST_Login({ username: "ada@shop.test", password: PASSWORD })).data.refresh).toBe(REFRESH);

    expect(logged()).not.toContain(PASSWORD);
    expect(logged()).not.toContain(REFRESH);
    expect(logged()).not.toContain(access);
    expect(log.mock.calls.filter((call) => call.includes("[redacted]"))).toHaveLength(2);
  });

  it("the refresh call is not logged: neither the refresh token nor the new access token", async () => {
    new Cookies().set("refresh", REFRESH, { path: "/" });
    const access = jwtExpiringIn(300);
    const { refreshAccessToken } = await import("@/api/createClient");
    axios.defaults.adapter = answer({ access, refresh: REFRESH });

    expect(await refreshAccessToken()).toBe(access);

    expect(logged()).not.toContain(REFRESH);
    expect(logged()).not.toContain(access);
    expect(log).not.toHaveBeenCalled();
  });
});
