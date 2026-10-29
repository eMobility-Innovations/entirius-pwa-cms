import { describe, it, expect } from "vitest";
import {
  MAX_RULES,
  addRule,
  quickActionsFor,
  revisable,
  reviseBody,
  reviseErrorKey,
  sentenceWith,
  splitInstruction,
  textareaSelection,
  valueShape,
  valueText,
  versionInfo,
  withText,
} from "@/views/EnrichmentReview/correction";

describe("correction helpers", () => {
  it("knows the value shapes a correction can take", () => {
    expect(valueShape({ text: "Sofa" })).toBe("text");
    expect(valueShape({ option: "red" })).toBe("select");
    expect(valueShape({ options: ["a"] })).toBe("select");
    expect(valueShape({ url: "/m.jpg" })).toBeNull();
    expect(valueShape(null)).toBeNull();
  });

  it("only a pending or drifted text/select proposal is revisable", () => {
    expect(revisable({ status: "pending", proposed_value: { text: "x" } })).toBe(true);
    expect(revisable({ status: "drifted", proposed_value: { option: "x" } })).toBe(true);
    expect(revisable({ status: "applied", proposed_value: { text: "x" } })).toBe(false);
    expect(revisable({ status: "pending", proposed_value: { duration_s: 4 } })).toBe(false);
  });

  it("offers the quick actions to text only, and no variants in a batch", () => {
    expect(quickActionsFor("text")).toContain("variants");
    expect(quickActionsFor("text", { batch: true })).not.toContain("variants");
    expect(quickActionsFor("select")).toEqual([]);
  });

  it("sends only what was given; a selection narrows the scope", () => {
    expect(reviseBody({ instruction: "  " })).toEqual({});
    expect(reviseBody({ instruction: " Shorter ", quickAction: "shorten", selection: "the sofa" })).toEqual({
      instruction: "Shorter",
      quick_action: "shorten",
      scope: { type: "selection", text: "the sofa" },
    });
  });

  it("names REVISION_NOT_APPLICABLE in plain words, nothing else", () => {
    expect(reviseErrorKey({ error: "REVISION_NOT_APPLICABLE", httpStatus: 400 })).toBe(
      "enrichment.correct.error.not_applicable"
    );
    expect(reviseErrorKey({ error: "VALIDATION_ERROR", httpStatus: 400 })).toBe("");
    expect(reviseErrorKey(null)).toBe("");
  });

  it("adds a rule trimmed, once, within the limits", () => {
    expect(addRule(["a"], "  b ")).toEqual({ rules: ["a", "b"], error: "" });
    expect(addRule(["a"], "a").rules).toEqual(["a"]);
    expect(addRule([], "x".repeat(201)).error).toBe("too_long");
    expect(addRule(Array.from({ length: MAX_RULES }, (_, i) => `r${i}`), "new").error).toBe("too_many");
  });

  it("reads a value as text and replaces it keeping the envelope", () => {
    expect(valueText({ text: "<p>x</p>" })).toBe("<p>x</p>");
    expect(valueText({ options: ["a", "b"] })).toBe("a, b");
    expect(valueText({ option: "red" })).toBe("red");
    expect(withText({ text: "a", format: "html" }, "b")).toEqual({ text: "b", format: "html" });
  });

  it("tells a restore from an AI or a manual version", () => {
    expect(versionInfo({ author_kind: "restore", instruction: "#2" })).toMatchObject({ author: "restore", restoredFrom: 2, instruction: "" });
    expect(versionInfo({ author_kind: "ai", instruction: "Say crimson" })).toEqual({
      author: "ai", quickAction: null, instruction: "Say crimson", fragment: "",
    });
    expect(versionInfo({ author_kind: "user", instruction: "" }).author).toBe("user");
  });

  it("shows a quick action by its key, never the prompt the API expanded it into", () => {
    const shorter = "Make the text noticeably shorter; keep the key information.";
    expect(splitInstruction(shorter)).toEqual({ quickAction: "shorten", instruction: "" });
    expect(splitInstruction(`${shorter}\n\nMention the warranty`)).toEqual({ quickAction: "shorten", instruction: "Mention the warranty" });
    expect(splitInstruction("Make the text noticeably shorter please")).toEqual({ quickAction: null, instruction: "Make the text noticeably shorter please" });
    const scoped = versionInfo({ author_kind: "ai", instruction: shorter, scope: { type: "selection", text: "red sofa" } });
    expect(scoped).toMatchObject({ quickAction: "shorten", fragment: "red sofa" });
  });

  it("reads the selected text of a textarea", () => {
    expect(textareaSelection({ value: "a red sofa", selectionStart: 2, selectionEnd: 5 })).toBe("red");
    expect(textareaSelection({ value: "a red sofa", selectionStart: 3, selectionEnd: 3 })).toBe("");
    expect(textareaSelection(null)).toBe("");
  });
});

describe("sentenceWith", () => {
  it("returns the sentence that holds the number, tags dropped", () => {
    const text = "<p>Cuadro de aluminio.</p><p>Tiene 7 años de garantía. Envío gratis!</p>";
    expect(sentenceWith(text, "7")).toBe("Tiene 7 años de garantía.");
  });

  it("caps a long sentence and gives nothing when no sentence holds the number", () => {
    expect(sentenceWith(`${"a".repeat(300)} 7`, "7")).toHaveLength(200);
    expect(sentenceWith("No numbers here.", "7")).toBe("");
  });
});
