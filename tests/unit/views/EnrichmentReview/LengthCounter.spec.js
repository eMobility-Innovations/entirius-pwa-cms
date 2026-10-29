import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LengthCounter from "@/views/EnrichmentReview/LengthCounter.vue";
import SearchSnippet from "@/views/EnrichmentReview/SearchSnippet.vue";

describe("LengthCounter", () => {
  it("shows the length against the target in the target's tone", () => {
    const w = mount(LengthCounter, { props: { length: 140, rules: { min: 120, max: 155 } } });
    expect(w.text()).toBe('enrichment.review.length::{"count":140,"target":"120–155"}');
    expect(w.classes()).toContain("length-counter--positive");
    const compact = mount(LengthCounter, { props: { length: 140, rules: { min: 120, max: 155 }, compact: true } });
    expect(compact.text()).toBe('enrichment.review.length_short::{"count":140}');
    const over = mount(LengthCounter, { props: { length: 300, rules: { max: 255 } } });
    expect(over.classes()).toContain("length-counter--negative");
  });
});

describe("SearchSnippet", () => {
  it("cuts the text where a search result does", () => {
    const w = mount(SearchSnippet, { props: { title: "Sofa", url: "/sofa", text: "a".repeat(200) } });
    const text = w.find(".search-snippet__text").text();
    expect(text).toHaveLength(160);
    expect(text.endsWith("…")).toBe(true);
    expect(w.text()).toContain("Sofa");
  });
});
