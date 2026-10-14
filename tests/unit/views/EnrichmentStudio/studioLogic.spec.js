import { describe, it, expect } from "vitest";
import {
  briefErrors,
  briefFields,
  cleanBrief,
  currentStepLabel,
  defaultStep,
  draftRoute,
  initialBrief,
  isRunWorking,
  keywordRole,
  keywordRows,
  missingAnswers,
  outputKind,
  pickKeyword,
  railItems,
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
  it("maps every step state to its icon and tone and marks the current step", () => {
    expect(railItems(RUN)).toEqual([
      { key: "questions", label: "QUESTIONS", status: "approved", icon: "success", tone: "positive", current: false },
      { key: "draft", label: "DRAFT", status: "review", icon: "preview", tone: "warning", current: true },
      { key: "meta", label: "META", status: "waiting", icon: "scheduled", tone: "neutral", current: false },
    ]);
    expect(railItems({ steps: [step("a", "running"), step("b", "failed")] }).map((i) => [i.icon, i.tone])).toEqual([
      ["running", "info"],
      ["warning", "negative"],
    ]);
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
    expect(currentStepLabel(RUN)).toBe("DRAFT");
    expect(currentStepLabel({ ...RUN, current_step: null })).toBe("");
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

  it("sends trimmed values and leaves empty ones out", () => {
    expect(cleanBrief({ topic: " Sofas ", notes: "  ", language: "en" })).toEqual({ topic: "Sofas", language: "en" });
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
  });

  it("lists the required questions without an answer", () => {
    const questions = [
      { id: "since", optional: false },
      { id: "where", optional: true },
      { id: "who", optional: false },
    ];
    expect(missingAnswers(questions, { since: " ", who: "Ana" })).toEqual(["since"]);
    expect(missingAnswers(questions, { since: "2019", who: "Ana" })).toEqual([]);
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

  it("a supporting pick toggles, at most two, never the main phrase", () => {
    const added = pickKeyword(DATA, "clean sofa", "secondary");
    expect(added.secondary).toEqual(["linen sofa", "clean sofa"]);
    expect(pickKeyword(added, "third", "secondary")).toBe(added);
    expect(pickKeyword(added, "linen sofa", "secondary").secondary).toEqual(["clean sofa"]);
    expect(pickKeyword(DATA, "sofa care", "secondary")).toBe(DATA);
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
