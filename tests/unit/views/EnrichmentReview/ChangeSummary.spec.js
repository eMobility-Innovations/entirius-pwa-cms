import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChangeSummary from "@/views/EnrichmentReview/ChangeSummary.vue";

const stubs = { Tag: { props: ["label"], template: "<b>{{ label }}</b>" }, LengthCounter: { name: "LengthCounter", props: ["length"], template: "<i />" } };

describe("ChangeSummary", () => {
  it("text: a new/changed tag, the excerpt and, with rules, the length", () => {
    const proposal = { target_kind: "attribute_value", proposed_value: { text: "<p>Hello</p>" }, current_snapshot: { text: "Hi" } };
    const w = mount(ChangeSummary, { props: { proposal, rules: { max: 255 } }, global: { stubs } });
    expect(w.find("b").text()).toBe("enrichment.review.change_changed");
    expect(w.find(".change-summary__excerpt").text()).toBe("Hello");
    expect(w.findComponent({ name: "LengthCounter" }).props("length")).toBe(5);
  });

  it("video: a small tile and its duration, no player", () => {
    const proposal = { id: 8, target_kind: "video", proposed_value: { duration_s: 4 } };
    const w = mount(ChangeSummary, { props: { proposal }, global: { stubs } });
    expect(w.find(".change-summary__thumb").exists()).toBe(true);
    expect(w.find("video").exists()).toBe(false);
    expect(w.find("b").text()).toBe('enrichment.review.duration::{"seconds":4}');
  });

  it("tags: what is added and removed, in one line", () => {
    const proposal = { target_kind: "attribute_value", proposed_value: { options: ["a", "b", "c"] }, current_snapshot: { options: ["c", "d"] } };
    const w = mount(ChangeSummary, { props: { proposal }, global: { stubs } });
    expect(w.find("[data-testid='change-summary-tags']").text()).toBe('enrichment.review.tag_changes::{"added":2,"removed":1}');
  });
});
