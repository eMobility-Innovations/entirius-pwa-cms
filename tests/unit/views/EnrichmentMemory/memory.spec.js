import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { briefOf, byExpiry, memoryParams, promoteTarget, suggestionsFirst } from "@/views/EnrichmentMemory/memoryLogic";

const api = vi.hoisted(() => ({ GET_Memory: vi.fn(), PATCH_Memory: vi.fn(), DELETE_Memory: vi.fn(), POST_PromoteMemory: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ refresh }) }));

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
  it("puts waiting suggestions first, keeping the API order within each group", () => {
    expect(suggestionsFirst([BRIEF, RULE, OLD, FACT]).map((e) => e.id)).toEqual([2, 3, 1, 4]);
    expect(suggestionsFirst([BRIEF, { ...RULE, status: "dismissed" }]).map((e) => e.id)).toEqual([1, 2]);
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

  it("a waiting suggestion offers Add to profile and Dismiss; a promoted one only Delete", () => {
    const w = mount(MemoryEntry, { props: { entry: RULE }, global: { stubs } });
    expect(w.find("[data-testid='memory-promote']").exists()).toBe(true);
    expect(w.find("[data-testid='memory-dismiss']").exists()).toBe(true);
    const done = mount(MemoryEntry, { props: { entry: { ...RULE, status: "promoted" } }, global: { stubs } });
    expect(done.find("[data-testid='memory-promote']").exists()).toBe(false);
    expect(done.find("[data-testid='memory-dismiss']").exists()).toBe(false);
  });
});

describe("MemoryList", () => {
  const stubs = {
    PageHeader: true, BasicSelect: true, Pagination: true,
    ConfirmDialog: { name: "ConfirmDialog", props: ["open"], emits: ["confirm"], template: "<div />" },
    MemoryEntry: { name: "MemoryEntry", props: ["entry", "busy"], emits: ["promote", "status", "delete"], template: "<div />" },
  };
  const entries = (w) => w.findAllComponents({ name: "MemoryEntry" });

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    refresh.mockReset();
    api.GET_Memory.mockResolvedValue({ data: { count: 2, results: [BRIEF, RULE] } });
  });

  it("lists active entries, suggestions first", async () => {
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    expect(api.GET_Memory).toHaveBeenCalledWith({ page: 1, page_size: 25, status: "active" });
    expect(entries(w).map((e) => e.props("entry").id)).toEqual([2, 1]);
  });

  it("Add to profile promotes to its target, refreshes the badge and the list", async () => {
    api.POST_PromoteMemory.mockResolvedValue({ data: {} });
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    entries(w)[0].vm.$emit("promote", RULE);
    await flushPromises();
    expect(api.POST_PromoteMemory).toHaveBeenCalledWith(2, { target: "rules" });
    expect(refresh).toHaveBeenCalled();
    expect(api.GET_Memory).toHaveBeenCalledTimes(2);
  });

  it("Dismiss patches the status; Delete asks first", async () => {
    api.PATCH_Memory.mockResolvedValue({ data: {} });
    api.DELETE_Memory.mockResolvedValue({});
    const w = mount(MemoryList, { global: { stubs } });
    await flushPromises();
    entries(w)[0].vm.$emit("status", RULE, "dismissed");
    await flushPromises();
    expect(api.PATCH_Memory).toHaveBeenCalledWith(2, { status: "dismissed" });
    entries(w)[1].vm.$emit("delete", BRIEF);
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
});
