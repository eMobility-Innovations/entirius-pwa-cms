import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetProposals = vi.fn();
vi.mock("@/api/enrichment/api", () => ({ GET_Proposals: (...a) => mockGetProposals(...a) }));

import {
  loadProductNames, noteProductNames, resetProductNames, runName, runScope, runTitle,
} from "@/views/EnrichmentReview/runLabel";

const WORKERS = [{ key: "pim.writer", label: "Product writer" }];
const TEMPLATES = [{ key: "desc", label: "Opis produktu" }];
const run = (refs, over = {}) => ({ id: 7, type: "pim.writer", params: { template: "desc" }, scope_spec: { mode: "list", refs }, ...over });

describe("runLabel", () => {
  beforeEach(() => {
    resetProductNames();
    mockGetProposals.mockReset();
  });

  it("names what ran: its template, else its worker, else a plain AI task — never a key", () => {
    expect(runName(run([]), WORKERS, TEMPLATES)).toBe("Opis produktu");
    expect(runName(run([], { params: {} }), WORKERS, TEMPLATES)).toBe("Product writer");
    expect(runName({ type: "x.unknown", params: {} })).toBe("AI task");
  });

  it("names what it covered: one product by name (else its SKU), several by their count", () => {
    expect(runScope(run(["ENT-1"]))).toBe("ENT-1");
    noteProductNames([{ subject_ref: "ENT-1", subject_label: "Orion Sofa" }, { subject_ref: "ENT-2", subject_label: "ENT-2" }]);
    expect(runScope(run(["ENT-1"]))).toBe("Orion Sofa");
    expect(runScope(run(["ENT-2"]))).toBe("ENT-2");
    expect(runScope(run(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]))).toBe("12 products");
  });

  it("an article's topic, a rule's run, a Studio step's ref never shown", () => {
    expect(runScope({ params: { brief: { topic: "Crew bunks" } }, scope_spec: { refs: ["run:abc"] } })).toBe("Crew bunks");
    expect(runScope({ params: { spawn_rule: "fill-desc" }, scope_spec: { mode: "gap" } })).toBe("Started by a rule");
    expect(runScope({ params: {}, scope_spec: { refs: ["run:abc"] } })).toBe("");
  });

  it("reads as one line: what ran · what it covered", () => {
    noteProductNames([{ subject_ref: "ENT-1", subject_label: "Orion Sofa" }]);
    expect(runTitle(run(["ENT-1"]), WORKERS, TEMPLATES)).toBe("Opis produktu · Orion Sofa");
    expect(runTitle({ type: "x", params: {}, scope_spec: { mode: "gap" } })).toBe("AI task");
  });

  it("asks one proposal of each one-product run whose product is not named yet, once", async () => {
    mockGetProposals.mockResolvedValue({ data: { results: [{ subject_ref: "ENT-3", subject_label: "Nova Lamp" }] } });
    noteProductNames([{ subject_ref: "ENT-1", subject_label: "Orion Sofa" }]);
    const tasks = [run(["ENT-1"]), run(["ENT-3"], { id: 8 }), run(["ENT-3"], { id: 9 }), run(["A", "B"], { id: 10 })];
    await loadProductNames(tasks);
    await loadProductNames(tasks);

    expect(mockGetProposals.mock.calls).toEqual([[{ task: 8, status: "all", page_size: 1 }]]);
    expect(runScope(run(["ENT-3"]))).toBe("Nova Lamp");
  });

  it("a failed ask is asked again next time", async () => {
    mockGetProposals.mockRejectedValueOnce(new Error("Network Error")).mockResolvedValue({ data: { results: [] } });
    await loadProductNames([run(["ENT-4"])]);
    await loadProductNames([run(["ENT-4"])]);
    expect(mockGetProposals).toHaveBeenCalledTimes(2);
    expect(runScope(run(["ENT-4"]))).toBe("ENT-4");
  });
});
