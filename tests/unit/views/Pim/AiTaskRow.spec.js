import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AiTaskRow from "@/views/Pim/components/enrichment/AiTaskRow.vue";

// The global $t stub returns the key, so these name only real (known) error keys.
const KNOWN = new Set(["enrichment.ai.error.translate_PROVIDER_NOT_CONFIGURED", "enrichment.ai.error.UPSTREAM_TIMEOUT"]);
const $t = (key, params) => (KNOWN.has(key) && !params ? `T:${key}` : params ? `${key}::${JSON.stringify(params)}` : key);

const task = (over = {}) => ({
  id: 9, type: "pim.translate", status: "done", created_at: new Date().toISOString(),
  params: { target_languages: ["pl", "en"] }, counts: {}, errors: [], proposal_counts: {}, ...over,
});
const mountRow = (over, worker = { key: "pim.translate", label: "Translate", kind: "translate" }) =>
  mount(AiTaskRow, {
    props: { task: task(over), worker },
    global: { mocks: { $t }, stubs: { Tag: { props: ["label"], template: "<i>{{ label }}</i>" }, RouterLink: { props: ["to"], template: "<a><slot /></a>" } } },
  });
const outcome = (w) => w.find("[data-testid='ai-task-outcome']").text();

describe("AiTaskRow", () => {
  it("shows the worker label, its languages as chips and a relative time", () => {
    const w = mountRow();
    expect(w.text()).toContain("Translate");
    expect(w.findAll("i").map((n) => n.text())).toEqual(["PL", "EN"]);
    expect(w.find(".ai-task__time").text()).not.toBe("");
  });

  it("says how many proposals wait for review, with the plural form, and marks it with an accent count pill", () => {
    const w = mountRow({ proposal_counts: { pending: 3 } });
    expect(outcome(w)).toBe('enrichment.ai.outcome.review_few::{"count":3}');
    expect(w.find("[data-testid='ai-task-review']").text()).toBe("3");
    expect(w.find(".ai-task__icon").exists()).toBe(false);
  });

  it("a neutral outcome keeps the muted info icon; no review pill", () => {
    const w = mountRow({ proposal_counts: { rejected: 1 } });
    expect(w.find(".ai-task__icon--neutral").exists()).toBe(true);
    expect(w.find("[data-testid='ai-task-review']").exists()).toBe(false);
  });

  it("names a failure by the kind-specific reason, then the generic one, then the raw code", () => {
    const errors = (code) => [{ subject_ref: "A", code, error_id: "e1" }];
    expect(outcome(mountRow({ status: "failed", errors: errors("PROVIDER_NOT_CONFIGURED") }))).toContain(
      "enrichment.ai.error.translate_PROVIDER_NOT_CONFIGURED"
    );
    expect(outcome(mountRow({ status: "failed", errors: errors("UPSTREAM_TIMEOUT") }))).toContain("enrichment.ai.error.UPSTREAM_TIMEOUT");
    expect(outcome(mountRow({ status: "failed", errors: errors("WEIRD") }))).toContain('enrichment.ai.error.unknown::{\\"code\\":\\"WEIRD\\"}');
  });

  it("clicking the row selects the task; the id is a small link of its own", async () => {
    const w = mountRow();
    await w.find(".ai-task__select").trigger("click");
    expect(w.emitted("select")[0]).toEqual([9]);
    expect(w.find(".ai-task__id").text()).toBe("#9");
  });
});
