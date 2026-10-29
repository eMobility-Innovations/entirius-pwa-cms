import { describe, it, expect, beforeEach } from "vitest";
import Cookies from "universal-cookie";
import { createApiClient } from "@/api/createClient";

// FIX-17b item 11: the session-expired warning follows an expired session, never a first visit.
const unauthorized = async () => {
  const client = createApiClient("http://service.test", { tokenRefresh: true });
  client.defaults.adapter = (config) =>
    Promise.reject(Object.assign(new Error("401"), { config, response: { status: 401, config, data: {} } }));
  await client.get("/me/").catch(() => {});
};

describe("session expired flag", () => {
  const cookies = new Cookies();
  beforeEach(() => {
    localStorage.clear();
    cookies.remove("token", { path: "/" });
  });

  it("a first visit without a session is not told its session expired", async () => {
    await unauthorized();
    expect(localStorage.getItem("session_expired")).toBeNull();
  });

  it("a visit that held a token is told its session expired", async () => {
    cookies.set("token", "old", { path: "/" });
    await unauthorized();
    expect(localStorage.getItem("session_expired")).toBe("1");
  });
});
