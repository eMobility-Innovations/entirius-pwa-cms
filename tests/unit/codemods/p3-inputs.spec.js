// @vitest-environment node
// Node, not happy-dom: the codemods resolve their files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyEdits } from "../../../scripts/codemods/p3-lib.mjs";
import { transform } from "../../../scripts/codemods/p3-inputs.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/p3-inputs/${name}`, import.meta.url), "utf8");
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

describe("p3-inputs codemod", () => {
  const input = fixture("input.vue");
  const { edits, flags } = transform(input);
  const output = applyEdits(input, edits);

  it("rewrites the retired tags, the disabled spellings and floating labels; every other byte stays", () => {
    expect(output).toBe(fixture("expected.vue"));
  });

  it("flags what it cannot decide, one flag per call site", () => {
    expect(flags.map((flag) => [lineOf(input, flag.offset), flag.message])).toEqual([
      [17, '@onSelect="onToggleDefault": v-model or @update:model-value by hand'],
      [18, '@onSelect="form.noindex = !form.noindex": v-model or @update:model-value by hand'],
      [19, 'unknown attribute ":tooltip" on <Switcher>: by hand'],
      [26, "validate: the message goes to FormField `error` by hand"],
      [26, 'unknown attribute ":value" on <TextAreaBasic>: by hand'],
      [26, 'unknown attribute "@input" on <TextAreaBasic>: by hand'],
      [40, "two disabled spellings: merge by hand"],
      [41, "validate: the message goes to FormField `error` by hand"],
      [42, "BasicCheckbox array API: a boolean v-model per checkbox (or BasicRadioGroup) by hand"],
      [63, "a label inside a FormField without one: move it to the field by hand"],
      [66, "an id on a control in a labelled FormField: move it to the field (its label points there)"],
    ]);
  });

  it("is idempotent: a second run rewrites nothing and keeps every flag", () => {
    const again = transform(output);
    expect(again.edits).toEqual([]);
    const messages = flags.map((flag) => flag.message.replace("<Switcher>", "<BasicSwitch>"));
    const renamed = (message) => message.replace("<TextAreaBasic>", "<BasicTextarea>");
    expect(again.flags.map((flag) => flag.message)).toEqual(messages.map(renamed));
  });

  it("leaves the new API alone", () => {
    const tags =
      '<template><BasicSwitch v-model="a" /><BasicTextarea v-model="b" /><BasicInput v-model="c" /></template>';
    expect(transform(tags)).toEqual({ edits: [], flags: [] });
  });
});
