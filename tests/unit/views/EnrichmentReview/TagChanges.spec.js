import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/views/EnrichmentReview/fieldCatalog", async (importOriginal) => ({
  ...(await importOriginal()),
  loadCatalog: async () => ({
    fields: [{ key: "badge", type: "multiselect", options: [{ value: "new", label: "New" }, { value: "eco", label: "Eco" }] }],
    languages: [],
  }),
}));

import TagChanges from "@/views/EnrichmentReview/TagChanges.vue";

const StatusBadge = { name: "StatusBadge", props: ["label", "tone"], template: "<b>{{ label }}</b>" };
const mountTags = (proposed, current) =>
  mount(TagChanges, {
    props: { proposed, current, locator: { channel: "eu", feature_idx: "badge" } },
    global: { stubs: { StatusBadge } },
  });

describe("TagChanges", () => {
  it("chips for added, removed and kept tags, named by the catalog", async () => {
    const w = mountTags({ options: ["new", "sale"] }, { options: ["eco", "sale"] });
    await flushPromises();
    const chips = (group) => w.findAll(`[data-testid='tag-changes-${group}'] b`).map((b) => b.text());
    expect(chips("added")).toEqual(["+ New"]);
    expect(chips("removed")).toEqual(["− Eco"]);
    expect(chips("kept")).toEqual(["sale"]);
    expect(w.findAllComponents(StatusBadge).map((c) => c.props("tone"))).toEqual(["positive", "negative", "neutral"]);
  });

  it("a single select swaps one option for another", async () => {
    const w = mountTags({ option: "new" }, { option: "" });
    await flushPromises();
    expect(w.find("[data-testid='tag-changes-added']").text()).toContain("+ New");
    expect(w.find("[data-testid='tag-changes-removed']").exists()).toBe(false);
  });

  it("nothing to change says so", () => {
    const w = mountTags({ options: [] }, { options: [] });
    expect(w.text()).toBe("enrichment.review.tags_none");
  });
});
