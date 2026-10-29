import { describe, it, expect, vi, beforeEach } from "vitest";

// Plan 18: the third guard check — read on the route's `meta.area` (or any area of its panel) or back to Home with
// the refused panel named; routes outside a panel are untouched.
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
vi.mock("@/stores/user", () => ({ useUserStore: () => ({ isAuth: true }) }));

import router from "@/router";

describe("router access guard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    readable.clear();
    access.deniedPanel = null;
    access.status = "ready";
    await router.push("/ui");
  });

  it("lets a route through when its area is readable", async () => {
    readable.add("pim.products");
    await router.push("/pim/products");
    expect(router.currentRoute.value.path).toBe("/pim/products");
    expect(access.ensureLoaded).toHaveBeenCalled();
    expect(access.can).toHaveBeenCalledWith("pim.products");
  });

  it("sends a route without read on its area to Home and names the panel", async () => {
    readable.add("pim.categories");
    await router.push("/pim/products/SKU-1");
    expect(router.currentRoute.value.path).toBe("/");
    expect(access.deniedPanel).toBe("pim");
  });

  it("a route without its own area needs read on any area of its panel", async () => {
    await router.push("/translation-jobs");
    expect(router.currentRoute.value.path).toBe("/");
    expect(access.deniedPanel).toBe("translation");

    readable.add("contentdb_translator.translate");
    await router.push("/translation-jobs");
    expect(router.currentRoute.value.path).toBe("/translation-jobs");
  });

  it("a refused panel root opens the panel's first readable page", async () => {
    readable.add("pim.categories");
    await router.push("/pim/products");
    expect(router.currentRoute.value.path).toBe("/pim/categories");
    expect(access.deniedPanel).toBeNull();
  });

  it("names no panel when the permissions failed to load (Home says that)", async () => {
    access.status = "error";
    await router.push("/faq/groups");
    expect(router.currentRoute.value.path).toBe("/");
    expect(access.deniedPanel).toBeNull();
  });

  it("leaves routes outside a panel untouched", async () => {
    await router.push("/change-password");
    expect(router.currentRoute.value.path).toBe("/change-password");
    expect(access.ensureLoaded).not.toHaveBeenCalled();
    expect(access.deniedPanel).toBeNull();
  });
});
