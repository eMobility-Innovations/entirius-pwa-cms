import { describe, it, expect } from "vitest";
import {
  answeredCount,
  answersShort,
  briefErrors,
  briefFields,
  briefHasValue,
  cleanBrief,
  isFieldVisible,
  defaultStep,
  draftRoute,
  elapsedLabel,
  failureCode,
  initialBrief,
  isRunStale,
  isRunWorking,
  keywordRole,
  keywordRows,
  missingAnswers,
  nextAction,
  nextStep,
  openFirst,
  outputKind,
  pickKeyword,
  railItems,
  readingStats,
  runTitle,
  wordCount,
} from "@/views/EnrichmentStudio/studioLogic";

const step = (key, status, extra = {}) => ({ key, label: key.toUpperCase(), status, ...extra });
const RUN = {
  uid: "u1",
  definition_label: "Article",
  current_step: "draft",
  inputs: { topic: "Sofas in orbit", language: "en" },
  steps: [step("questions", "approved"), step("draft", "review"), step("meta", "waiting")],
};

describe("steps rail", () => {
  it("numbers every step, gives it its tone and says its state in words", () => {
    expect(railItems(RUN)).toEqual([
      { key: "questions", label: "QUESTIONS", status: "approved", look: "approved", number: 1, tone: "positive", current: false, line: { key: "approved", params: {} } },
      { key: "draft", label: "DRAFT", status: "review", look: "review", number: 2, tone: "warning", current: true, line: { key: "review", params: {} } },
      { key: "meta", label: "META", status: "waiting", look: "waiting", number: 3, tone: "neutral", current: false, line: { key: "queued", params: {} } },
    ]);
    expect(railItems({ steps: [step("a", "running"), step("b", "failed")] }).map((i) => i.tone)).toEqual(["info", "negative"]);
  });

  it("a waiting step starts after the last step it still needs; a cancelled run stops the open ones", () => {
    const run = {
      steps: [step("a", "approved"), step("b", "review"), step("c", "waiting", { needs: ["a", "b"] })],
    };
    expect(railItems(run)[2].line).toEqual({ key: "waiting", params: { step: "B" } });
    const cancelled = railItems({ ...run, status: "cancelled" });
    expect(cancelled.map((i) => i.line.key)).toEqual(["approved", "stopped", "stopped"]);
    expect(cancelled.map((i) => [i.look, i.tone])[1]).toEqual(["stopped", "neutral"]);
  });

  it("says what the operator should do now and on which step", () => {
    expect(nextAction(RUN)).toEqual({ kind: "your_turn", step: RUN.steps[1] });
    const failed = { steps: [step("a", "failed"), step("b", "running")] };
    expect(nextAction(failed).kind).toBe("failed");
    expect(nextAction({ steps: [step("a", "approved"), step("b", "running")] }).step.key).toBe("b");
    expect(nextAction({ steps: [step("a", "waiting")] })).toEqual({ kind: "waiting", step: null });
    expect(nextAction({ ...RUN, status: "done" })).toEqual({ kind: "done", step: null });
    expect(nextAction({ ...RUN, status: "cancelled" })).toEqual({ kind: "cancelled", step: null });
    expect(nextStep(RUN, "draft").key).toBe("meta");
    expect(nextStep(RUN, "meta")).toBeNull();
  });

  it("lists open runs first and keeps the date order inside each group", () => {
    const runs = ["done", "running", "waiting", "cancelled", "failed", "waiting"].map((status, i) => ({ uid: String(i), status }));
    expect(openFirst(runs).map((run) => run.uid)).toEqual(["2", "5", "4", "1", "0", "3"]);
  });

  it("opens the step that needs the operator, else the working one, else a failed one", () => {
    expect(defaultStep(RUN)).toBe("draft");
    expect(defaultStep({ steps: [step("a", "approved"), step("b", "running")] })).toBe("b");
    expect(defaultStep({ steps: [step("a", "failed"), step("b", "waiting")] })).toBe("a");
    expect(defaultStep({ current_step: null, steps: [step("a", "approved"), step("b", "approved")] })).toBe("b");
  });

  it("knows when a run is still working and names its current step", () => {
    expect(isRunWorking(RUN)).toBe(false);
    expect(isRunWorking({ steps: [step("a", "running")] })).toBe(true);
    expect(isRunWorking({ status: "cancelled", steps: [step("a", "running")] })).toBe(false);
    expect(isRunWorking({ status: "done", steps: [step("a", "running")] })).toBe(false);
  });

  it("names a run by its working title, else its topic, else the workflow", () => {
    expect(runTitle({ ...RUN, inputs: { title: "Care guide", topic: "x" } })).toBe("Care guide");
    expect(runTitle(RUN)).toBe("Sofas in orbit");
    expect(runTitle({ ...RUN, inputs: {} })).toBe("Article");
  });
});

describe("brief form", () => {
  const SCHEMA = {
    type: "object",
    required: ["topic", "language"],
    properties: {
      notes: { type: "string", title: "Notes", maxLength: 4000 },
      topic: { type: "string", title: "Topic", minLength: 3, maxLength: 200 },
      language: { type: "string", title: "Language", pattern: "^[a-z]{2}$", default: "en" },
    },
  };

  it("builds one field per property, required ones first, long ones multi-line", () => {
    const fields = briefFields(SCHEMA);
    expect(fields.map((f) => [f.key, f.label, f.required, f.multiline])).toEqual([
      ["topic", "Topic", true, false],
      ["language", "Language", true, false],
      ["notes", "Notes", false, true],
    ]);
    expect(initialBrief(fields)).toEqual({ topic: "", language: "en", notes: "" });
  });

  it("reports the first problem of each field", () => {
    const fields = briefFields(SCHEMA);
    expect(briefErrors(fields, { topic: "", language: "EN", notes: "" })).toEqual({ topic: "required", language: "format" });
    expect(briefErrors(fields, { topic: "ab", language: "en" })).toEqual({ topic: "too_short" });
    expect(briefErrors(fields, { topic: "Sofas", language: "en", notes: "" })).toEqual({});
  });

  it("a run quiet for longer than the limit is stale and stops refreshing", () => {
    const now = Date.parse("2026-10-15T12:00:00Z");
    const run = (modified_at) => ({ status: "running", modified_at, steps: [step("a", "running")] });
    expect(isRunStale(run("2026-10-15T11:58:00Z"), now)).toBe(false);
    expect(isRunStale(run("2026-10-15T11:56:00Z"), now)).toBe(true);
    expect(isRunWorking(run("2026-10-15T11:58:00Z"), now)).toBe(true);
    expect(isRunWorking(run("2026-10-15T11:56:00Z"), now)).toBe(false);
  });

  it("leaves a pattern JavaScript cannot compile to the server", () => {
    const fields = briefFields({ properties: { code: { type: "string", pattern: "^[a-z]+\\Z" } } });
    expect(briefErrors(fields, { code: "abc" })).toEqual({});
  });

  it("sends trimmed values and leaves empty ones out", () => {
    expect(cleanBrief({ topic: " Sofas ", notes: "  ", language: "en" })).toEqual({ topic: "Sofas", language: "en" });
  });

  const COVER = {
    type: "object",
    required: ["topic"],
    properties: {
      topic: { type: "string", title: "Topic" },
      cover_product: { type: "object", title: "Product on the cover", "x-picker": "pim-product" },
      cover_text_wanted: { type: "boolean", title: "Text on the cover", default: false },
      cover_text: { type: "string", title: "Cover text", maxLength: 80, "x-visible-if": "cover_text_wanted" },
    },
  };

  it("reads a checkbox, a picker and a field that shows only when another one is on", () => {
    const fields = briefFields(COVER);
    expect(fields.map((f) => [f.key, f.type, f.picker, f.visibleIf])).toEqual([
      ["topic", "string", "", ""],
      ["cover_product", "object", "pim-product", ""],
      ["cover_text_wanted", "boolean", "", ""],
      ["cover_text", "string", "", "cover_text_wanted"],
    ]);
    expect(initialBrief(fields)).toEqual({ topic: "", cover_product: null, cover_text_wanted: false, cover_text: "" });
    const text = fields.find((f) => f.key === "cover_text");
    expect(isFieldVisible(text, { cover_text_wanted: false })).toBe(false);
    expect(isFieldVisible(text, { cover_text_wanted: true })).toBe(true);
  });

  it("a shown dependent field must be filled, a hidden one is neither checked nor sent", () => {
    const fields = briefFields(COVER);
    expect(briefErrors(fields, { topic: "Sofas", cover_text_wanted: true, cover_text: " " })).toEqual({ cover_text: "required" });
    expect(briefErrors(fields, { topic: "Sofas", cover_text_wanted: false, cover_text: "" })).toEqual({});
    expect(cleanBrief({ topic: "Sofas", cover_text_wanted: false, cover_text: "Old" }, fields)).toEqual({ topic: "Sofas" });
    expect(cleanBrief({ topic: "Sofas", cover_text_wanted: true, cover_text: " Hi " }, fields)).toEqual({
      topic: "Sofas",
      cover_text_wanted: true,
      cover_text: "Hi",
    });
  });

  it("keeps a picked product, drops an empty pick and an unchecked box", () => {
    const product = { channel: "eu", ref: "SKU-1", label: "Soother" };
    expect(cleanBrief({ topic: "Sofas", cover_product: product, cover_text_wanted: false })).toEqual({ topic: "Sofas", cover_product: product });
    expect(cleanBrief({ topic: "Sofas", cover_product: { channel: "eu", ref: "" } })).toEqual({ topic: "Sofas" });
    expect(briefHasValue(false)).toBe(false);
    expect(briefHasValue(null)).toBe(false);
    expect(briefHasValue(product)).toBe(true);
  });
});

describe("step outputs", () => {
  it("picks the renderer from the step and the value", () => {
    expect(outputKind({ output: "questions" }, { questions: [] })).toBe("questions");
    expect(outputKind({ output: "document" }, { title: "x" })).toBe("document");
    expect(outputKind({ output: "artifact" }, { text: "# Outline" })).toBe("text");
    expect(outputKind({ output: "artifact" }, { data: { primary: "sofa care", candidates: [] } })).toBe("keywords");
    expect(outputKind({ output: "artifact" }, { data: { title: "T", description: "D" } })).toBe("meta");
    expect(outputKind({ output: "artifact" }, { data: { other: 1 } })).toBe("data");
    expect(outputKind({ output: "artifact" }, { data: { scenes: [], alt: "" } })).toBe("scenes");
    expect(outputKind({ output: "image" }, { variants: [], chosen: null })).toBe("cover");
  });

  it("lists the required questions without an answer", () => {
    const questions = [
      { id: "since", optional: false },
      { id: "where", optional: true },
      { id: "who", optional: false },
    ];
    expect(missingAnswers(questions, { since: " ", who: "Ana" })).toEqual(["since"]);
    expect(missingAnswers(questions, { since: "2019", who: "Ana" })).toEqual([]);
    expect(missingAnswers(questions, {}, 1)).toEqual([]);
  });

  it("counts the answers still needed to reach the minimum (capped at the number of questions)", () => {
    const questions = [
      { id: "since", optional: true },
      { id: "where", optional: true },
    ];
    expect(answersShort(questions, {}, 1)).toBe(1);
    expect(answersShort(questions, { since: " " }, 1)).toBe(1);
    expect(answersShort(questions, { since: "2019" }, 1)).toBe(0);
    expect(answersShort(questions, {}, 5)).toBe(2);
    expect(answersShort(questions, {}, 0)).toBe(0);
    expect(answersShort(questions, {}, undefined)).toBe(0);
  });

  it("links the created draft only once the run has one", () => {
    expect(draftRoute(RUN)).toBeNull();
    expect(draftRoute({ subject_ref: "c-1" })).toEqual({
      name: "Builder",
      params: { content_type: "content", type: "blog-post", uid: "c-1" },
    });
  });

  it("counts the words of a document body", () => {
    expect(wordCount("# Title\n\nTwo words, and 3 more.")).toBe(6);
    expect(wordCount("")).toBe(0);
  });
});

describe("search-phrase pick", () => {
  const DATA = { primary: "sofa care", secondary: ["linen sofa"], intent: "informational", candidates: [] };

  it("a main pick replaces the main phrase and drops it from the supporting ones", () => {
    expect(pickKeyword(DATA, "linen sofa", "primary")).toEqual({ ...DATA, primary: "linen sofa", secondary: [] });
  });

  it("a supporting pick adds, at most two; skip drops it; the main phrase stays until another is picked", () => {
    const added = pickKeyword(DATA, "clean sofa", "secondary");
    expect(added.secondary).toEqual(["linen sofa", "clean sofa"]);
    expect(pickKeyword(added, "third", "secondary")).toBe(added);
    expect(pickKeyword(added, "linen sofa", "secondary")).toBe(added);
    expect(pickKeyword(added, "linen sofa", "skip").secondary).toEqual(["clean sofa"]);
    expect(pickKeyword(DATA, "other", "skip")).toBe(DATA);
    expect(pickKeyword(DATA, "sofa care", "secondary")).toBe(DATA);
    expect(pickKeyword(DATA, "sofa care", "skip")).toBe(DATA);
    expect(pickKeyword(DATA, "sofa care", "primary")).toBe(DATA);
  });

  it("tells each phrase's role and lists the named phrases without candidates", () => {
    expect([keywordRole(DATA, "sofa care"), keywordRole(DATA, "linen sofa"), keywordRole(DATA, "x")]).toEqual([
      "primary",
      "secondary",
      "",
    ]);
    expect(keywordRows(DATA).map((row) => row.phrase)).toEqual(["sofa care", "linen sofa"]);
    const candidates = [{ phrase: "a", volume: 10, intent: "commercial", serp_notes: "" }];
    expect(keywordRows({ ...DATA, candidates })).toBe(candidates);
  });
});

describe("step details", () => {
  it("counts answers, reading time, elapsed time and the failure code", () => {
    const questions = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(answeredCount(questions, { a: "yes", b: "  ", c: null })).toBe(1);
    expect(readingStats("one two three")).toEqual({ words: 3, minutes: 1 });
    expect(readingStats("word ".repeat(1000)).minutes).toBe(5);
    expect([0, 61_000, -5].map(elapsedLabel)).toEqual(["0:00", "1:01", "0:00"]);
    expect(failureCode({ errors: [{ code: "TIMEOUT" }] })).toBe("TIMEOUT");
    expect(failureCode({ errors: [] })).toBe("");
  });
});
