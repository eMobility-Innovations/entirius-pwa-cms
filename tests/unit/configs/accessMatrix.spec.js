import { describe, it, expect, afterEach } from "vitest";
import { isAccessPanelEnabled, accessApiBase } from "@/configs/accessMatrix";

// Both functions read process.env at CALL time, so a plain assignment is enough here —
// no vi.resetModules(), unlike the route module which reads it at import time.
const originalEnabled = process.env.VUE_APP_ACCESS_PANEL_ENABLED;
const originalBase = process.env.VUE_APP_ACCESS_API_BASE;

describe("the access panel flag", () => {
  afterEach(() => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = originalEnabled;
    process.env.VUE_APP_ACCESS_API_BASE = originalBase;
  });

  it("is off when the variable is unset, so an untouched deployment is unchanged", () => {
    delete process.env.VUE_APP_ACCESS_PANEL_ENABLED;
    expect(isAccessPanelEnabled()).toBe(false);
  });

  it("is on only for the exact string \"true\"", () => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "TRUE";
    expect(isAccessPanelEnabled()).toBe(true);
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "1";
    expect(isAccessPanelEnabled()).toBe(false);
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "yes";
    expect(isAccessPanelEnabled()).toBe(false);
  });

  it("defaults the base path but lets a deployment point it elsewhere", () => {
    delete process.env.VUE_APP_ACCESS_API_BASE;
    expect(accessApiBase()).toBe("/api/escaccess/v2");
    process.env.VUE_APP_ACCESS_API_BASE = "/api/authz/v1";
    expect(accessApiBase()).toBe("/api/authz/v1");
  });
});
