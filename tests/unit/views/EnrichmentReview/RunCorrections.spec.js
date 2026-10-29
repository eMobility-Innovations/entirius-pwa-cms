import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RunCorrections from "@/views/EnrichmentReview/RunCorrections.vue";

const BatchCorrection = { name: "BatchCorrection", props: ["taskId"], emits: ["queued"], template: "<div />" };
const RouterLink = { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" };
const row = (id, task_id, over = {}) => ({ id, task_id, status: "pending", target_kind: "attribute_value", ...over });
const LABELS = {
  5: { title: "Opis produktu · Orion Command Sofa", at: "2026-10-15T10:00:00Z" },
  4: { title: "Opis produktu · 12 products", at: "2026-10-15T09:00:00Z" },
};

function mountRuns(rows, query = { status: "pending" }) {
  return mount(RunCorrections, {
    props: { rows, labels: LABELS },
    global: { stubs: { BatchCorrection, RouterLink }, mocks: { $route: { path: "/enrichment", query } } },
  });
}

describe("RunCorrections", () => {
  it("offers Correct all once per run behind the pending rows, each named as runs read everywhere", () => {
    const w = mountRuns([row(1, 5), row(2, 5), row(3, 4)]);
    expect(w.findAllComponents(BatchCorrection).map((c) => c.props("taskId"))).toEqual([5, 4]);
    expect(w.get("[data-testid='run-corrections-link-5']").text()).toBe("Opis produktu · Orion Command Sofa");
    expect(w.get("[data-testid='run-corrections-link-4']").text()).toBe("Opis produktu · 12 products");
    expect(w.get("[data-testid='run-corrections-4']").text()).toContain("ago");
  });

  it("a run's name filters the list to its proposals, the other filters kept", () => {
    const w = mountRuns([row(1, 5)]);
    expect(w.getComponent(RouterLink).props("to")).toEqual({ name: "EnrichmentReview", query: { status: "pending", task: "5" } });
  });

  it("a run not labelled yet reads as an AI task", () => {
    const w = mountRuns([row(1, 9)]);
    expect(w.get("[data-testid='run-corrections-link-9']").text()).toBe("enrichment.tasks.generic");
  });

  it("leaves out Studio steps, media and proposals without a run, and shows at most three runs", () => {
    const w = mountRuns([
      row(1, 9, { subject_ref: "run:abc" }),
      row(2, 8, { target_kind: "picture" }),
      row(3, null),
      row(4, 1), row(5, 2), row(6, 3), row(7, 4),
    ]);
    expect(w.findAllComponents(BatchCorrection).map((c) => c.props("taskId"))).toEqual([1, 2, 3]);
  });

  it("shows nothing without a correctable pending row", () => {
    const w = mountRuns([row(1, 5, { status: "applied" })]);
    expect(w.find("[data-testid='run-corrections']").exists()).toBe(false);
  });

  it("a queued batch asks the page to refresh", () => {
    const w = mountRuns([row(1, 5)]);
    w.findComponent(BatchCorrection).vm.$emit("queued", 3);
    expect(w.emitted("queued")).toHaveLength(1);
  });
});
