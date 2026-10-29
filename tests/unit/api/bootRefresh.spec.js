import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import Cookies from "universal-cookie";
import { setActivePinia, createPinia } from "pinia";
import { muninApi } from "@/api/munin/client";
import { useUserStore } from "@/stores/user";
import router from "@/router";
import { jwtExpiringIn } from "../helpers/jwt";

// r04 §9 defect 2: a cold load with an expired access token. Munin answers the stale token anonymously (no 401,
// so no retry), the guard saw no admin data and sent every panel outside VUE_APP_PANELS to "/".
const cookies = new Cookies();
const FRESH = jwtExpiringIn(300);
const ADMIN_MODULES = { modules: { atlas: { enabled_in_cms: true } } };
const PUBLIC_MODULES = { modules: { atlas: {} } };

describe("cold load with an expired access token", () => {
  let calls;

  beforeEach(() => {
    calls = [];
    localStorage.clear();
    setActivePinia(createPinia());
    cookies.set("token", "stale-token", { path: "/" });
    cookies.set("expiryDate", new Date(Date.now() - 60_000), { path: "/" });
    cookies.set("refresh", "r-token", { path: "/" });
    cookies.set("isAuth", true, { path: "/" });
    muninApi.defaults.adapter = async (config) => {
      calls.push("munin");
      const data = config.headers.Authorization === `Bearer ${FRESH}` ? ADMIN_MODULES : PUBLIC_MODULES;
      return { data, status: 200, statusText: "OK", headers: {}, config };
    };
    useUserStore().appInit();
  });

  afterEach(() => {
    useUserStore().clearAuth();
    vi.restoreAllMocks();
  });

  it("refreshes before the Munin fetch and keeps the panel route", async () => {
    vi.spyOn(axios, "post").mockImplementation(async () => {
      calls.push("refresh");
      return { data: { data: { access: FRESH } } };
    });

    await router.push("/atlas/list");

    expect(calls).toEqual(["refresh", "munin"]);
    expect(router.currentRoute.value.path).toBe("/atlas/list");
    expect(cookies.get("token")).toBe(FRESH);
  });

  it("a failed refresh takes the session-expired logout path", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("401"));

    await router.push("/atlas/auto-matched");

    expect(calls).toEqual([]);
    expect(localStorage.getItem("session_expired")).toBe("1");
    expect(cookies.get("refresh")).toBeUndefined();
  });
});
