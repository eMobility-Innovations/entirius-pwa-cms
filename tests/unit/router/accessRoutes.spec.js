import { describe, it, expect, afterEach } from "vitest";
import { accessRoutes } from "@/router/access-routes";

// `accessRoutes` is a FUNCTION, matching `ssoRoutes` in sso-routes.js — the sibling this
// overlay follows. Deciding at CALL time rather than at module load is what lets a spec
// flip the variable without vi.resetModules(), and it is the idiom already in this folder.
const original = process.env.VUE_APP_ACCESS_PANEL_ENABLED;

describe("access panel routes", () => {
  afterEach(() => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = original;
  });

  it("registers nothing when the flag is off", () => {
    delete process.env.VUE_APP_ACCESS_PANEL_ENABLED;
    expect(accessRoutes()).toEqual([]);
  });

  it("registers the panel routes when the flag is on", () => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
    const routes = accessRoutes();
    expect(routes.map((r) => r.path)).toContain("/access/grants");
    expect(routes.every((r) => r.meta.requiresAuth)).toBe(true);
    expect(routes.every((r) => r.meta.panel === "access")).toBe(true);
  });

  it("never registers a path outside /access/, so it cannot shadow another panel", () => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
    expect(accessRoutes().every((r) => r.path.startsWith("/access/"))).toBe(true);
  });
});
