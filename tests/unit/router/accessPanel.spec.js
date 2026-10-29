import { describe, it, expect, vi, beforeEach } from "vitest";

// Access plan 20: the Access panel (munin key `access`) is there only for a user who can read access.manage.
const readable = new Set();
const access = {
  status: "ready",
  deniedPanel: null,
  ensureLoaded: vi.fn(() => Promise.resolve()),
  can: vi.fn((area) => readable.has(area)),
  canAny: vi.fn((areas = []) => areas.some((area) => readable.has(area))),
};
vi.mock("@/stores/access", () => ({ useAccessStore: () => access }));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ loaded: true, isPanelEnabled: () => true, isModuleEnabled: () => true, ensureLoaded: vi.fn() }),
}));
vi.mock("@/api/munin/api", () => ({
  GET_Modules: async () => ({ data: { modules: { access: { enabled_in_cms: true }, faq: { enabled_in_cms: true } } } }),
}));
vi.mock("@/stores/user", () => ({ useUserStore: () => ({ isAuth: true }) }));

import router from "@/router";
import { panels } from "@/configs/access";
import { createPinia, setActivePinia } from "pinia";
import { buildNavRoutes, filterNavRoutes } from "@/components/Navigation/nav-routes";

const accessPanel = panels.find((panel) => panel.idx === "access");

describe("Access panel", () => {
  beforeEach(async () => {
    readable.clear();
    await router.push("/ui");
  });

  it("is registered: munin key, registry entry on access.manage, Roles, Staff, Groups, Applications and Audit nav entries", async () => {
    const { useMuninStore } = await vi.importActual("@/stores/munin");
    setActivePinia(createPinia());
    const munin = useMuninStore();
    await munin.fetchModules();
    expect(munin.isPanelEnabled("access")).toBe(true);
    expect(accessPanel).toMatchObject({ root: "/access/roles", areas: ["access.manage"] });
    const nav = filterNavRoutes(buildNavRoutes(), { panel: "access" });
    expect(nav.map((entry) => entry.route)).toEqual(["/access/roles", "/access/staff", "/access/groups", "/access/applications", "/access/audit"]);
  });

  it("is hidden and refused without access.manage read", async () => {
    readable.add("pim.products");
    expect(access.canAny(accessPanel.areas)).toBe(false);
    await router.push("/access/roles/viewer");
    expect(router.currentRoute.value.path).toBe("/");
    expect(access.deniedPanel).toBe("access");
  });

  it("opens with access.manage read", async () => {
    readable.add("access.manage");
    expect(access.canAny(accessPanel.areas)).toBe(true);
    await router.push("/access/roles/viewer");
    expect(router.currentRoute.value.path).toBe("/access/roles/viewer");
    expect(router.currentRoute.value.meta).toMatchObject({ panel: "access", area: "access.manage" });
  });

  it("staff, groups, applications and audit routes sit on access.manage", async () => {
    readable.add("access.manage");
    const paths = ["/access/staff", "/access/staff/12", "/access/groups", "/access/applications", "/access/applications/new"];
    for (const path of [...paths, "/access/applications/3", "/access/audit"]) {
      await router.push(path);
      expect(router.currentRoute.value.path).toBe(path);
      expect(router.currentRoute.value.meta).toMatchObject({ panel: "access", area: "access.manage" });
    }
  });
});
