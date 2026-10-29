// @vitest-environment node
// Node, not happy-dom: the codemods resolve their files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyEdits } from "../../../scripts/codemods/p3-lib.mjs";
import { classify, transform } from "../../../scripts/codemods/p3-display.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/p3-display/${name}`, import.meta.url), "utf8");
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

describe("p3-display codemod", () => {
  const input = fixture("input.vue");
  const { edits, flags } = transform(input);
  const output = applyEdits(input, edits);

  it("rewrites every chip combo and every Loading, drops the import; every other byte stays", () => {
    expect(output).toBe(fixture("expected.vue"));
  });

  it("flags what it cannot decide, one flag per call site", () => {
    const bound = "a :class binding can carry the colour: tone by hand";
    const content = "content is not one text or one interpolation: label by hand";
    const click = "a clickable chip is a control (FilterChip, BasicButton): by hand";
    expect(flags.map((flag) => [lineOf(input, flag.offset), flag.message])).toEqual([
      [46, bound],
      [47, bound],
      [48, 'one-off colours "bg-accent-fill t-on-accent-fill": pick the tone by hand'],
      [49, 'one-off colours "bg-warning-subtle t-positive": pick the tone by hand'],
      [50, 'one-off colours "t-muted": pick the tone by hand'],
      [51, click],
      [52, content],
      [56, content],
      [57, click],
    ]);
  });

  it("is idempotent: a second run rewrites nothing and keeps every flag", () => {
    const again = transform(output);
    expect(again.edits).toEqual([]);
    expect(again.flags.map((flag) => flag.message)).toEqual(flags.map((flag) => flag.message));
  });

  it("leaves the new components alone", () => {
    const tag = '<template><StatusBadge tone="accent" label="PL" /><Loader overlay v-if="x" /></template>';
    expect(transform(tag)).toEqual({ edits: [], flags: [] });
  });

  describe("Loading: template and script decided together", () => {
    const run = (source) => {
      const { edits, flags } = transform(source);
      return { output: applyEdits(source, edits), flags: flags.map((flag) => flag.message) };
    };
    const sfc = (template, script) => `<template>\n  <div>\n${template}\n  </div>\n</template>\n\n<script>\n${script}\n</script>\n`;

    it("a one-line registration loses only Loading", () => {
      const source = sfc(
        '    <loading v-if="busy" />',
        'import Loading from "@/components/Loading.vue";\nimport Other from "./Other.vue";\n\nexport default {\n  components: { Loading, Other },\n};'
      );
      expect(run(source)).toEqual({
        output: sfc(
          '    <Loader v-if="busy" overlay />',
          'import Other from "./Other.vue";\n\nexport default {\n  components: { Other },\n};'
        ),
        flags: [],
      });
    });

    it("an alias is followed into the template: every tag registered from Loading.vue is rewritten", () => {
      const source = sfc(
        '    <Loading-overlay v-if="busy" />\n    <spinner v-show="saving" />',
        'import Spinner from "../../components/Loading";\n\nexport default {\n  components: { Other, LoadingOverlay: Spinner, Spinner },\n};'
      );
      expect(run(source)).toEqual({
        output: sfc(
          '    <Loader v-if="busy" overlay />\n    <Loader v-show="saving" overlay />',
          '\nexport default {\n  components: { Other },\n};'
        ),
        flags: [],
      });
    });

    it("Loading used in the script too: the tags are reported, nothing is half-done", () => {
      const source = sfc(
        '    <Loading v-if="busy" />',
        'import Loading from "@/components/Loading.vue";\n\nexport default {\n  components: { Loading },\n  data: () => ({ spinner: Loading }),\n};'
      );
      expect(run(source)).toEqual({
        output: source,
        flags: ["components/Loading.vue is used in the script too: Loader by hand"],
      });
    });

    it("a Loading imported from elsewhere is not the retired component", () => {
      const source = sfc('    <Loading v-if="busy" />', 'import Loading from "./MyLoading.vue";\n\nexport default { components: { Loading } };');
      expect(transform(source)).toEqual({ edits: [], flags: [] });
    });
  });

  it("maps the P2 colour classes to tones", () => {
    const toneOf = (classes) => classify(classes.split(" ")).tone;
    expect(toneOf("chip bg-warning-subtle t-warning")).toBe("warning");
    expect(toneOf("chip chip--sm bg-accent-subtle t-strong")).toBe("accent");
    expect(toneOf("chip t-accent fs-200")).toBe("accent");
    expect(toneOf("chip chip--pill bg-raised t-secondary")).toBe("neutral");
    expect(toneOf("chip bg-raised t-muted")).toBe("neutral");
    expect(toneOf("chip")).toBe("neutral");
    expect(classify(["t-strong"]).flag).toMatch(/one-off/);
    expect(classify(["bg-positive-subtle", "t-negative"]).flag).toMatch(/one-off/);
  });
});
