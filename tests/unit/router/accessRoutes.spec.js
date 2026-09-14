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
    const leaves = routes.flatMap((r) => r.children || []);
    expect(leaves.map((r) => r.path)).toContain("grants");
    expect(routes.every((r) => r.meta.requiresAuth)).toBe(true);
    expect(routes.every((r) => r.meta.panel === "access")).toBe(true);
  });

  it("never registers a path outside /access, so it cannot shadow another panel", () => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
    expect(accessRoutes().every((r) => r.path.startsWith("/access"))).toBe(true);
  });

  // THE SHELL HAS TO BE ON THE PATH. views/Access/index.vue holds the only call to
  // ensureLoaded(), the `page:access` check and the "you hold no grant" message — and it
  // was registered nowhere, so the five leaf views were mounted directly. On that path the
  // store never loaded, `canWrite` was false for everybody, and the deployed panel showed
  // no grant form and no revoke buttons to anyone at all, including a SYSADMIN.
  it("mounts every view inside the shell that loads the matrix and checks the grant", () => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
    const routes = accessRoutes();

    expect(routes).toHaveLength(1);
    const [shell] = routes;
    expect(shell.path).toBe("/access");
    expect(shell.component).toBeTypeOf("function");
    expect(shell.children.map((c) => c.name)).toEqual([
      "AccessGrants",
      "AccessRoles",
      "AccessUsers",
      "AccessAudit",
      "AccessServiceAccounts",
    ]);
  });

  it("still answers on the paths the panel links to", () => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
    const [shell] = accessRoutes();

    // Children are relative; these are the absolute paths HeaderControls and the shell's
    // own tabs point at, so a change here breaks every link in the panel.
    const absolute = shell.children.map((c) => `${shell.path}/${c.path}`);
    expect(absolute).toContain("/access/grants");
    expect(absolute).toContain("/access/roles");
    expect(absolute).toContain("/access/users");
    expect(absolute).toContain("/access/audit");
    expect(absolute).toContain("/access/service-accounts");
  });

});
