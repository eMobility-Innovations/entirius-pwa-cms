import { describe, it, expect } from "vitest";
import schema from "../../../fixtures/profile-schema.json";
import {
  completeness,
  emptyRow,
  errorsByPath,
  errorsInside,
  mapToText,
  nextId,
  pruneEmpty,
  sectionsFrom,
  shownInline,
  textToMap,
} from "@/views/EnrichmentProfile/profileLogic";
import { checkProfileJson } from "@/views/EnrichmentProfile/jsonCheck";

const byKey = (key) => sectionsFrom(schema).find((s) => s.key === key);

describe("profile form from the schema", () => {
  it("reads every section in schema order with the control its shape needs", () => {
    const kinds = Object.fromEntries(sectionsFrom(schema).map((s) => [s.key, s.kind]));
    expect(kinds).toEqual({
      brand: "group", persona: "group", facts: "table", tone: "group", language: "group", headlines: "group",
      proof: "group", seo: "group", checklists: "group", always_rules: "chips", rules: "table", routing: "json",
    });
  });

  it("a group lists markdown text, chips and tables; a table lists its columns", () => {
    expect(byKey("brand").fields.map((f) => [f.key, f.kind])).toEqual([
      ["text", "markdown"], ["differentiators", "chips"], ["never_say", "chips"],
    ]);
    const glossary = byKey("language").fields.find((f) => f.key === "glossary");
    expect(glossary.columns).toEqual([
      { key: "term", kind: "line", required: true },
      { key: "translations", kind: "map", required: false },
    ]);
    expect(byKey("rules").columns.map((c) => c.key)).toEqual(["id", "pattern", "flags", "message", "do", "dont", "active"]);
    expect(byKey("rules").columns.at(-1).kind).toBe("switch");
  });
});

describe("rows", () => {
  it("generates the next id the operator never types, and new rules start checked", () => {
    expect(nextId([{ id: "fact-2" }, { id: "fact-7" }], "facts")).toBe("fact-8");
    expect(nextId([], "rules")).toBe("rule-1");
    expect(emptyRow(byKey("rules").columns, [{ id: "rule-1" }], "rules")).toEqual({
      id: "rule-2", pattern: "", flags: "", message: "", do: "", dont: "", active: true,
    });
  });

  it("translations read and write as 'lang: text; lang: text'", () => {
    expect(mapToText({ pl: "sofa", de: "Sofa" })).toBe("pl: sofa; de: Sofa");
    expect(textToMap("pl: sofa; de: Sofa: XL; junk")).toEqual({ pl: "sofa", de: "Sofa: XL" });
  });
});

describe("saving", () => {
  it("drops empty values (empty = missing) but keeps false", () => {
    const data = { brand: { text: "", differentiators: [] }, rules: [{ id: "r", pattern: "x", message: "m", do: "", active: false }], tone: { text: "Calm" } };
    expect(pruneEmpty(data)).toEqual({ rules: [{ id: "r", pattern: "x", message: "m", active: false }], tone: { text: "Calm" } });
  });

  it("maps the API's 400 details to paths inside the profile", () => {
    // The client rejects with the bare v2 body (createClient rejectWithBody).
    const err = { error: "VALIDATION_ERROR", httpStatus: 400, details: [{ field: "data.brand.differentiators.0", description: "5 is not of type 'string'" }] };
    const errors = errorsByPath(err);
    expect(errors).toEqual({ "brand.differentiators.0": "5 is not of type 'string'" });
    expect(errorsInside(errors, "brand")).toEqual({ "differentiators.0": "5 is not of type 'string'" });
    expect(errorsByPath(new Error("network"))).toEqual({});
  });

  it("knows which errors a control shows and which go to the section's list", () => {
    expect(shownInline(byKey("facts"), "2.value")).toBe(true);
    expect(shownInline(byKey("language"), "spellings.0.wrong")).toBe(true);
    expect(shownInline(byKey("brand"), "text")).toBe(true);
    expect(shownInline(byKey("brand"), "differentiators.0")).toBe(false);
    expect(shownInline(byKey("always_rules"), "0")).toBe(false);
  });

  it("sums the completeness of the status", () => {
    const status = { sections: [{ key: "brand", complete: true }, { key: "facts", complete: false }] };
    expect(completeness(status)).toMatchObject({ done: 1, total: 2 });
    expect(completeness(status).byKey.facts.complete).toBe(false);
    expect(completeness(null)).toMatchObject({ done: 0, total: 0 });
  });
});

describe("Edit JSON check", () => {
  it("accepts a valid profile", () => {
    const text = JSON.stringify({ brand: { differentiators: ["Made to order"] }, routing: { "pim.writer": ["brand"] } });
    expect(checkProfileJson(schema, text).errors).toEqual({});
  });

  it("puts each problem at its path", () => {
    const text = JSON.stringify({
      brand: { differentiators: [5] },
      facts: [{ id: "f", label: "Founded" }],
      rules: [{ id: "r", pattern: "x", message: "m", flags: "q" }],
      routing: { write: ["weather"] },
      mood: "happy",
    });
    expect(checkProfileJson(schema, text).errors).toEqual({
      "brand.differentiators.0": { code: "type", arg: "string" },
      "facts.0.value": { code: "required" },
      "rules.0.flags": { code: "format" },
      "routing.write.0": { code: "enum", arg: expect.stringContaining("brand") },
      mood: { code: "unknown" },
    });
  });

  it("reports text that is not JSON at the top", () => {
    const { data, errors } = checkProfileJson(schema, "{ nope");
    expect(data).toBeNull();
    expect(errors.$.code).toBe("parse");
  });
});
