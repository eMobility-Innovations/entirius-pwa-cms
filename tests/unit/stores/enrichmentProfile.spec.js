import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const api = vi.hoisted(() => ({ GET_ProfileStatus: vi.fn(), GET_Memory: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/api/munin/api", () => ({ GET_ConfigHealth: vi.fn(), POST_ConfigHealthCheck: vi.fn(), GET_Modules: vi.fn() }));

import { PROFILE_ROUTE, profileHealthRow, useEnrichmentProfileStore } from "@/stores/enrichmentProfile";
import { useConfigHealthStore } from "@/stores/configHealth";
import { navTree } from "@/composables/useNav";
import { t } from "@/i18n";

const INCOMPLETE = {
  channel: "",
  complete: false,
  sections: [{ key: "brand", complete: true }, { key: "facts", complete: false }, { key: "tone", complete: false }],
};
const memory = (counts) => ({ kind }) => Promise.resolve({ data: { count: counts[kind] ?? 0, results: [] } });

describe("company profile health", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
    api.GET_ProfileStatus.mockResolvedValue({ data: INCOMPLETE });
    api.GET_Memory.mockImplementation(memory({ rule_suggestion: 2, fact_suggestion: 1 }));
  });
  afterEach(() => vi.useRealTimers());

  it("an incomplete profile is a health row naming what is missing, linking to the profile", () => {
    expect(profileHealthRow(INCOMPLETE)).toEqual({
      code: "enrichment.profile", state: "incomplete", severity: "low",
      scope: `${t("enrichment.profile.sections.facts")}, ${t("enrichment.profile.sections.tone")}`, fix_url: PROFILE_ROUTE,
    });
    expect(profileHealthRow({ complete: true, sections: [] }).state).toBe("configured");
    expect(profileHealthRow(null)).toBeNull();
  });

  it("refresh reads the whole-company status and counts the waiting suggestions", async () => {
    const store = useEnrichmentProfileStore();
    await store.refresh();
    expect(api.GET_ProfileStatus).toHaveBeenCalledWith({ channel: "" });
    expect(api.GET_Memory).toHaveBeenCalledWith({ kind: "rule_suggestion", status: "active", page_size: 1 });
    expect(store.pendingSuggestions).toBe(3);
  });

  it("polls while started; stop forgets everything and drops a late answer", async () => {
    const store = useEnrichmentProfileStore();
    store.start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.GET_ProfileStatus).toHaveBeenCalledTimes(2);
    let late;
    api.GET_ProfileStatus.mockReturnValue(new Promise((resolve) => (late = resolve)));
    await vi.advanceTimersByTimeAsync(60000);
    store.stop();
    late({ data: INCOMPLETE });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.status).toBeNull();
    expect(store.pendingSuggestions).toBe(0);
  });

  it("configuration health lists the profile among the failing checks, and as passing once complete", async () => {
    const health = useConfigHealthStore();
    const store = useEnrichmentProfileStore();
    expect(health.failing).toEqual([]);
    await store.refresh();
    expect(health.failing.map((row) => row.code)).toEqual(["enrichment.profile"]);
    api.GET_ProfileStatus.mockResolvedValue({ data: { ...INCOMPLETE, complete: true } });
    await store.refresh();
    expect(health.failing).toEqual([]);
    expect(health.passing.map((row) => row.code)).toEqual(["enrichment.profile"]);
  });

  it("the Settings nav entry carries the waiting suggestions as its count", () => {
    const routes = [
      { route: "/enrichment/settings", app: ["enricher"], badge: "memorySuggestions" },
      { route: "/enrichment/studio", app: ["enricher"] },
    ];
    const entries = navTree({ isDesktop: true, counts: { memorySuggestions: 3 } }, routes).enricher;
    expect(entries.map((e) => e.count)).toEqual([3, undefined]);
    expect(navTree({ isDesktop: true }, routes).enricher[0].count).toBe(0);
  });
});
