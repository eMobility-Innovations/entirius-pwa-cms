import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/enrichment/api", () => ({
  GET_Workers: () => Promise.resolve({ data: [{ key: "pim.writer", label: "Product writer" }, { key: "article.keywords", label: "Article search phrases" }] }),
}));

import RoutingMap from "@/views/EnrichmentProfile/RoutingMap.vue";

const $t = (key) => `T:${key}`;

describe("RoutingMap", () => {
  it("names each task by its worker and each section by its heading, never by key", async () => {
    const w = mount(RoutingMap, {
      props: { modelValue: { "pim.writer": ["facts", "brand"], "article.keywords": ["seo"] } },
      global: { mocks: { $t } },
    });
    await flushPromises();
    const rows = w.findAll("dl > div").map((row) => row.text());
    expect(rows[0]).toContain("Product writer");
    expect(rows[0]).toContain("T:enrichment.profile.sections.facts, T:enrichment.profile.sections.brand");
    expect(rows[1]).toContain("Article search phrases");
    expect(w.find("dt").text()).not.toContain("pim.writer");
  });

  it("an empty map shows only the note", async () => {
    const w = mount(RoutingMap, { props: { modelValue: {} }, global: { mocks: { $t } } });
    await flushPromises();
    expect(w.find("dl").exists()).toBe(false);
    expect(w.text()).toContain("T:enrichment.profile.json_only");
  });
});
