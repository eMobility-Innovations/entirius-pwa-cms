import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CorrectionBar from "@/views/EnrichmentReview/CorrectionBar.vue";
import CorrectionThread from "@/views/EnrichmentReview/CorrectionThread.vue";
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
const BasicTextarea = {
  name: "BasicTextarea",
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: "<textarea :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
};
const IconButton = {
  name: "IconButton",
  props: ["disabled", "label"],
  emits: ["click"],
  template: "<button :disabled='disabled' :aria-label='label' @click=\"$emit('click')\" />",
};
const FormField = { props: ["label", "error"], template: "<div><slot /><em v-if='error'>{{ error }}</em></div>" };
const SegmentedControl = { name: "SegmentedControl", props: ["modelValue", "options"], template: "<div />" };
const BasicMenu = { name: "BasicMenu", props: ["items"], emits: ["select"], template: "<div><slot name='trigger' /></div>" };
const stubs = {
  BasicButton, BasicInput, BasicTextarea, IconButton, FormField, SegmentedControl, BasicMenu,
  CountBadge: true, CostLabel: { name: "CostLabel", props: ["cost"], template: "<i />" }, TextDiff: true,
};

describe("CorrectionBar", () => {
  it("a suggestion chip asks for that action alone; the typed text stays for the next message", async () => {
    const w = mount(CorrectionBar, { global: { stubs } });
    await w.find("textarea").setValue("Keep the brand name");
    await w.find("[data-testid='correction-quick-shorten']").trigger("click");
    expect(w.emitted("submit")[0][0]).toEqual({ instruction: "", quickAction: "shorten", selection: "" });
    expect(w.find("textarea").element.value).toBe("Keep the brand name");
  });

  it("Enter sends the message, Shift+Enter breaks the line; an empty message is not sent", async () => {
    const w = mount(CorrectionBar, { global: { stubs } });
    expect(w.find("[data-testid='correction-send']").attributes("disabled")).toBeDefined();
    await w.find("textarea").trigger("keydown", { key: "Enter" });
    expect(w.emitted("submit")).toBeUndefined();
    await w.find("textarea").setValue("Say crimson");
    await w.find("textarea").trigger("keydown", { key: "Enter", shiftKey: true });
    expect(w.emitted("submit")).toBeUndefined();
    await w.find("textarea").trigger("keydown", { key: "Enter" });
    expect(w.emitted("submit")[0][0]).toEqual({ instruction: "Say crimson", quickAction: null, selection: "" });
  });

  it("a selection narrows the message by default", async () => {
    const w = mount(CorrectionBar, { global: { stubs } });
    await w.setProps({ selection: "red sofa" });
    expect(w.find("[data-testid='correction-scope']").exists()).toBe(true);
    await w.find("textarea").setValue("Say crimson");
    await w.find("[data-testid='correction-send']").trigger("click");
    expect(w.emitted("submit")[0][0]).toMatchObject({ quickAction: null, selection: "red sofa" });
  });

  it("busy: chips and send off", () => {
    const w = mount(CorrectionBar, { props: { busy: true }, global: { stubs } });
    expect(w.find("[data-testid='correction-quick-formal']").attributes("disabled")).toBeDefined();
    expect(w.find("[data-testid='correction-send']").attributes("disabled")).toBeDefined();
  });

  it("a batch picks a chip instead of sending and reports the draft; no variants, no scope", async () => {
    const batch = mount(CorrectionBar, { props: { batch: true, selection: "x" }, global: { stubs } });
    expect(batch.find("[data-testid='correction-quick-variants']").exists()).toBe(false);
    expect(batch.find("[data-testid='correction-scope']").exists()).toBe(false);
    expect(batch.find("[data-testid='correction-send']").exists()).toBe(false);
    expect(batch.emitted("draft").at(-1)[0].ready).toBe(false);
    await batch.find("[data-testid='correction-quick-formal']").trigger("click");
    expect(batch.emitted("submit")).toBeUndefined();
    expect(batch.find("[data-testid='correction-quick-formal']").attributes("aria-pressed")).toBe("true");
    expect(batch.emitted("draft").at(-1)[0]).toMatchObject({ quickAction: "formal", ready: true });
    const select = mount(CorrectionBar, { props: { shape: "select" }, global: { stubs } });
    expect(select.find("[data-testid^='correction-quick-']").exists()).toBe(false);
  });
});

const SHORTER = "Make the text noticeably shorter; keep the key information.";
const REVISIONS = [
  { number: 1, value: { text: "A red sofa" }, instruction: "", author_kind: "ai", created_at: "2026-10-14T10:00:00Z" },
  { number: 2, value: { text: "A sofa" }, instruction: `${SHORTER}\n\nKeep the colour`, author_kind: "ai", created_at: "2026-10-14T10:01:00Z" },
  { number: 3, value: { text: "A red sofa" }, instruction: "#1", author_kind: "restore", created_at: "2026-10-14T10:02:00Z" },
];

describe("CorrectionThread", () => {
  it("reads as a conversation: the request by its label and words, each answer by its version", () => {
    const w = mount(CorrectionThread, { props: { revisions: REVISIONS }, global: { stubs } });
    const titles = w.findAll("[data-testid='version-author']").map((n) => n.text());
    expect(titles).toEqual([
      "enrichment.thread.first_draft",
      'enrichment.thread.version::{"number":2}',
      'enrichment.thread.restored::{"number":1}',
    ]);
    const ask = w.find("[data-testid='thread-ask-2']");
    expect(ask.find("[data-testid='ask-action']").text()).toBe("enrichment.correct.quick.shorten");
    expect(ask.find("[data-testid='ask-text']").text()).toBe("Keep the colour");
    expect(ask.text()).not.toContain(SHORTER);
    expect(w.find("[data-testid='thread-ask-1']").exists()).toBe(false);
    expect(w.find("[data-testid='version-restore-3']").exists()).toBe(false);
  });

  it("an AI answer shows what it cost; your edits and restores cost nothing", () => {
    const revisions = REVISIONS.map((r, i) => ({ ...r, cost_usd: [null, "0.0300", null][i] }));
    const w = mount(CorrectionThread, { props: { revisions }, global: { stubs } });
    const costs = (n) => w.findAllComponents({ name: "CostLabel" }).filter((c) => c.element.closest(`[data-testid='version-${n}']`));
    expect(costs(1)[0].props("cost")).toBeNull();
    expect(costs(2)[0].props("cost")).toBe("0.0300");
    expect(costs(3)).toHaveLength(0);
  });

  it("shows the changes against the version before, and restores", async () => {
    const w = mount(CorrectionThread, { props: { revisions: REVISIONS }, global: { stubs } });
    expect(w.findComponent({ name: "TextDiff" }).exists()).toBe(false);
    await w.find("[data-testid='version-toggle-2']").trigger("click");
    expect(w.findComponent({ name: "TextDiff" }).props()).toMatchObject({ before: "A red sofa", after: "A sofa", switchable: false });
    await w.find("[data-testid='version-restore-1']").trigger("click");
    expect(w.emitted("restore")[0]).toEqual([1]);
  });

  it("a version that just landed opens its changes and offers Undo", async () => {
    const two = REVISIONS.slice(0, 2);
    const w = mount(CorrectionThread, { props: { revisions: two, landed: 2 }, global: { stubs } });
    expect(w.findComponent({ name: "TextDiff" }).exists()).toBe(true);
    await w.find("[data-testid='version-undo-2']").trigger("click");
    expect(w.emitted("restore")[0]).toEqual([1]);
    const latest = mount(CorrectionThread, { props: { revisions: two, landed: "latest" }, global: { stubs } });
    expect(latest.find("[data-testid='version-undo-2']").exists()).toBe(true);
    const old = mount(CorrectionThread, { props: { revisions: two }, global: { stubs } });
    expect(old.find("[data-testid='version-undo-2']").exists()).toBe(false);
  });

  it("each answer shows its own text until its changes are opened", async () => {
    const w = mount(CorrectionThread, { props: { revisions: REVISIONS }, global: { stubs } });
    const text = (n) => w.find(`[data-testid='version-${n}'] [data-testid='version-text']`);
    expect(text(1).text()).toBe("A red sofa");
    expect(text(2).text()).toBe("A sofa");
    await w.find("[data-testid='version-toggle-2']").trigger("click");
    expect(text(2).exists()).toBe(false);
  });

  it("an answer with the same text says so without being opened, and offers no empty diff", () => {
    const same = [REVISIONS[0], { ...REVISIONS[1], value: { text: "A red sofa" } }];
    const w = mount(CorrectionThread, { props: { revisions: same }, global: { stubs } });
    expect(w.find("[data-testid='version-unchanged']").exists()).toBe(true);
    expect(w.find("[data-testid='version-toggle-2']").exists()).toBe(false);
  });

  it("an answer with the same text says so instead of an empty diff", () => {
    const same = [REVISIONS[0], { ...REVISIONS[1], value: { text: "A red sofa" } }];
    const w = mount(CorrectionThread, { props: { revisions: same, landed: 2 }, global: { stubs } });
    expect(w.find("[data-testid='version-unchanged']").exists()).toBe(true);
    expect(w.findComponent({ name: "TextDiff" }).exists()).toBe(false);
  });

  it("the request in flight shows as the operator's message and a writing turn", () => {
    const asking = { instruction: "", quickAction: "formal", selection: "red sofa" };
    const w = mount(CorrectionThread, { props: { revisions: REVISIONS.slice(0, 1), asking, busy: true }, global: { stubs } });
    expect(w.find("[data-testid='thread-asking']").text()).toContain("enrichment.correct.quick.formal");
    expect(w.find("[data-testid='thread-asking']").text()).toContain("red sofa");
    expect(w.find("[data-testid='correction-busy']").text()).toContain("enrichment.thread.writing");
  });

  it("a long thread keeps the last turns until Show earlier", async () => {
    const revisions = Array.from({ length: 6 }, (_, i) => ({ ...REVISIONS[1], number: i + 1 }));
    const w = mount(CorrectionThread, { props: { revisions }, global: { stubs } });
    expect(w.find("[data-testid='version-1']").exists()).toBe(false);
    await w.find("[data-testid='thread-earlier']").trigger("click");
    expect(w.find("[data-testid='version-1']").exists()).toBe(true);
  });
});

describe("RuleChips", () => {
  async function openRules(props) {
    const w = mount(RuleChips, { props, global: { stubs } });
    await w.find("[data-testid='rules-toggle']").trigger("click");
    return w;
  }

  it("folds the rules behind Rules (n); adds and removes them as a new list", async () => {
    const w = mount(RuleChips, { props: { rules: ["No prices"] }, global: { stubs } });
    expect(w.find("[data-testid='rule-No prices']").exists()).toBe(false);
    await w.find("[data-testid='rules-toggle']").trigger("click");
    await w.find("[data-testid='rule-new']").trigger("click");
    await w.find("input").setValue("Use 'you'");
    await w.find("[data-testid='rule-add']").trigger("click");
    expect(w.emitted("change")[0][0]).toEqual(["No prices", "Use 'you'"]);
    await w.find("[data-testid='rule-No prices'] button[aria-label]").trigger("click");
    expect(w.emitted("change")[1][0]).toEqual([]);
  });

  it("keeps a rule for the template only when the task came from one", async () => {
    const worker = await openRules({ rules: ["r"], hasWorker: true });
    expect(worker.findComponent({ name: "BasicMenu" }).props("items").map((i) => i.key)).toEqual(["worker"]);
    const both = await openRules({ rules: ["r"], hasWorker: true, hasTemplate: true });
    both.findComponent({ name: "BasicMenu" }).vm.$emit("select", { key: "template" });
    expect(both.emitted("promote")[0][0]).toEqual({ rule: "r", target: "template" });
  });

  it("says why a rule is refused", async () => {
    const w = await openRules({});
    await w.find("[data-testid='rule-new']").trigger("click");
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
