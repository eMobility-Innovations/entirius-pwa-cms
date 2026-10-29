// @vitest-environment node
// Node, not happy-dom: the codemods resolve their files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyEdits } from "../../../scripts/codemods/p3-lib.mjs";
import { transform } from "../../../scripts/codemods/p3-selects.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/p3-selects/${name}`, import.meta.url), "utf8");
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;
const run = (text) => applyEdits(text, transform(text).edits);

describe("p3-selects codemod", () => {
  const input = fixture("input.vue");
  const { edits, flags } = transform(input);
  const output = applyEdits(input, edits);

  it("moves every Dropdown form to BasicSelect; flagged tags and every other byte stay", () => {
    expect(output).toBe(fixture("expected.vue"));
  });

  it("flags what it cannot decide: handlers that do more, non-values, props BasicSelect lacks, unknown attributes", () => {
    expect(flags.map((flag) => [lineOf(input, flag.offset), flag.message])).toEqual([
      [15, "@onSelect does more than assign the :selected value: by hand"],
      [16, "@onSelect does more than assign the :selected value: by hand"],
      [18, '"recommendationFilter || ALL_OPTION" cannot take a v-model: by hand'],
      [19, ':selected="[]" is not one value: by hand'],
      [20, '":custom_droplist" is not on BasicSelect: by hand'],
      [23, 'unknown attribute ":tooltip" on <Dropdown>: by hand'],
    ]);
  });

  it("is idempotent: a second run rewrites nothing and keeps the flags", () => {
    const again = transform(output);
    expect(again.edits).toEqual([]);
    expect(again.flags).toHaveLength(flags.length);
  });

  it("reads script-setup handlers: a function or arrow that assigns the ref's .value keeps its name", () => {
    const setup = [
      '<template><Dropdown :values="o" :selected="[picked]" @onSelect="onPick" /></template>',
      "<script setup>",
      "const onPick = (v) => {",
      "  picked.value = v;",
      "};",
      "</script>",
    ].join("\n");
    expect(run(setup).split("\n")[0]).toBe(
      '<template><BasicSelect :options="o" v-model="picked" @update:model-value="onPick" /></template>'
    );
    const declared = setup.replace("const onPick = (v) => {", "function onPick(v) {").replace("};", "}");
    expect(run(declared).split("\n")[0]).toContain('v-model="picked" @update:model-value="onPick"');
  });

  it("flags every Dropdown of a file whose options carry label_ext* (extension actions)", () => {
    const text = [
      '<template><Dropdown :values="o" :selected="[x]" @onSelect="(v) => (x = v)" /></template>',
      "<script>const o = [{ label: 'a', value: 1, label_ext: 'Edytuj' }];</script>",
    ].join("\n");
    const result = transform(text);
    expect(result.edits).toEqual([]);
    expect(result.flags.map((flag) => flag.message)).toEqual([
      "the file's options carry label_ext*: extension actions by hand",
    ]);
  });

  it("reads `.value` as a ref only in script setup: an options-API object property is no model", () => {
    const text = [
      '<template><Dropdown :values="o" :selected="[filter]" @onSelect="onPick" /></template>',
      "<script>export default { methods: { onPick(v) { this.filter.value = v; } } };</script>",
    ].join("\n");
    expect(transform(text).flags.map((flag) => flag.message)).toEqual([
      "@onSelect does more than assign the :selected value: by hand",
    ]);
  });

  it("flags a Dropdown without :selected", () => {
    const result = transform('<template><Dropdown :values="o" @onSelect="(v) => (x = v)" /></template>');
    expect(result.flags.map((flag) => flag.message)).toEqual(["no :selected: the model binding by hand"]);
  });
});
