// @vitest-environment node
// Node, not happy-dom: the codemods resolve their files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ICONS } from "@/boots/Icons/icons";
import { applyEdits } from "../../../scripts/codemods/p3-lib.mjs";
import { readIcons, transform } from "../../../scripts/codemods/p3-icons.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/p3-icons/${name}`, import.meta.url), "utf8");

describe("p3-icons codemod", () => {
  const input = fixture("input.vue");
  const { edits, flags } = transform(input, "input.vue");

  it("rewrites glyph names to meanings and leaves every other byte alone", () => {
    expect(applyEdits(input, edits)).toBe(fixture("expected.vue"));
  });

  it("flags ambiguous and unknown glyphs instead of guessing", () => {
    expect(flags.map((flag) => flag.message)).toEqual([
      '"grip" is menu or reorder: pick the meaning by hand',
      '"upload" is publish or upload: pick the meaning by hand',
      '"rocket" has no meaning in icons.js: ask plan 19 for one',
    ]);
  });

  it("reads the registry the app uses", () => {
    expect(readIcons()).toEqual({ ...ICONS });
  });
});
