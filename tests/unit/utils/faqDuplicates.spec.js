import { describe, it, expect } from "vitest";
import {
  normalizeQuestion,
  faqItemQuestions,
  documentQuestions,
  findDuplicates,
} from "@/utils/faqDuplicates";

describe("normalizeQuestion", () => {
  it("ignores case, punctuation and extra spaces", () => {
    expect(normalizeQuestion("  Jak  dobrać klocki?! ")).toBe(normalizeQuestion("jak dobrać klocki"));
  });

  it("ignores Polish diacritics, ł included", () => {
    expect(normalizeQuestion("Ile kosztuje wymiana łożyska?")).toBe("ile kosztuje wymiana lozyska");
  });

  it("strips HTML tags and non-breaking spaces", () => {
    expect(normalizeQuestion("<p>Czym jest&nbsp;<strong>ABS</strong>?</p>")).toBe("czym jest abs");
  });

  it("returns an empty key for empty or missing text", () => {
    expect(normalizeQuestion("")).toBe("");
    expect(normalizeQuestion("<p> ? </p>")).toBe("");
    expect(normalizeQuestion(null)).toBe("");
  });
});

describe("faqItemQuestions", () => {
  it("lists the question and every translated question with its language", () => {
    const item = {
      question: "Czym jest ABS?",
      is_active: true,
      translations: [{ language: "en", question: "What is ABS?" }],
    };
    expect(faqItemQuestions(item)).toEqual([
      { question: "Czym jest ABS?", language: null },
      { question: "What is ABS?", language: "en" },
    ]);
  });

  it("skips an inactive item, the storefront does not show it", () => {
    expect(faqItemQuestions({ question: "Czym jest ABS?", is_active: false, translations: [] })).toEqual([]);
  });
});

describe("documentQuestions", () => {
  const faqSection = (questions) => ({
    core_type: "section-faq",
    faq_items: questions.map((question) => ({ question, answer: "…" })),
  });

  it("reads faq_items of every section of the saved (normalised) content", () => {
    const content = {
      sections: { a: faqSection(["Jak dobrać klocki?"]), b: { core_type: "section-type-a" }, c: faqSection(["Co to OE?"]) },
      sections_order: ["a", "b", "c"],
      tiles: {},
      tiles_order: {},
    };
    expect(documentQuestions(content)).toEqual(["Jak dobrać klocki?", "Co to OE?"]);
  });

  it("reads the old array shape too", () => {
    expect(documentQuestions([faqSection(["Jak dobrać klocki?"])])).toEqual(["Jak dobrać klocki?"]);
  });

  it("finds the questions by the shape of the data, whatever the section type is called", () => {
    const content = { sections: { a: { core_type: "my-faq", faq_items: [{ question: "Co to OE?" }] } } };
    expect(documentQuestions(content)).toEqual(["Co to OE?"]);
  });

  it("skips pairs without a question and content without sections", () => {
    expect(documentQuestions({ sections: { a: faqSection(["", "Co to OE?"]) } })).toEqual(["Co to OE?"]);
    expect(documentQuestions(null)).toEqual([]);
    expect(documentQuestions({})).toEqual([]);
  });
});

describe("findDuplicates", () => {
  it("groups the places of one question, most repeated first", () => {
    const occurrences = [
      { question: "Co to OE?", place: "faq" },
      { question: "Jak dobrać klocki?", place: "faq" },
      { question: "Jak dobrać klocki", place: "category" },
      { question: "jak dobrac KLOCKI?", place: "blog" },
      { question: "co to oe", place: "blog" },
      { question: "Ile trwa dostawa?", place: "faq" },
    ];
    expect(findDuplicates(occurrences)).toEqual([
      {
        question: "Jak dobrać klocki?",
        occurrences: [occurrences[1], occurrences[2], occurrences[3]],
      },
      { question: "Co to OE?", occurrences: [occurrences[0], occurrences[4]] },
    ]);
  });

  it("reports a question repeated inside one document", () => {
    const occurrences = [
      { question: "Co to OE?", place: "category" },
      { question: "Co to OE?", place: "category" },
    ];
    expect(findDuplicates(occurrences)).toHaveLength(1);
  });

  it("returns nothing without repeats and ignores empty questions", () => {
    expect(findDuplicates([{ question: "Co to OE?" }, { question: "" }, { question: "?" }])).toEqual([]);
  });

  it("counts an item once when its translation repeats the base text, but two items with one question stay a repeat", () => {
    const at = (itemId, language) => ({ question: "Co to OE?", source: "faq", itemId, language });
    expect(findDuplicates([at(1, null), at(1, "pl")])).toEqual([]);
    expect(findDuplicates([at(1, null), at(1, "pl"), at(2, null)])).toHaveLength(1);
  });
});
