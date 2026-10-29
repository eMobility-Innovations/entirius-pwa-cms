import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/api/enrichment/api", () => ({ PATCH_Proposal: vi.fn() }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));

import { artifactKind, readableFields } from "@/views/EnrichmentReview/studioStep";
import StudioStepPreview from "@/views/EnrichmentReview/StudioStepPreview.vue";

describe("artifactKind", () => {
  it.each([
    [{ questions: [], answers: {} }, "questions"],
    [{ title: "T", body_markdown: "# T" }, "document"],
    [{ text: "## Outline" }, "text"],
    [{ data: { primary: "sofa", candidates: [] } }, "keywords"],
    [{ data: { title: "T", description: "D" } }, "meta"],
    [{ data: { gaps: ["x"] } }, "data"],
  ])("%j → %s", (value, kind) => {
    expect(artifactKind(value)).toBe(kind);
  });
});

describe("readableFields", () => {
  it("names each field in words and shows lists as chips or lines, never JSON", () => {
    const fields = readableFields({
      data: { serp_notes: "Guides rank", gaps: ["care", "legs"], sources: [{ url: "/a", title: "A" }], empty: [], meta: { min: 1 } },
    });
    expect(fields).toEqual([
      { key: "serp_notes", label: "Serp notes", text: "Guides rank" },
      { key: "gaps", label: "Gaps", chips: ["care", "legs"] },
      { key: "sources", label: "Sources", items: ["/a · A"] },
      { key: "meta", label: "Meta", items: ["Min: 1"] },
    ]);
  });

  it("is empty for a value with nothing in it", () => {
    expect(readableFields({})).toEqual([]);
    expect(readableFields(null)).toEqual([]);
  });
});

describe("StudioStepPreview", () => {
  const proposal = (proposed_value) => ({ id: 1, status: "pending", proposed_value });
  const stubs = { KeywordsTable: { name: "KeywordsTable", props: ["proposal"], template: "<div />" }, Tag: { props: ["label"], template: "<i>{{ label }}</i>" } };

  it("a known step uses the Studio's renderer, read-only (never as a pending step it could change)", () => {
    const w = mount(StudioStepPreview, { props: { proposal: proposal({ data: { primary: "sofa" } }) }, global: { stubs } });
    expect(w.findComponent({ name: "KeywordsTable" }).props("proposal").status).not.toBe("pending");
  });

  it("an unknown shape reads as its fields", () => {
    const w = mount(StudioStepPreview, { props: { proposal: proposal({ data: { gaps: ["care"], intent: "info" } }) }, global: { stubs } });
    const text = w.get("[data-testid='studio-step-fields']").text();
    expect(text).toContain("Gaps");
    expect(text).toContain("care");
    expect(text).not.toMatch(/[{}]/);
  });
});
