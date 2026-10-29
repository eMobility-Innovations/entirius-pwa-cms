import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const { matrixMe, upstreamMe, munin } = vi.hoisted(() => ({
  matrixMe: vi.fn(), upstreamMe: vi.fn(), munin: { installed: false },
}));
vi.mock("@/api/access/api", () => ({ GET_MatrixMe: matrixMe, GET_Me: upstreamMe }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({
  loaded: true, ensureLoaded: async () => {}, isModuleInstalled: () => munin.installed,
}) }));
import { useAccessStore } from "@/stores/access";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubEnv("VUE_APP_ACCESS_PANEL_ENABLED", "true");
  matrixMe.mockReset(); upstreamMe.mockReset(); munin.installed = false;
});
afterEach(() => vi.unstubAllEnvs());

const answer = (permissions) => matrixMe.mockResolvedValue({ data: {
  kc_username: "operator", django_username: "operator", role: "USER", permissions, groups: [], enforcing: true,
} });

describe("organization matrix is the UI permission authority", () => {
  it("uses org grants even when upstream access is absent or would disagree", async () => {
    answer(["feature:catalogue_read"]);
    const access = useAccessStore();
    expect(access.can("pim.products")).toBe(false);
    await access.ensureLoaded();
    expect(matrixMe).toHaveBeenCalledTimes(1);
    expect(upstreamMe).not.toHaveBeenCalled();
    expect(access.status).toBe("ready");
    expect(access.can("pim.products")).toBe(true);
    expect(access.can("pim.products", "write")).toBe(false);
    expect(access.can("pricemanager.prices")).toBe(false);
    expect(access.canAny(["pricemanager.prices", "pim.products"])).toBe(true);
  });

  it("maps UI areas to the permissions used by their backend routes", async () => {
    answer(["feature:catalogue_write", "feature:pricing_read", "feature:quality_write", "feature:suppliers_read", "feature:service_admin", "page:access"]);
    const access = useAccessStore(); await access.ensureLoaded();
    for (const area of ["pim.products", "pim.product_delete", "enrichment.proposals", "lookup.search"]) {
      expect(access.can(area, "write")).toBe(true);
      expect(access.can(area)).toBe(false);
    }
    for (const area of ["pricemanager.prices", "pricefighter.rules", "atlas.products"]) {
      expect(access.can(area)).toBe(true); expect(access.can(area, "write")).toBe(false);
    }
    expect(access.can("qms.stock", "write")).toBe(true);
    expect(access.can("suppliers.products")).toBe(true);
    for (const area of ["accounts.customers", "email.templates", "munin.config"]) {
      expect(access.can(area)).toBe(true); expect(access.can(area, "write")).toBe(true);
    }
    expect(access.can("access.manage")).toBe(true);
    expect(access.can("access.manage", "write")).toBe(false);
    expect(access.managesAccess).toBe(false);
    expect(access.can("unknown.area")).toBe(false);
    expect(access.can("content.pages")).toBe(false);
  });

  it("fails closed on org errors and retries without treating org as an absent module", async () => {
    matrixMe.mockRejectedValueOnce(new Error("offline"));
    const access = useAccessStore(); await access.ensureLoaded();
    expect(access.status).toBe("error"); expect(access.can("pim.products")).toBe(false);
    answer(["feature:edit_role_mappings"]); await access.ensureLoaded();
    expect(access.can("access.manage", "write")).toBe(true);
    expect(access.managesAccess).toBe(true);
    expect(upstreamMe).not.toHaveBeenCalled();
  });

  it("uses returned grants in observe mode and rejects malformed org responses", async () => {
    matrixMe.mockResolvedValueOnce({ data: { permissions: ["feature:catalogue_read"], enforcing: false } });
    const access = useAccessStore(); await access.ensureLoaded();
    expect(access.gateMode).toBe("observe");
    expect(access.can("pim.products")).toBe(true);
    expect(access.can("pricemanager.prices")).toBe(false);
    access.reset();
    matrixMe.mockResolvedValueOnce({ data: { permissions: { "pim.products": "write" } } });
    await access.ensureLoaded();
    expect(access.status).toBe("error");
    expect(access.can("pim.products")).toBe(false);
    expect(upstreamMe).not.toHaveBeenCalled();
  });

  it("retains the upstream authority unchanged when the org flag is off", async () => {
    vi.stubEnv("VUE_APP_ACCESS_PANEL_ENABLED", "false"); munin.installed = true;
    upstreamMe.mockResolvedValue({ data: { permissions: { "pim.products": "write" }, manages_access: true } });
    const access = useAccessStore(); await access.ensureLoaded();
    expect(upstreamMe).toHaveBeenCalledTimes(1); expect(matrixMe).not.toHaveBeenCalled();
    expect(access.can("pim.products", "write")).toBe(true);
    expect(access.managesAccess).toBe(true);
  });
});
