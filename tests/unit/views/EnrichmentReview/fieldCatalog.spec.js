import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFields = vi.fn();
const mockLanguages = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Fields: (...a) => mockFields(...a),
  GET_Languages: (...a) => mockLanguages(...a),
}));

import { fieldOptions, loadCatalog, optionLabel, resetCatalog } from "@/views/EnrichmentReview/fieldCatalog";

const FIELDS = [
  { key: "meta_title", label: "Meta title", type: "text" },
  { key: "description", label: "Description", type: "html" },
  { key: "badge", label: "Badge", type: "multiselect", options: [{ value: "new", label: "New" }] },
  { key: "series", label: "Series", type: "select", options: [] },
];

describe("fieldCatalog", () => {
  beforeEach(() => {
    resetCatalog();
    mockFields.mockReset().mockResolvedValue({ data: FIELDS });
    mockLanguages.mockReset().mockResolvedValue({ data: ["pl", "en"] });
  });

  it("loads a channel's fields (in the UI language) and languages once", async () => {
    const first = await loadCatalog("eu");
    await loadCatalog("eu");
    expect(first).toEqual({ fields: FIELDS, languages: ["pl", "en"] });
    expect(mockFields).toHaveBeenCalledTimes(1);
    expect(mockFields).toHaveBeenCalledWith(expect.objectContaining({ target_module: "pim", channel: "eu", language: expect.any(String) }));
  });

  it("a module without a catalog gives empty lists and is asked again next time", async () => {
    mockFields.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await loadCatalog("eu")).toEqual({ fields: [], languages: [] });
    expect((await loadCatalog("eu")).fields).toEqual(FIELDS);
  });

  it("no channel, no call", async () => {
    expect(await loadCatalog("")).toEqual({ fields: [], languages: [] });
    expect(mockFields).not.toHaveBeenCalled();
  });

  it("a writer and a translation pick text fields, a tagger select fields", () => {
    expect(fieldOptions(FIELDS, "write").map((o) => o.value)).toEqual(["meta_title", "description"]);
    expect(fieldOptions(FIELDS, "translate").map((o) => o.value)).toEqual(["meta_title", "description"]);
    expect(fieldOptions(FIELDS, "pick")).toEqual([{ label: "Badge", value: "badge" }, { label: "Series", value: "series" }]);
    expect(fieldOptions(FIELDS, "video")).toEqual([]);
  });

  it("names an option, the value when unknown", () => {
    expect(optionLabel(FIELDS, "badge", "new")).toBe("New");
    expect(optionLabel(FIELDS, "badge", "old")).toBe("old");
    expect(optionLabel([], "badge", "new")).toBe("new");
  });
});
