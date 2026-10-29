// @vitest-environment node
// Node, not happy-dom: the codemods resolve their files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyEdits } from "../../../scripts/codemods/p3-lib.mjs";
import { transform } from "../../../scripts/codemods/p3-overlays.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/p3-overlays/${name}`, import.meta.url), "utf8");
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;
const run = (text) => applyEdits(text, transform(text).edits);

describe("p3-overlays codemod", () => {
  const input = fixture("input.vue");
  const { edits, flags } = transform(input);
  const output = applyEdits(input, edits);

  it("maps every confirmation and tooltip variant; every other byte stays", () => {
    expect(output).toBe(fixture("expected.vue"));
  });

  it("flags what it cannot decide: custom footer, no title, unknown attribute, computed is_wrapper", () => {
    expect(flags.map((flag) => [lineOf(input, flag.offset), flag.message])).toEqual([
      [28, "custom #footer: a BasicModal with this footer, by hand"],
      [30, "no #header: give the ConfirmDialog a title by hand"],
      [30, 'unknown attribute "@close" on <Confirmation-modal>: by hand'],
      [43, "a computed is_wrapper: BasicTooltip by hand"],
    ]);
  });

  it("keeps the import of a component with a tag left (flagged), drops the others with their components entry", () => {
    expect(output).toContain('import ConfirmationModal from "@/functionals/Confirmation-modal/index.vue";');
    expect(output).not.toContain("UnsavedChangesModal");
    expect(output).toContain("components: { draggable, ConfirmationModal },");
  });

  it("is idempotent: a second run rewrites nothing and keeps the flags of the tags it left", () => {
    const again = transform(output);
    expect(again.edits).toEqual([]);
    expect(again.flags.map((flag) => flag.message)).toEqual([
      "custom #footer: a BasicModal with this footer, by hand",
      "a computed is_wrapper: BasicTooltip by hand",
    ]);
  });

  it("drops a script-setup import and a whole components object when every tag moved", () => {
    const setup = [
      "<template><ConfirmationModal :visible=\"v\"><template #header><h2>Usuń</h2></template></ConfirmationModal>",
      "</template>",
      "<script setup>",
      'import ConfirmationModal from "@/functionals/Confirmation-modal/index.vue";',
      'import { ref } from "vue";',
      "</script>",
    ].join("\n");
    expect(run(setup)).toBe(
      [
        '<template><ConfirmDialog :open="v" title="Usuń"></ConfirmDialog>',
        "</template>",
        "<script setup>",
        'import { ref } from "vue";',
        "</script>",
      ].join("\n")
    );
    const options = [
      '<template><HelpTooltip text="?" /><Unsaved-changes-modal :visible="v" /></template>',
      "<script>",
      'import UnsavedChangesModal from "../Unsaved-changes-modal/index.vue";',
      "export default { components: { UnsavedChangesModal } };",
      "</script>",
    ].join("\n");
    expect(run(options)).toContain("export default { components: {} };");
    expect(run(options)).not.toContain("import UnsavedChangesModal");
  });

  it("a header expression with both quote kinds stays a #title slot", () => {
    const tag = `<template><ConfirmationModal><template #header><h2>{{ a ? "x" : 'y' }}</h2></template></ConfirmationModal></template>`;
    expect(run(tag)).toContain("<template #title>");
  });

  it("leaves new components alone", () => {
    const tag = '<template><ConfirmDialog :open="v" title="x" /><BasicTooltip text="y" /></template>';
    expect(transform(tag)).toEqual({ edits: [], flags: [] });
  });
});
