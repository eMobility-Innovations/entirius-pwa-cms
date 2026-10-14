import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CorrectionBar from "@/views/EnrichmentReview/CorrectionBar.vue";
import VersionTimeline from "@/views/EnrichmentReview/VersionTimeline.vue";
import RuleChips from "@/views/EnrichmentReview/RuleChips.vue";
import VariantPicker from "@/views/EnrichmentReview/VariantPicker.vue";

const BasicButton = {
  name: "BasicButton",
  props: ["disabled"],
  emits: ["click"],
  template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
};
const BasicInput = {
  name: "BasicInput",
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue", "onKeyDown"],
  template: "<input :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
};
const FormField = { props: ["label", "error"], template: "<div><slot /><em v-if='error'>{{ error }}</em></div>" };
const SegmentedControl = { name: "SegmentedControl", props: ["modelValue", "options"], template: "<div />" };
const Tag = { name: "Tag", props: ["label"], emits: ["remove"], template: "<i>{{ label }}</i>" };
const BasicMenu = { name: "BasicMenu", props: ["items"], emits: ["select"], template: "<div><slot name='trigger' /></div>" };
const stubs = { BasicButton, BasicInput, FormField, SegmentedControl, Tag, BasicMenu, IconButton: true, TextDiff: true };

describe("CorrectionBar", () => {
  it("a quick action asks with the instruction typed so far", async () => {
    const w = mount(CorrectionBar, { global: { stubs } });
    await w.find("input").setValue("Keep the brand name");
    await w.find("[data-testid='correction-quick-shorten']").trigger("click");
    expect(w.emitted("submit")[0][0]).toEqual({ instruction: "Keep the brand name", quickAction: "shorten", selection: "" });
  });

  it("Correct needs an instruction; a selection narrows it by default", async () => {
    const w = mount(CorrectionBar, { global: { stubs } });
    expect(w.find("[data-testid='correction-send']").attributes("disabled")).toBeDefined();
    await w.setProps({ selection: "red sofa" });
    expect(w.find("[data-testid='correction-scope']").exists()).toBe(true);
    await w.find("input").setValue("Say crimson");
    await w.find("[data-testid='correction-send']").trigger("click");
    expect(w.emitted("submit")[0][0]).toMatchObject({ quickAction: null, selection: "red sofa" });
  });

  it("busy: buttons off and a plain-words wait line", () => {
    const w = mount(CorrectionBar, { props: { busy: true }, global: { stubs } });
    expect(w.find("[data-testid='correction-busy']").text()).toContain("enrichment.correct.busy");
    expect(w.find("[data-testid='correction-quick-formal']").attributes("disabled")).toBeDefined();
  });

  it("a batch has no variants and no scope; select values have no quick actions", () => {
    const batch = mount(CorrectionBar, { props: { batch: true, selection: "x" }, global: { stubs } });
    expect(batch.find("[data-testid='correction-quick-variants']").exists()).toBe(false);
    expect(batch.find("[data-testid='correction-scope']").exists()).toBe(false);
    const select = mount(CorrectionBar, { props: { shape: "select" }, global: { stubs } });
    expect(select.find("[data-testid^='correction-quick-']").exists()).toBe(false);
  });
});

const REVISIONS = [
  { number: 1, value: { text: "A red sofa" }, instruction: "", author_kind: "ai", created_at: "2026-10-14T10:00:00Z" },
  { number: 2, value: { text: "A sofa" }, instruction: "Shorter", author_kind: "ai", created_at: "2026-10-14T10:01:00Z" },
  { number: 3, value: { text: "A red sofa" }, instruction: "#1", author_kind: "restore", created_at: "2026-10-14T10:02:00Z" },
];

describe("VersionTimeline", () => {
  it("names each version by its author and instruction; the last is current", () => {
    const w = mount(VersionTimeline, { props: { revisions: REVISIONS }, global: { stubs } });
    const authors = w.findAll("[data-testid='version-author']").map((n) => n.text());
    expect(authors).toEqual([
      "enrichment.versions.by_ai",
      "enrichment.versions.by_ai",
      'enrichment.versions.restored::{"number":1}',
    ]);
    expect(w.find("[data-testid='version-2'] [data-testid='version-instruction']").text()).toBe("Shorter");
    expect(w.find("[data-testid='version-restore-3']").exists()).toBe(false);
  });

  it("an AI version shows what it cost; your edits and restores cost nothing", () => {
    const revisions = REVISIONS.map((r, i) => ({ ...r, cost_usd: [null, "0.0300", null][i] }));
    const w = mount(VersionTimeline, { props: { revisions }, global: { stubs } });
    const costs = (n) => w.findAllComponents({ name: "CostLabel" }).filter((c) => c.element.closest(`[data-testid='version-${n}']`));
    expect(costs(1)[0].props("cost")).toBeNull();
    expect(costs(2)[0].props("cost")).toBe("0.0300");
    expect(costs(3)).toHaveLength(0);
  });

  it("shows the changes against the version before, and restores", async () => {
    const w = mount(VersionTimeline, { props: { revisions: REVISIONS }, global: { stubs } });
    await w.find("[data-testid='version-toggle-2']").trigger("click");
    expect(w.findComponent({ name: "TextDiff" }).props()).toMatchObject({ before: "A red sofa", after: "A sofa" });
    await w.find("[data-testid='version-restore-1']").trigger("click");
    expect(w.emitted("restore")[0]).toEqual([1]);
  });
});

describe("RuleChips", () => {
  it("adds and removes rules as a new list", async () => {
    const w = mount(RuleChips, { props: { rules: ["No prices"] }, global: { stubs } });
    await w.find("input").setValue("Use 'you'");
    await w.find("[data-testid='rule-add']").trigger("click");
    expect(w.emitted("change")[0][0]).toEqual(["No prices", "Use 'you'"]);
    w.findComponent({ name: "Tag" }).vm.$emit("remove");
    expect(w.emitted("change")[1][0]).toEqual([]);
  });

  it("keeps a rule for the template only when the task came from one", () => {
    const worker = mount(RuleChips, { props: { rules: ["r"], hasWorker: true }, global: { stubs } });
    expect(worker.findComponent({ name: "BasicMenu" }).props("items").map((i) => i.key)).toEqual(["worker"]);
    const both = mount(RuleChips, { props: { rules: ["r"], hasWorker: true, hasTemplate: true }, global: { stubs } });
    both.findComponent({ name: "BasicMenu" }).vm.$emit("select", { key: "template" });
    expect(both.emitted("promote")[0][0]).toEqual({ rule: "r", target: "template" });
  });

  it("says why a rule is refused", async () => {
    const w = mount(RuleChips, { global: { stubs } });
    await w.find("input").setValue("x".repeat(201));
    await w.find("[data-testid='rule-add']").trigger("click");
    expect(w.find("em").text()).toContain("enrichment.rules.error.too_long");
    expect(w.emitted("change")).toBeUndefined();
  });
});

describe("VariantPicker", () => {
  it("renders each candidate safely and picks one", async () => {
    const w = mount(VariantPicker, {
      props: { candidates: [{ text: '<p onclick="x()">One</p>' }, { text: "Two < 3 seats" }] },
      global: { stubs },
    });
    expect(w.find("[data-testid='variant-0']").html()).not.toContain("onclick");
    expect(w.find("[data-testid='variant-1']").text()).toContain("Two < 3 seats");
    await w.find("[data-testid='variant-pick-1']").trigger("click");
    expect(w.emitted("pick")[0][0]).toEqual({ text: "Two < 3 seats" });
  });
});
