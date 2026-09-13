import { describe, it, expect, vi, beforeEach } from "vitest";

// The voucher detail view fetches /api/checkout-voucher/* on mount, so its
// route must not resolve when the module is missing — even with the promo
// panel enabled (Discounts are served by django-checkout alone).

const mockIsPanelEnabled = vi.fn();
const mockIsModuleEnabled = vi.fn();

vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({
    loaded: true,
    isPanelEnabled: mockIsPanelEnabled,
    isModuleEnabled: mockIsModuleEnabled,
    ensureLoaded: vi.fn(),
  }),
}));

vi.mock("@/stores/user", () => ({
  useUserStore: () => ({ isAuth: true, activeApp: null }),
}));

import router from "@/router";

describe("router meta.module guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPanelEnabled.mockReturnValue(true);
  });

  it("redirects a voucher deep link to the panel root when the module is absent", async () => {
    mockIsModuleEnabled.mockReturnValue(false);

    await router.push("/promo/voucher/5");

    expect(router.currentRoute.value.path).toBe("/promo/list");
    expect(mockIsModuleEnabled).toHaveBeenCalledWith("checkout_voucher");
  });

  it("resolves the voucher route when the module is enabled", async () => {
    mockIsModuleEnabled.mockReturnValue(true);

    await router.push("/promo/voucher/5");

    expect(router.currentRoute.value.path).toBe("/promo/voucher/5");
  });

  it("resolves the SSO callback without a session or panel check", async () => {
    mockIsPanelEnabled.mockReturnValue(false);

    await router.push("/sso/callback?code=c&state=s");

    expect(router.currentRoute.value.path).toBe("/sso/callback");
    expect(mockIsPanelEnabled).not.toHaveBeenCalled();
  });
});
