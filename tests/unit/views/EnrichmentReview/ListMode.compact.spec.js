import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/api/pim/api", () => ({
  GET_Features: () => Promise.resolve({ data: { results: [{ idx: "meta_description", name: "Meta description" }] } }),
}));

import ListMode from "@/views/EnrichmentReview/ListMode.vue";

const DataTable = {
  name: "DataTable",
  props: ["columns", "rows"],
  emits: ["row-click"],
  template: `<div><div v-for="row in rows" :key="row.id" class="row">
    <slot name="cell-product" :row="row" /><slot name="cell-field" :row="row" /><slot name="cell-change" :row="row" />
    <slot name="cell-actions" :row="row" /></div></div>`,
};
const stubs = {
  DataTable,
  Loader: true,
  EmptyState: true,
  ChangeSummary: { name: "ChangeSummary", props: ["proposal", "rules"], template: "<i />" },
  Tag: { props: ["label"], template: "<b>{{ label }}</b>" },
  IconButton: { name: "IconButton", props: ["icon", "label"], template: "<button />" },
  BasicButton: { template: "<button><slot /></button>" },
};
const row = (over = {}) => ({
  id: 1, status: "pending", target_module: "pim", subject_ref: "ENT-1", subject_label: "Orion sofa",
  target_kind: "attribute_value", target_locator: { language: "pl", feature_idx: "meta_description" },
  proposed_value: { text: "x" }, current_snapshot: { text: "" }, confidence: null, source: "worker:pim.meta@v1",
  ...over,
});
const mountList = (rows) => mount(ListMode, { props: { rows, totalCount: rows.length }, global: { stubs } });
const keys = (w) => w.findComponent(DataTable).props("columns").map((c) => c.key);

describe("ListMode — compact rows", () => {
  it("shows product, field, change, status and age; technical columns only on More columns", async () => {
    const w = mountList([row()]);
    expect(keys(w)).toEqual(["product", "field", "change", "status", "age", "actions"]);
    await w.find("[data-testid='enrichment-more-columns']").trigger("click");
    expect(keys(w)).toEqual(["product", "field", "change", "status", "confidence", "target_module", "target_kind", "source", "batch_id", "age", "actions"]);
  });

  it("confidence shows by itself once some row has one", () => {
    expect(keys(mountList([row(), row({ id: 2, confidence: "0.8" })]))).toContain("confidence");
  });

  it("a row reads SKU and name, the field by its PIM name with a language chip, and the change in brief", () => {
    const w = mountList([row()]);
    expect(w.text()).toContain("ENT-1");
    expect(w.text()).toContain("Orion sofa");
    expect(w.findAll("b").map((n) => n.text())).toEqual(["PL"]);
    expect(w.findComponent({ name: "ChangeSummary" }).props("rules")).toEqual({ min: 120, max: 155, snippet: true });
  });

  it("a named product leads with its name, its SKU under it; an unnamed one shows the SKU once", () => {
    const named = mountList([row()]);
    expect(named.get("[data-testid='enrichment-subject-1']").text()).toBe("Orion sofa");
    expect(named.get("[data-testid='enrichment-sku-1']").text()).toBe("ENT-1");
    const bare = mountList([row({ subject_label: "" })]);
    expect(bare.get("[data-testid='enrichment-subject-1']").text()).toBe("ENT-1");
    expect(bare.find("[data-testid='enrichment-sku-1']").exists()).toBe(false);
  });

  // The name cell clamps a long name to two lines (CSS); what stays readable is the full name in a title.
  it("a long product name keeps its full text in a title: the button for a PIM row, the label line for another module", () => {
    const long = "Smoczek silikonowy dynamiczny LOVI 6-18m 2 szt CapiChill boy";
    const pim = mountList([row({ subject_label: long })]);
    expect(pim.get("[data-testid='enrichment-subject-1']").attributes("title")).toBe(long);

    const other = mountList([row({ target_module: "content", subject_label: long })]);
    expect(other.get("span[title]").attributes("title")).toBe(long);
    expect(other.get("span[title]").text()).toBe(long);
  });

  it("under the field, which run proposed it and when: two texts of one field from two runs read apart", () => {
    const runs = { 5: { name: "Opis produktu", at: new Date().toISOString() } };
    const w = mount(ListMode, { props: { rows: [row({ task_id: 5 }), row({ id: 2, task_id: 6 })], runs }, global: { stubs } });
    expect(w.get("[data-testid='enrichment-run-1']").text()).toMatch(/^Opis produktu · /);
    expect(w.find("[data-testid='enrichment-run-2']").exists()).toBe(false);
  });

  it("the open affordance and a row click both open the detail; quick Apply stays in the row", async () => {
    const r = row();
    const w = mountList([r]);
    w.findComponent({ name: "IconButton" }).vm.$emit("click");
    w.findComponent(DataTable).vm.$emit("row-click", r);
    expect(w.emitted("row-open")).toEqual([[r], [r]]);
    await w.find("[data-testid='enrichment-accept-1']").trigger("click");
    expect(w.emitted("accept")[0]).toEqual([r]);
  });
});
