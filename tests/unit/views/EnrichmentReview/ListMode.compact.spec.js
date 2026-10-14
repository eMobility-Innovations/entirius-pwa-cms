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
