import { describe, it, expect } from "vitest";
import {
  buildFields,
  buildParams,
  buildTaskPayload,
  defaultResearch,
  defaultValues,
  keptParams,
  missingRequired,
  presetValues,
  researchKeys,
  withSource,
} from "@/views/Pim/components/enrichment/aiTaskForm";

// Fixtures shaped like pydantic `model_json_schema()` of the contract's kinds.
const TRANSLATE = {
  title: "Params",
  type: "object",
  properties: {
    channel: { title: "Channel", type: "string" },
    source_language: { title: "Source Language", type: "string" },
    target_languages: { title: "Target Languages", type: "array", items: { type: "string" } },
    prompt: { title: "Prompt", type: "string", default: "" },
  },
  required: ["channel", "source_language", "target_languages"],
};
const FIELD = {
  properties: {
    channel: { type: "string" },
    languages: { type: "array", items: { type: "string" } },
    prompt: { type: "string", default: "" },
  },
  required: ["channel", "languages"],
};
const WRITE = {
  properties: {
    channel: { type: "string" },
    fields: { type: "array", items: { type: "string" }, minItems: 1 },
    languages: { type: "array", items: { type: "string" }, minItems: 1 },
    prompt: { type: "string", default: "" },
    rules: { type: "array", items: { type: "string" } },
  },
  required: ["channel", "fields", "languages"],
};
const TRANSLATE_FIELDS = {
  properties: {
    ...TRANSLATE.properties,
    fields: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }], default: null },
  },
  required: TRANSLATE.required,
};
const OTHER = {
  $defs: { Tone: { enum: ["formal", "casual"], title: "Tone", type: "string" } },
  properties: {
    tone: { $ref: "#/$defs/Tone", default: "casual" },
    style: { anyOf: [{ type: "string" }, { type: "null" }], default: null, title: "Style" },
    format: { enum: ["text", "html"], type: "string" },
    max_length: { type: "integer" },
    strict: { type: "boolean" },
  },
};

describe("buildFields", () => {
  it("maps the translate schema: channel hidden, one source, one target list, the prompt", () => {
    const fields = buildFields(TRANSLATE);
    expect(fields.map((f) => [f.name, f.kind, f.required])).toEqual([
      ["source_language", "language", true],
      ["target_languages", "languages", true],
      ["prompt", "prompt", false],
    ]);
    expect(fields[0].title).toBe("Source Language");
  });

  it("resolves enums ($ref and inline), unwraps optional strings, skips other types", () => {
    const fields = buildFields(OTHER);
    expect(fields.map((f) => [f.name, f.kind])).toEqual([
      ["tone", "enum"],
      ["style", "text"],
      ["format", "enum"],
    ]);
    expect(fields[0].options).toEqual(["formal", "casual"]);
    expect(fields[0].default).toBe("casual");
  });

  it("returns nothing for a worker without a schema", () => {
    expect(buildFields(null)).toEqual([]);
    expect(buildFields({})).toEqual([]);
  });
});

describe("defaultValues", () => {
  const languages = ["pl", "en", "de"];

  it("source = the channel's main language, targets = the rest", () => {
    const values = defaultValues(buildFields(TRANSLATE), { languages, mainLanguage: "en" });
    expect(values).toEqual({ source_language: "en", target_languages: ["pl", "de"], prompt: "" });
  });

  it("without a main language the first channel language is the source", () => {
    const values = defaultValues(buildFields(TRANSLATE), { languages });
    expect(values.source_language).toBe("pl");
    expect(values.target_languages).toEqual(["en", "de"]);
  });

  it("a language list with no source field takes every language", () => {
    expect(defaultValues(buildFields(FIELD), { languages, mainLanguage: "en" }).languages).toEqual(languages);
  });

  it("an enum takes its default, else its first option", () => {
    const values = defaultValues(buildFields(OTHER));
    expect(values.tone).toBe("casual");
    expect(values.format).toBe("text");
    expect(values.style).toBe("");
  });
});

describe("withSource", () => {
  it("a new source language leaves the target list", () => {
    const fields = buildFields(TRANSLATE);
    const values = { source_language: "en", target_languages: ["pl", "de"], prompt: "" };
    expect(withSource(values, fields, "source_language", "de")).toEqual({
      source_language: "de",
      target_languages: ["pl"],
      prompt: "",
    });
  });
});

describe("missingRequired", () => {
  it("names required fields left empty (an empty list too)", () => {
    const fields = buildFields(TRANSLATE);
    expect(missingRequired(fields, { source_language: "en", target_languages: [], prompt: "" })).toEqual([
      "target_languages",
    ]);
    expect(missingRequired(fields, { source_language: "en", target_languages: ["pl"] })).toEqual([]);
  });
});

describe("buildTaskPayload", () => {
  it("one list-scoped task over the SKUs, channel in params when the schema has it", () => {
    const worker = { key: "pim.translate", params_schema: TRANSLATE };
    const params = { source_language: "en", target_languages: ["pl"], prompt: "Keep it short" };
    expect(buildTaskPayload({ worker, params, channel: "default-europe", skus: ["A", "B"] })).toEqual({
      type: "pim.translate",
      params: { source_language: "en", target_languages: ["pl"], prompt: "Keep it short", channel: "default-europe" },
      scope_spec: { mode: "list", module: "pim", channel: "default-europe", refs: ["A", "B"] },
    });
  });

  it("leaves channel out of params when the schema does not ask for it", () => {
    const worker = { key: "x", params_schema: OTHER };
    expect(buildTaskPayload({ worker, params: {}, channel: "c1", skus: ["A"] }).params).toEqual({});
  });

  it("names the template it runs from", () => {
    const worker = { key: "pim.writer", params_schema: WRITE };
    expect(buildTaskPayload({ worker, params: {}, channel: "c1", skus: ["A"], template: "meta" }).template).toBe("meta");
  });
});

describe("write / pick / translate fields", () => {
  it("`fields` is the field picker, `rules` stays on the template, a writer's languages take All", () => {
    const fields = buildFields(WRITE, "write");
    expect(fields.map((f) => [f.name, f.kind, f.allowAll])).toEqual([
      ["fields", "fields", false],
      ["languages", "languages", true],
      ["prompt", "prompt", false],
    ]);
    expect(defaultValues(fields, { languages: ["pl", "en"] })).toEqual({ fields: [], languages: ["*"], prompt: "" });
  });

  it("a translation's optional field list is a picker too, left out when empty", () => {
    const fields = buildFields(TRANSLATE_FIELDS, "translate");
    expect(fields.find((f) => f.name === "fields")).toMatchObject({ kind: "fields", required: false });
    const values = { source_language: "pl", target_languages: ["en"], prompt: "", fields: [] };
    expect(buildParams(fields, values)).toEqual({ source_language: "pl", target_languages: ["en"], prompt: "" });
  });

  it("a template presets the fields the form has and nothing else", () => {
    const fields = buildFields(WRITE, "write");
    const base = defaultValues(fields, { languages: ["pl"] });
    const preset = presetValues(fields, base, { fields: ["meta_title"], languages: ["pl"], channel: "x", augment: ["seo_brief"] });
    expect(preset).toEqual({ fields: ["meta_title"], languages: ["pl"], prompt: "" });
  });
});

describe("research", () => {
  it("a writer can research SEO; a template's preset is offered whatever the kind", () => {
    expect(researchKeys("write")).toEqual(["seo_brief"]);
    expect(researchKeys("translate")).toEqual([]);
    expect(researchKeys("pick", ["seo_brief"])).toEqual(["seo_brief"]);
  });

  it("defaults to the category scope; a template's preset wins", () => {
    expect(defaultResearch()).toEqual({ augment: [], seo_scope: "category" });
    expect(defaultResearch({ augment: ["seo_brief"], seo_scope: "subject" })).toEqual({
      augment: ["seo_brief"], seo_scope: "subject",
    });
  });

  it("params carry the research: the scope only with something on, nothing for kinds without research", () => {
    const fields = buildFields(WRITE, "write");
    const values = { fields: ["meta_title"], languages: ["*"], prompt: "" };
    expect(buildParams(fields, values, { augment: ["seo_brief"], seo_scope: "category" })).toEqual({
      ...values, augment: ["seo_brief"], seo_scope: "category",
    });
    expect(buildParams(fields, values, { augment: [], seo_scope: "category" })).toEqual({ ...values, augment: [] });
    expect(buildParams(fields, values, null)).toEqual(values);
  });
});

describe("image fields", () => {
  const IMAGE = {
    properties: {
      channel: { type: "string" },
      operation: { type: "string", enum: ["packshot", "lifestyle", "enhance", "instruct"] },
      preset: { type: "string", default: "" },
      prompt: { type: "string", default: "" },
      picture_ref: { type: "string", default: "" },
      n: { type: "integer", default: 1, minimum: 1, maximum: 4 },
    },
    required: ["channel", "operation"],
  };

  it("the variants are picked from 1–4; the preset and the picture never show", () => {
    const fields = buildFields(IMAGE);
    expect(fields.map((f) => f.name)).toEqual(["operation", "prompt", "n"]);
    expect(fields.find((f) => f.name === "n")).toMatchObject({ kind: "count", options: [1, 2, 3, 4], default: 1 });
    expect(defaultValues(fields)).toEqual({ operation: "packshot", prompt: "", n: 1 });
  });

  it("an unbounded or wide integer stays off the form", () => {
    const wide = { properties: { a: { type: "integer" }, b: { type: "integer", minimum: 1, maximum: 50 } } };
    expect(buildFields(wide)).toEqual([]);
  });

  it("a run of a custom instruction needs the instruction; a template may leave it to the run", () => {
    const fields = buildFields(IMAGE);
    const values = { operation: "instruct", prompt: "  ", n: 1 };
    expect(missingRequired(fields, values, { run: true })).toEqual(["prompt"]);
    expect(missingRequired(fields, values)).toEqual([]);
    expect(missingRequired(fields, { ...values, operation: "packshot" }, { run: true })).toEqual([]);
  });

  it("a template keeps its preset through an edit", () => {
    expect(keptParams({ operation: "packshot", preset: "packshot-white" })).toEqual({ preset: "packshot-white" });
    expect(keptParams(undefined)).toEqual({});
  });
});
