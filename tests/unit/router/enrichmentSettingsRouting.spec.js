import { describe, it, expect, vi, beforeEach } from "vitest";

// The areas the user can read; the rest are refused.
const readable = vi.hoisted(() => ({ areas: [] }));
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({
    can: (area) => readable.areas.includes(area),
    canAny: (areas = []) => areas.some((area) => readable.areas.includes(area)),
    ensureLoaded: () => Promise.resolve(),
    available: true,
    status: "ready",
  }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ loaded: true, isPanelEnabled: () => true, isModuleEnabled: () => true, ensureLoaded: vi.fn() }),
}));
vi.mock("@/stores/user", () => ({ useUserStore: () => ({ isAuth: true }) }));

import router from "@/router";

describe("Enricher → Settings routing", () => {
  beforeEach(async () => {
    await router.push("/");
  });

  it("opens the Profile tab for a user who can read the profile", async () => {
    readable.areas = ["enrichment.profile", "enrichment.proposals", "enrichment.rules"];
    await router.push("/enrichment/settings");
    expect(router.currentRoute.value.name).toBe("EnrichmentProfile");
  });

  it("a reviewer without the profile area lands on AI templates, not Home", async () => {
    readable.areas = ["enrichment.proposals"];
    await router.push("/enrichment/settings");
    expect(router.currentRoute.value.name).toBe("EnrichmentTemplates");
  });

  it("a user with spawn rules only lands on Spawn rules", async () => {
    readable.areas = ["enrichment.rules"];
    await router.push("/enrichment/settings");
    expect(router.currentRoute.value.name).toBe("EnrichmentSpawnRules");
  });
});
