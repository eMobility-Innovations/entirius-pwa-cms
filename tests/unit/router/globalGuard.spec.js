import { describe, it, expect, vi, beforeEach } from "vitest";

// Characterization of the global router.beforeEach: every branch is judged by where the navigation ends
// (currentRoute) and by the store side effects the user can feel, never by how the guard hands control on.
// The access, module and Leads specs next to this one cover their own corners; this one pins the order of the
// checks and the corners they leave open (public routes, signed-out visitors, token-only sessions, Munin loading).
const state = vi.hoisted(() => ({
  user: { isAuth: true, token: null },
  munin: { loaded: true },
  calls: [],
  panelEnabled: () => true,
  moduleEnabled: () => true,
  readable: new Set(),
  readAll: false,
}));

const access = vi.hoisted(() => ({ deniedPanel: null, status: "ready" }));
Object.assign(access, {
  ensureLoaded: vi.fn(async () => {
    state.calls.push("access.ensureLoaded");
  }),
  can: (area) => state.readAll || state.readable.has(area),
  canAny: (areas = []) => state.readAll || areas.some((a) => state.readable.has(a)),
});

vi.mock("@/stores/access", () => ({ useAccessStore: () => access }));
vi.mock("@/stores/user", () => ({ useUserStore: () => state.user }));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({
    get loaded() {
      return state.munin.loaded;
    },
    ensureLoaded: vi.fn(async () => {
      state.calls.push("munin.ensureLoaded");
      state.munin.loaded = true;
    }),
    isPanelEnabled: (panel) => {
      state.calls.push("munin.isPanelEnabled");
      return state.panelEnabled(panel);
    },
    isModuleEnabled: (module) => state.moduleEnabled(module),
  }),
}));

import router from "@/router";

const at = () => router.currentRoute.value;

describe("router.beforeEach", () => {
  beforeEach(async () => {
    state.user = { isAuth: true, token: null };
    state.munin = { loaded: true };
    state.calls = [];
    state.panelEnabled = () => true;
    state.moduleEnabled = () => true;
    state.readable = new Set();
    state.readAll = false;
    access.deniedPanel = null;
    access.status = "ready";
    await router.push("/ui");
    state.calls = [];
    vi.clearAllMocks();
  });

  describe("routes outside a panel", () => {
    it("lets Home and a page without meta.panel through untouched", async () => {
      state.panelEnabled = () => false;
      await router.push("/change-password");
      expect(at().path).toBe("/change-password");
      await router.push("/");
      expect(at().path).toBe("/");
      expect(state.calls).toEqual([]);
    });
  });

  describe("public routes (requiresAuth: false)", () => {
    it.each(["/password-reset", "/sso/callback?code=c&state=s"])("%s resolves with no store consulted", async (url) => {
      state.user = { isAuth: false, token: null };
      state.munin.loaded = false;
      state.panelEnabled = () => false;
      await router.push(url);
      expect(at().fullPath).toBe(url);
      expect(state.calls).toEqual([]);
    });
  });

  describe("a public route that also names a panel", () => {
    // No such route ships today; the flag still wins over the panel, so one added later stays reachable.
    it("requiresAuth: false is honoured before the panel is judged", async () => {
      const remove = router.addRoute({ path: "/t1-public", component: { render: () => null }, meta: { requiresAuth: false, panel: "pim" } });
      state.panelEnabled = () => false;
      await router.push("/t1-public");
      expect(at().path).toBe("/t1-public");
      expect(state.calls).toEqual([]);
      remove();
    });
  });

  describe("panel gating", () => {
    it("sends a route of a disabled panel to Home", async () => {
      state.panelEnabled = (p) => p !== "pim";
      await router.push("/pim/categories");
      expect(at().path).toBe("/");
    });

    it("keeps working for a panel that is enabled while another one is not", async () => {
      state.panelEnabled = (p) => p === "pim";
      state.readable.add("pim.categories");
      await router.push("/pim/categories");
      expect(at().path).toBe("/pim/categories");
      await router.push("/faq/groups");
      expect(at().path).toBe("/");
    });

    it("a disabled panel refuses even a visitor with no session", async () => {
      state.user = { isAuth: false, token: null };
      state.panelEnabled = () => false;
      await router.push("/pim/categories");
      expect(at().path).toBe("/");
    });

    it("an enabled panel lets a visitor with no session through, without loading Munin or access", async () => {
      state.user = { isAuth: false, token: null };
      state.munin.loaded = false;
      await router.push("/pim/categories");
      expect(at().path).toBe("/pim/categories");
      expect(state.calls).toEqual(["munin.isPanelEnabled"]);
    });
  });

  describe("Munin loading", () => {
    it("a signed-in user waits for Munin before the panel is judged", async () => {
      state.munin.loaded = false;
      state.readable.add("pim.categories");
      await router.push("/pim/categories");
      expect(at().path).toBe("/pim/categories");
      expect(state.calls.indexOf("munin.ensureLoaded")).toBeGreaterThanOrEqual(0);
      expect(state.calls.indexOf("munin.ensureLoaded")).toBeLessThan(state.calls.indexOf("munin.isPanelEnabled"));
    });

    it("loaded Munin is not asked again", async () => {
      state.readable.add("pim.categories");
      await router.push("/pim/categories");
      expect(state.calls).not.toContain("munin.ensureLoaded");
    });

    it("a token alone counts as signed in (the login re-runs the guard before the wall leaves)", async () => {
      state.user = { isAuth: false, token: "t" };
      state.munin.loaded = false;
      await router.push("/pim/categories");
      expect(state.calls).toContain("munin.ensureLoaded");
      expect(state.calls).toContain("access.ensureLoaded");
      expect(at().path).toBe("/");
      expect(access.deniedPanel).toBe("pim");
    });
  });

  describe("module gating", () => {
    beforeEach(() => {
      state.readAll = true;
    });

    it("a missing module sends a route to the root of its panel", async () => {
      state.moduleEnabled = (m) => m !== "leads";
      await router.push("/leads/companies/42");
      expect(at().path).toBe("/leads/inbox");
    });

    it("a missing module on the panel root goes to the panel fallback", async () => {
      state.moduleEnabled = (m) => m !== "communicator";
      await router.push("/leads/inbox");
      expect(at().path).toBe("/leads/companies");
    });

    it("a missing module on the fallback itself goes Home", async () => {
      state.moduleEnabled = (m) => m !== "leads";
      await router.push("/leads/companies");
      expect(at().path).toBe("/");
    });

    it("is judged before the access check: the panel root is reached although the route's own area is refused", async () => {
      state.readAll = false;
      state.readable.add("communicator.conversations");
      state.moduleEnabled = (m) => m !== "leads";
      await router.push("/leads/companies/42");
      expect(at().path).toBe("/leads/inbox");
      expect(access.deniedPanel).toBeNull();
    });

    it("a route with no meta.module ignores which modules exist", async () => {
      state.moduleEnabled = () => false;
      state.readable.add("pim.categories");
      await router.push("/pim/categories");
      expect(at().path).toBe("/pim/categories");
    });
  });

  describe("access gating", () => {
    it("a visitor with no session is never asked for permissions", async () => {
      state.user = { isAuth: false, token: null };
      await router.push("/pim/categories");
      expect(at().path).toBe("/pim/categories");
      expect(state.calls).not.toContain("access.ensureLoaded");
    });

    it("a refused panel root opens the first readable page", async () => {
      state.readable.add("content.media");
      await router.push("/pages/content");
      expect(at().path).toBe("/pages/gallery");
      expect(access.deniedPanel).toBeNull();
    });

    it("a refused panel fallback also opens the first readable page", async () => {
      state.readable.add("leads.companies");
      state.moduleEnabled = () => true;
      await router.push("/leads/inbox");
      expect(at().path).toBe("/leads/companies");
    });

    it("a refused root with nothing readable in the panel goes Home and names the panel", async () => {
      await router.push("/pim/products");
      expect(at().path).toBe("/");
      expect(access.deniedPanel).toBe("pim");
    });

    it("a refused inner page does not hop to a sibling: Home, panel named", async () => {
      state.readable.add("pim.categories");
      await router.push("/pim/products/SKU-1");
      expect(at().path).toBe("/");
      expect(access.deniedPanel).toBe("pim");
    });

    it("failed permissions send a refused page Home without naming the panel", async () => {
      access.status = "error";
      await router.push("/pim/products/SKU-1");
      expect(at().path).toBe("/");
      expect(access.deniedPanel).toBeNull();
    });
  });

  describe("Enricher settings entry (beforeEnter + guard)", () => {
    it("a user who reads no settings tab lands on the first tab's refusal: Home, panel named", async () => {
      await router.push("/enrichment/settings");
      expect(at().path).toBe("/");
      expect(access.deniedPanel).toBe("enricher");
    });
  });
});
