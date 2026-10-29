import { describe, it, expect } from "vitest";
import {
  editableText,
  groupBySubject,
  isHtml,
  changeSummary,
  isOptionValue,
  optionChanges,
  htmlDiff,
  isBlank,
  lengthTone,
  plainText,
  sourceText,
  subjectName,
  textRules,
  translationSource,
  wordDiff,
  workerOf,
} from "@/views/EnrichmentReview/reviewLogic";

const proposal = (over = {}) => ({
  id: 1,
  task_id: 9,
  subject_ref: "SKU-1",
  subject_label: "Chair",
  target_kind: "attribute_value",
  target_locator: { channel: "c1", language: "pl", feature_idx: "description" },
  proposed_value: { text: "Nowy opis" },
  source: "worker:pim.translate@v3",
  ...over,
});

describe("wordDiff", () => {
  it("marks changed words, keeps the rest", () => {
    expect(wordDiff("the quick fox", "the slow fox")).toEqual([
      { text: "the ", type: "same" },
      { text: "quick", type: "removed" },
      { text: "slow", type: "added" },
      { text: " fox", type: "same" },
    ]);
  });

  it("an empty current value is one added part", () => {
    expect(wordDiff(null, "new text")).toEqual([{ text: "new text", type: "added" }]);
  });

  it("stringifies a non-text value", () => {
    expect(wordDiff({ a: 1 }, { a: 1 })).toEqual([{ text: '{"a":1}', type: "same" }]);
  });
});

describe("isHtml", () => {
  it("tells markup from plain text", () => {
    expect(isHtml("<p>Hi</p>")).toBe(true);
    expect(isHtml("a < b and c > d")).toBe(false);
    expect(isHtml(null)).toBe(false);
  });
});

describe("groupBySubject", () => {
  it("groups by subject_ref in list order, a product titled by name and SKU as on a list row", () => {
    const rows = [
      proposal({ id: 1 }),
      proposal({ id: 2, subject_ref: "SKU-2", subject_label: "" }),
      proposal({ id: 3 }),
      proposal({ id: 4, subject_ref: "run:abc", subject_label: "Crew bunks" }),
    ];
    const groups = groupBySubject(rows);
    expect(groups.map((g) => [g.subjectRef, g.label, g.proposals.map((p) => p.id)])).toEqual([
      ["SKU-1", "Chair · SKU-1", [1, 3]],
      ["SKU-2", "SKU-2", [2]],
      ["run:abc", "Crew bunks", [4]],
    ]);
  });
});

describe("workerOf", () => {
  it("reads worker@version from the source", () => {
    expect(workerOf("worker:pim.translate@v3")).toBe("pim.translate@v3");
    expect(workerOf("csv-import")).toBe("");
    expect(workerOf(null)).toBe("");
  });
});

describe("translationSource", () => {
  const task = { params: { source_language: "en", target_languages: ["pl"] } };

  it("names the source language of a translation into another language", () => {
    expect(translationSource(task, proposal())).toBe("en");
  });

  it("is empty for a task that is no translation, or the same language", () => {
    expect(translationSource({ params: { languages: ["pl"] } }, proposal())).toBe("");
    expect(translationSource(null, proposal())).toBe("");
    const same = proposal({ target_locator: { language: "en", feature_idx: "description" } });
    expect(translationSource(task, same)).toBe("");
  });
});

describe("sourceText", () => {
  const product = {
    description_t9n: { en: "A chair", pl: "Krzesło" },
    attributes: [{ feature_idx: "material", value_txt_t9n: { en: "Oak" } }],
  };

  it("reads a system field and a text attribute in one language", () => {
    expect(sourceText(product, "description", "en")).toBe("A chair");
    expect(sourceText(product, "material", "en")).toBe("Oak");
    expect(sourceText(product, "material", "de")).toBe("");
    expect(sourceText(null, "description", "en")).toBe("");
  });
});

describe("editableText", () => {
  it("is the proposed text, or null when the value is no text", () => {
    expect(editableText(proposal())).toBe("Nowy opis");
    expect(editableText(proposal({ proposed_value: { url: "x" } }))).toBeNull();
  });
});

describe("isBlank / plainText", () => {
  it("an empty paragraph is blank; HTML is counted as its visible text", () => {
    expect([null, "", "  ", "<p></p>", "<p> </p>"].map(isBlank)).toEqual([true, true, true, true, true]);
    expect(isBlank("<p>x</p>")).toBe(false);
    expect(plainText("<p>Oak &amp; <b>steel</b></p>")).toBe("Oak & steel");
  });
});

describe("htmlDiff", () => {
  it("keeps the new markup and marks inserted and removed words", () => {
    const out = htmlDiff("<p>A plain chair</p>", "<p>A solid chair</p><ul><li>Oak</li></ul>");
    expect(out).toContain("<del>plain</del>");
    expect(out).toContain("<mark>solid</mark>");
    expect(out).toContain("<ul><li><mark>Oak</mark></li></ul>");
    expect(out.startsWith("<p>A ")).toBe(true);
  });

  it("drops the tags of removed markup", () => {
    expect(htmlDiff("<p>Keep</p><p>Gone</p>", "<p>Keep</p>")).toBe("<p>Keep</p><del>Gone</del>");
  });
});

describe("textRules / lengthTone", () => {
  it("meta description has the 120–155 target and a snippet; a short text its column limit", () => {
    expect(textRules("meta_description", null)).toEqual({ min: 120, max: 155, snippet: true });
    expect(textRules("subname", { feature_type: 4 })).toEqual({ max: 255 });
    expect(textRules("description", { feature_type: 6 })).toBeNull();
  });

  it("positive inside the target, warning close to it, negative far off", () => {
    const meta = { min: 120, max: 155 };
    expect([140, 105, 99, 165, 180].map((n) => lengthTone(n, meta))).toEqual([
      "positive", "warning", "negative", "warning", "negative",
    ]);
    expect([200, 240, 256].map((n) => lengthTone(n, { max: 255 }))).toEqual(["positive", "warning", "negative"]);
  });
});

describe("changeSummary", () => {
  const text = (proposed, current) => ({ target_kind: "attribute_value", proposed_value: { text: proposed }, current_snapshot: { text: current } });

  it("text: new or changed, a one-line plain excerpt and its length", () => {
    expect(changeSummary(text("<p>Fresh\n <b>copy</b></p>", "<p></p>"))).toEqual({ state: "new", excerpt: "Fresh copy", length: 10 });
    expect(changeSummary(text("Better", "Old")).state).toBe("changed");
    expect(changeSummary(text("x".repeat(300), "")).excerpt).toHaveLength(160);
  });

  it("media: an icon and the duration, nothing to fetch", () => {
    expect(changeSummary({ target_kind: "video", proposed_value: { duration_s: 4 } })).toEqual({ media: "video", duration: 4 });
    expect(changeSummary({ target_kind: "picture", proposed_value: {} })).toEqual({ media: "image", duration: null });
  });
});

describe("select values", () => {
  it("tells a select value from text", () => {
    expect(isOptionValue({ options: [] })).toBe(true);
    expect(isOptionValue({ option: "" })).toBe(true);
    expect(isOptionValue({ text: "x" })).toBe(false);
    expect(isOptionValue(null)).toBe(false);
  });

  it("splits the change into added, removed and kept", () => {
    expect(optionChanges({ options: ["a", "b"] }, { options: ["b", "c"] })).toEqual({ added: ["a"], removed: ["c"], kept: ["b"] });
    expect(optionChanges({ option: "a" }, { option: "b" })).toEqual({ added: ["a"], removed: ["b"], kept: [] });
    expect(optionChanges({ option: "" }, {})).toEqual({ added: [], removed: [], kept: [] });
  });

  it("a list row counts the tag changes", () => {
    const proposal = { target_kind: "attribute_value", proposed_value: { options: ["a"] }, current_snapshot: { options: ["b", "c"] } };
    expect(changeSummary(proposal)).toEqual({ tags: { added: 1, removed: 2 } });
  });
});

describe("subjectName", () => {
  it("names a proposal by its name and code, or by whichever it has", () => {
    expect(subjectName({ subject_label: "Orion lamp", subject_ref: "ENT-S001" })).toBe("Orion lamp · ENT-S001");
    expect(subjectName({ subject_label: "", subject_ref: "ENT-S001" })).toBe("ENT-S001");
    expect(subjectName({ subject_label: "ENT-S001", subject_ref: "ENT-S001" })).toBe("ENT-S001");
    expect(subjectName({ subject_label: "Orion lamp", subject_ref: "" })).toBe("Orion lamp");
  });
});
