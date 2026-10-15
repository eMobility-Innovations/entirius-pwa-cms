import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Proposal: vi.fn(), POST_ReviseProposal: vi.fn(), POST_SuggestFact: vi.fn(), GET_ProfileVersions: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());
const can = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ refresh }) }));
vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can }) }));

import QaWarnings from "@/views/EnrichmentReview/QaWarnings.vue";
import ProfileUsageNote from "@/views/EnrichmentReview/ProfileUsageNote.vue";
import { clearProfileCache, mergeProfiles, usedSections } from "@/views/EnrichmentReview/profileUsage";

const NUMBER = { code: "NUMBER_NOT_IN_FACTS", message: "The number 25% is not in the facts registry.", span: { start: 4, end: 7, text: "25%" } };
const RULE = { code: "rule", message: "Say 'affordable', not 'cheap'.", span: null };
const proposal = (extra = {}) => ({ id: 7, status: "pending", proposed_value: { text: "Now 25% off, cheap!" }, warnings: [NUMBER, RULE], ...extra });

describe("QaWarnings", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    refresh.mockReset();
  });

  it("lists the warnings in plain words; a number gets Add to facts", () => {
    const w = mount(QaWarnings, { props: { proposal: proposal() } });
    expect(w.find("[data-testid='qa-warning-NUMBER_NOT_IN_FACTS']").text()).toContain("enrichment.qa.number_message");
    expect(w.find("[data-testid='qa-warning-rule']").text()).toContain("Say 'affordable', not 'cheap'.");
    expect(w.findAll("[data-testid='qa-add-fact']")).toHaveLength(1);
  });

  it("Add to facts leaves a fact suggestion and refreshes the Memory badge", async () => {
    api.POST_SuggestFact.mockResolvedValue({ data: { id: 3 } });
    const w = mount(QaWarnings, { props: { proposal: proposal() } });
    w.vm.suggestFact(NUMBER);
    await flushPromises();
    expect(api.POST_SuggestFact).toHaveBeenCalledWith(7, { value: "25%", label: "Now 25% off, cheap!" });
    expect(refresh).toHaveBeenCalled();
    expect(w.vm.suggested).toEqual(["25%"]);
  });

  it("an applied proposal still shows its warnings; none renders nothing", () => {
    expect(mount(QaWarnings, { props: { proposal: proposal({ status: "applied" }) } }).findAll("li")).toHaveLength(2);
    const none = mount(QaWarnings, { props: { proposal: proposal({ warnings: [] }) } });
    expect(none.find("[data-testid='qa-warnings']").exists()).toBe(false);
  });
});

describe("profile usage", () => {
  const DATA = {
    brand: { text: "We make sofas." },
    tone: { text: "Calm." },
    persona: { text: "", personas: [] },
    facts: [{ id: "f1" }, { id: "f2" }, { id: "f3" }, { id: "f4" }],
  };

  it("names the routed sections with content, facts and brand first", () => {
    expect(usedSections({ data: DATA, taskType: "pim.writer", kind: "write" })).toEqual([
      { key: "facts", count: 4 }, { key: "brand" }, { key: "tone" },
    ]);
    const routed = { ...DATA, routing: { "pim.writer": ["tone", "facts"] } };
    expect(usedSections({ data: routed, taskType: "pim.writer", kind: "write" })).toEqual([{ key: "facts", count: 4 }, { key: "tone" }]);
  });

  it("an overlay replaces whole sections it fills", () => {
    expect(mergeProfiles({ tone: { text: "A" }, brand: { text: "B" } }, { tone: { text: "C" }, brand: { text: "" } })).toEqual({
      tone: { text: "C" }, brand: { text: "B" },
    });
  });

  it("the note reads the snapshots the task used, not the live profile, and only for a task that used one", async () => {
    clearProfileCache();
    const versions = {
      "": [{ id: 12, data: { brand: { text: "Edited later." } } }, { id: 4, data: DATA }],
      eu: [{ id: 9, data: { tone: { text: "Eu." } } }],
    };
    api.GET_ProfileVersions.mockImplementation(({ channel }) => Promise.resolve({ data: versions[channel] }));
    const $t = (key, params) => (params ? `${key}:${params.sections}` : `T:${key}`);
    const task = { id: 1, type: "pim.writer", params: { channel: "eu" }, profile_versions: [4, 9] };
    const w = mount(ProfileUsageNote, { props: { proposal: proposal(), task }, global: { mocks: { $t } } });
    await flushPromises();
    expect(w.find("[data-testid='profile-usage-text']").text()).toBe(
      "enrichment.profile.used:T:enrichment.profile.sections.facts (4) · T:enrichment.profile.sections.brand · T:enrichment.profile.sections.tone"
    );
    expect(w.text()).toContain("T:enrichment.profile.used_hint");
    expect(api.GET_ProfileVersions).toHaveBeenCalledWith({ channel: "eu" });
    const none = mount(ProfileUsageNote, { props: { proposal: proposal(), task: { ...task, profile_versions: [] } } });
    await flushPromises();
    expect(none.find("[data-testid='profile-usage']").exists()).toBe(false);
  });
});
