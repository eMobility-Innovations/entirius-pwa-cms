// @vitest-environment node
// Node, not happy-dom: the codemods resolve their files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyEdits } from "../../../scripts/codemods/p3-lib.mjs";
import { classify, transform } from "../../../scripts/codemods/p3-actions.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/p3-actions/${name}`, import.meta.url), "utf8");
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

describe("p3-actions codemod", () => {
  const input = fixture("input.vue");
  const { edits, flags } = transform(input, "input.vue");
  const output = applyEdits(input, edits);

  it("rewrites every combo, text, isDisabled, icon-only and buttonClass; every other byte stays", () => {
    expect(output).toBe(fixture("expected.vue"));
  });

  it("flags what it cannot decide, one flag per call site", () => {
    const markup = "`text` can be false (icon-only then) or holds markup: by hand";
    expect(flags.map((flag) => [lineOf(input, flag.offset), flag.message])).toEqual([
      [42, "drop the ToolTip wrapper: the label is the tooltip"],
      [52, "dark toggle (bg-inverse): IconButton `pressed` by hand"],
      [53, 'one-off colours "bg-warning-fill t-on-status-fill": pick the variant by hand'],
      [54, "a colour in :class: pick the variant by hand"],
      [55, markup],
      [56, "icon-only without a label: name it by hand"],
      [57, "icon-only without one FontAwesomeIcon in its slot: IconButton by hand"],
      [58, '"grip" is menu or reorder: pick the meaning by hand'],
      [59, 'legacy font glyph "close-mini": pick a meaning by hand'],
      [60, '"danger-solid" has no IconButton variant: by hand'],
      [61, markup],
      [62, markup],
      [63, markup],
      [76, 'buttonClass: one-off colours "bg-warning-subtle t-warning": pick the variant by hand'],
    ]);
  });

  it("is idempotent: a second run rewrites nothing and keeps every flag but the converted ToolTip one", () => {
    const again = transform(output, "expected.vue");
    const messages = (list) => list.map((flag) => flag.message).filter((m) => !m.includes("ToolTip wrapper"));
    expect(again.edits).toEqual([]);
    expect(again.flags.map((flag) => flag.message)).toEqual(messages(flags));
  });

  it("leaves a button on the new API alone, its meaning icon included", () => {
    const tag = '<template><BasicButton variant="secondary" icon="saveDraft">Zapisz szkic</BasicButton></template>';
    expect(transform(tag, "new.vue")).toEqual({ edits: [], flags: [] });
  });

  it("maps r02 §3.1 combos to variants", () => {
    const variantOf = (classes) => classify(classes.split(" ")).variant;
    expect(variantOf("bg-raised t-muted")).toBe("secondary");
    expect(variantOf("bg-accent-fill t-on-accent-fill")).toBe("primary");
    expect(variantOf("bg-negative-subtle t-negative")).toBe("danger");
    expect(variantOf("rounded fs-200")).toBe("ghost");
    expect(classify(["t-secondary"]).flag).toMatch(/one-off/);
    expect(classify(["btn-primary", "btn-danger"]).flag).toMatch(/one-off/);
  });

  it("counts the legacy colour classes that survived P2 as colours (plan-11 review)", () => {
    expect(classify(["txt-gray-700"]).flag).toBe('one-off colours "txt-gray-700": pick the variant by hand');
    expect(classify(["bg-gray-200", "txt-basic-600"]).flag).toMatch(/one-off/);
    expect(classify(["bg-accent-fill", "txt-gray-500"]).flag).toMatch(/one-off/);
    expect(classify(["txt-center", "bg-raised"]).variant).toBe("secondary");
    expect(transform('<template><BasicButton :text="t" :class="w ? \'txt-right\' : \'\'" /></template>', "a.vue").flags).toEqual([]);
    const bound = '<template><BasicButton :text="t" :class="on ? \'txt-gray-700\' : \'\'" /></template>';
    expect(transform(bound, "legacy.vue").flags.map((flag) => flag.message)).toEqual([
      "a colour in :class: pick the variant by hand",
    ]);
  });
});
