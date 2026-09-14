/**
 * With SSO off the callback path must not be a ROUTE — not merely a route that renders
 * nothing. This is the guard that keeps every existing deployment byte-identical, so it
 * is asserted against the real router, not only against the route factory.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { ssoRoutes } from "@/router/sso-routes";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadRouter(flag) {
  vi.resetModules();
  vi.stubEnv("VUE_APP_SSO_ENABLED", flag);
  const mod = await import("@/router/index.js");
  return mod.default;
}

describe("ssoRoutes()", () => {
  it("contributes nothing when the flag is off", () => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "false");
    expect(ssoRoutes()).toEqual([]);
  });

  it("contributes one unauthenticated route when the flag is on", () => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "true");
    const routes = ssoRoutes();

    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/sso/callback");
    expect(routes[0].name).toBe("SsoCallback");
    // requiresAuth must be exactly false: App.vue tests `=== false` to decide whether to
    // render the route instead of the login wall. `undefined` renders the login wall and
    // the callback never runs.
    expect(routes[0].meta.requiresAuth).toBe(false);
  });
});

describe("the router itself", () => {
  it("does not know the callback path when SSO is off", async () => {
    const router = await loadRouter("false");

    expect(router.hasRoute("SsoCallback")).toBe(false);
    expect(router.resolve("/sso/callback").matched).toHaveLength(0);
  });

  it("resolves the callback path when SSO is on", async () => {
    const router = await loadRouter("true");

    expect(router.hasRoute("SsoCallback")).toBe(true);
    const resolved = router.resolve("/sso/callback");
    expect(resolved.matched).toHaveLength(1);
    expect(resolved.meta.requiresAuth).toBe(false);
  });
});
