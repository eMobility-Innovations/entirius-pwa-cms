import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MetaCards from "@/views/EnrichmentStudio/MetaCards.vue";

const StepCallout = { name: "StepCallout", props: ["tone", "icon"], template: "<div><slot /></div>" };
const stubs = { StepCallout, LengthCounter: true, SearchSnippet: true, BasicButton: true };
const DATA = { title: "Smoczek", description: "x".repeat(169), faq: [{ question: "Q?", answer: "A." }] };
const proposal = (warnings) => ({ id: 7, status: "pending", proposed_value: { data: DATA }, warnings });
const mountCards = (warnings) => mount(MetaCards, { props: { proposal: proposal(warnings) }, global: { stubs } });

describe("MetaCards — quality warnings", () => {
  it("lists each warning under the name of its field", () => {
    const warnings = [
      { code: "LIMIT", message: "169 characters, the limit is 160.", span: null, path: "description" },
      { code: "NUMBER_NOT_IN_FACTS", message: "The number 40 is not…", span: { start: 0, end: 2, text: "40" }, path: "faq[1].answer" },
      { code: "rule", message: "No superlatives.", span: null, path: null },
    ];
    const items = mountCards(warnings).findAll("[data-testid='meta-warnings'] li").map((li) => li.text());
    expect(items).toEqual([
      "enrichment.studio.meta.description: 169 characters, the limit is 160.",
      'enrichment.studio.meta.faq_item::{"number":2}: The number 40 is not…',
      "No superlatives.",
    ]);
  });

  it("shows no warning block without warnings", () => {
    expect(mountCards([]).find("[data-testid='meta-warnings']").exists()).toBe(false);
  });
});
