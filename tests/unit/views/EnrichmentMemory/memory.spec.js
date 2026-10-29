import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { briefOf, byExpiry, memoryParams, originLink, pinnedKinds, promoteTarget, subjectKey } from "@/views/EnrichmentMemory/memoryLogic";

const api = vi.hoisted(() => ({ GET_Memory: vi.fn(), PATCH_Memory: vi.fn(), DELETE_Memory: vi.fn(), POST_PromoteMemory: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ refresh }) }));
vi.mock("@/views/EnrichmentProfile/useProfileChannels", () => ({
  useProfileChannels: () => ({ options: [{ value: "", label: "Whole company" }, { value: "eu", label: "Europe shop" }], load: vi.fn() }),
}));

import MemoryList from "@/views/EnrichmentMemory/MemoryList.vue";
import MemoryEntry from "@/views/EnrichmentMemory/MemoryEntry.vue";

const NOW = Date.parse("2026-10-15T00:00:00Z");
const entry = (id, kind, extra = {}) => ({
  id, kind, status: "active", channel: "", subject_module: "", subject_ref: "", title: `t${id}`, text: "", data: {},
  expires_at: null, created_at: "2026-10-14T10:00:00Z", ...extra,
});
const BRIEF = entry(1, "seo_brief", {
  subject_ref: "SOFAS", expires_at: "2027-01-01T00:00:00Z",
  data: { primary: "modular sofa", secondary: ["sofa bed"], intent: "commercial", language: "en" },
});
const RULE = entry(2, "rule_suggestion", { text: "Never say cheap", data: { pattern: "\\bcheap\\b" } });
const FACT = entry(3, "fact_suggestion", { text: "25%", data: { value: "25%" } });
const OLD = entry(4, "answer", { expires_at: "2026-01-01T00:00:00Z" });

describe("memory logic", () => {
  it("pins waiting suggestions only when the kind and state filters can include them", () => {
    expect(pinnedKinds("", "active")).toEqual(["rule_suggestion", "fact_suggestion"]);
    expect(pinnedKinds("", "")).toEqual(["rule_suggestion", "fact_suggestion"]);
    expect(pinnedKinds("fact_suggestion", "active")).toEqual(["fact_suggestion"]);
    expect(pinnedKinds("seo_brief", "active")).toEqual([]);
    expect(pinnedKinds("", "dismissed")).toEqual([]);
  });

  it("names a subject by its module, never by its ref", () => {
    expect(subjectKey(BRIEF)).toBe("item");
    expect(subjectKey({ ...BRIEF, subject_module: "pim" })).toBe("catalogue");
    expect(subjectKey({ ...BRIEF, subject_module: "enrichment", subject_ref: "run:3f2a" })).toBe("studio_run");
    expect(subjectKey(RULE)).toBe("general");
  });

  it("links an entry back to its Studio article, proposal or product, never naming its ref", () => {
    expect(originLink({ subject_ref: "run:ab12" }).to).toEqual({ name: "EnrichmentStudioRun", params: { uid: "ab12" } });
    expect(originLink({ subject_ref: "", source: "run:cd34" }).to.params.uid).toBe("cd34");
    expect(originLink({ subject_ref: "", source: "proposal:7" }).to).toEqual({ name: "EnrichmentProposalEditor", params: { proposalId: "7" } });
    expect(originLink({ subject_module: "pim", subject_ref: "ENT-S001" }).label).toBe("open_product");
    expect(originLink({ subject_module: "pim", subject_ref: "category:bedroom" })).toBeNull();
    expect(originLink({ subject_ref: "" })).toBeNull();
  });

  it("filters by expiry", () => {
    expect(byExpiry([BRIEF, OLD], "current", NOW)).toEqual([BRIEF]);
    expect(byExpiry([BRIEF, OLD], "expired", NOW)).toEqual([OLD]);
    expect(byExpiry([BRIEF, OLD], "all", NOW)).toHaveLength(2);
  });

  it("sends a fact to facts, a rule with a pattern to the checked rules, a plain rule to always-rules", () => {
    expect(promoteTarget(FACT)).toBe("facts");
    expect(promoteTarget(RULE)).toBe("rules");
    expect(promoteTarget({ ...RULE, data: {} })).toBe("always_rules");
    expect(promoteTarget(BRIEF)).toBeNull();
  });

  it("reads an SEO brief and builds only the filters that are set", () => {
    expect(briefOf(BRIEF)).toEqual({ primary: "modular sofa", secondary: ["sofa bed"], intent: "commercial", language: "en" });
    expect(memoryParams({ kind: "", status: "active", subject: " SKU-1 ", page: 2, pageSize: 25 })).toEqual({
      page: 2, page_size: 25, status: "active", subject_ref: "SKU-1",
    });
  });
});

describe("MemoryEntry", () => {
  const stubs = { Tag: true, IconButton: true };

  it("shows an SEO brief readably, without technical ids", () => {
    const w = mount(MemoryEntry, { props: { entry: BRIEF }, global: { stubs } });
    expect(w.find("[data-testid='memory-brief-primary']").text()).toBe("modular sofa");
    expect(w.find("[data-testid='memory-brief-secondary']").text()).toBe("sofa bed");
    expect(w.find("[data-testid='memory-promote']").exists()).toBe(false);
  });

  it("shows the channel name and the kind of subject, not their ids", () => {
    const w = mount(MemoryEntry, { props: { entry: { ...BRIEF, subject_module: "pim", channel: "eu" } }, global: { stubs } });
    const meta = w.find(".memory-entry__meta").text();
    expect(meta).toContain("Europe shop");
    expect(meta).not.toContain("SOFAS");
    expect(meta).not.toContain("eu ·");
  });

  it("a waiting suggestion offers Add to profile and Dismiss; a promoted one only Delete", () => {
    const w = mount(MemoryEntry, { props: { entry: RULE }, global: { stubs } });
    expect(w.find("[data-testid='memory-promote']").exists()).toBe(true);
    expect(w.find("[data-testid='memory-dismiss']").exists()).toBe(true);
    const done = mount(MemoryEntry, { props: { entry: { ...RULE, status: "promoted" } }, global: { stubs } });
    expect(done.find("[data-testid='memory-promote']").exists()).toBe(false);
    expect(done.find("[data-testid='memory-dismiss']").exists()).toBe(false);
  });

  it("a fact suggestion is titled by the sentence of its number and shows the number as its value", () => {
    const fact = { ...FACT, title: "Now 25% off all sofas.", data: { value: "25%", label: "Now 25% off all sofas." } };
    const w = mount(MemoryEntry, { props: { entry: fact }, global: { stubs } });
    expect(w.find(".memory-entry__title").text()).toBe("Now 25% off all sofas.");
    expect(w.find("[data-testid='memory-fact-value']").text()).toBe("25%");
  });

  it("a fact suggestion saved without its sentence says what the bare number is", () => {
    const w = mount(MemoryEntry, { props: { entry: { ...FACT, title: "25%" } }, global: { stubs } });
    expect(w.find(".memory-entry__title").text()).toBe('enrichment.memory.fact_title::{"value":"25%"}');
  });

  it("a waiting suggestion's state reads Waiting for you, an entry in use reads In use", () => {
    const waiting = mount(MemoryEntry, { props: { entry: FACT }, global: { stubs } });
    expect(waiting.find("[data-testid='memory-status']").attributes("label")).toBe("enrichment.memory.waiting");
    const answer = mount(MemoryEntry, { props: { entry: OLD }, global: { stubs } });
    expect(answer.find("[data-testid='memory-status']").attributes("label")).toBe("enrichment.memory.status.active");
  });
});

describe("MemoryList", () => {
  const stubs = {
    PageHeader: true, BasicSelect: true, Pagination: { name: "Pagination", template: "<nav />" },
    ConfirmDialog: { name: "ConfirmDialog", props: ["open"], emits: ["confirm"], template: "<div />" },
    MemoryEntry: { name: "MemoryEntry", props: ["entry", "busy"], emits: ["promote", "status", "delete"], template: "<div />" },
  };
  const entries = (w) => w.findAllComponents({ name: "MemoryEntry" });

  const PAGE = [BRIEF, RULE, OLD];
  const answer = ({ kind }) => {
    const results = kind ? [RULE, FACT].filter((e) => e.kind === kind) : PAGE;
    return Promise.resolve({ data: { count: kind ? results.length : 30, results } });
  };

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    refresh.mockReset();
    api.GET_Memory.mockImplementation(answer);
  });

  it("pins every waiting suggestion above the paged list, whatever page it is on", async () => {
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    expect(api.GET_Memory).toHaveBeenCalledWith({ page: 1, page_size: 25, status: "active" });
    expect(api.GET_Memory).toHaveBeenCalledWith({ page: 1, page_size: 100, kind: "fact_suggestion", status: "active" });
    const pinned = w.find("[data-testid='memory-pinned']").findAllComponents({ name: "MemoryEntry" });
    expect(pinned.map((e) => e.props("entry").id)).toEqual([2, 3]);
    const paged = w.find("[data-testid='memory-entries']").findAllComponents({ name: "MemoryEntry" });
    expect(paged.map((e) => e.props("entry").id)).toEqual([1, 4]);
  });

  it("the expiry filter applies to this page; an empty page keeps the pagination", async () => {
    api.GET_Memory.mockImplementation(({ kind }) =>
      Promise.resolve({ data: { count: kind ? 0 : 30, results: kind ? [] : [OLD] } })
    );
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    w.vm.expiry = "current";
    await w.vm.$nextTick();
    expect(w.find("[data-testid='memory-empty']").exists()).toBe(true);
    expect(w.vm.emptyTitle).toBe(w.vm.$t("enrichment.memory.empty_page"));
    expect(w.findComponent({ name: "Pagination" }).exists()).toBe(true);
  });

  it("a filter that excludes waiting suggestions pins none", async () => {
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    api.GET_Memory.mockClear();
    w.vm.status = "dismissed";
    await flushPromises();
    expect(api.GET_Memory).toHaveBeenCalledTimes(1);
    expect(w.find("[data-testid='memory-pinned']").exists()).toBe(false);
  });

  it("Add to profile promotes to its target, refreshes the badge and the list", async () => {
    api.POST_PromoteMemory.mockResolvedValue({ data: {} });
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    api.GET_Memory.mockClear();
    entries(w)[0].vm.$emit("promote", RULE);
    await flushPromises();
    expect(api.POST_PromoteMemory).toHaveBeenCalledWith(2, { target: "rules" });
    expect(refresh).toHaveBeenCalled();
    expect(api.GET_Memory).toHaveBeenCalledTimes(3);
  });

  it("Dismiss patches the status; Delete asks first", async () => {
    api.PATCH_Memory.mockResolvedValue({ data: {} });
    api.DELETE_Memory.mockResolvedValue({});
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    entries(w)[0].vm.$emit("status", RULE, "dismissed");
    await flushPromises();
    expect(api.PATCH_Memory).toHaveBeenCalledWith(2, { status: "dismissed" });
    entries(w)[2].vm.$emit("delete", BRIEF);
    await w.vm.$nextTick();
    expect(api.DELETE_Memory).not.toHaveBeenCalled();
    w.findComponent({ name: "ConfirmDialog" }).vm.$emit("confirm");
    await flushPromises();
    expect(api.DELETE_Memory).toHaveBeenCalledWith(1);
  });

  it("a kind filter refetches from page 1", async () => {
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    w.vm.kind = "seo_brief";
    await flushPromises();
    expect(api.GET_Memory).toHaveBeenLastCalledWith({ page: 1, page_size: 25, kind: "seo_brief", status: "active" });
  });

  it("a filter with no hits says so and offers Clear filters, which goes back to the defaults", async () => {
    api.GET_Memory.mockResolvedValue({ data: { count: 0, results: [] } });
    const withEmpty = {
      ...stubs,
      EmptyState: { template: "<div><slot /></div>" },
      BasicButton: { emits: ["click"], template: "<button @click=\"$emit('click')\"><slot /></button>" },
    };
    const w = mount(MemoryList, { global: { stubs: withEmpty } });
    await flushPromises();
    expect(w.vm.emptyTitle).toBe(w.vm.$t("enrichment.memory.empty"));
    expect(w.find("[data-testid='memory-clear-filters']").exists()).toBe(false);
    w.vm.kind = "seo_brief";
    await flushPromises();
    expect(w.vm.emptyTitle).toBe(w.vm.$t("enrichment.memory.empty_filtered"));
    await w.find("[data-testid='memory-clear-filters']").trigger("click");
    await flushPromises();
    expect(w.vm.kind).toBe("");
    expect(api.GET_Memory).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: "active" }));
  });
});
