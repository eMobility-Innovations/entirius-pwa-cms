#!/usr/bin/env node
// P3 icons codemod (plan 10, docs/ui-rules.md R6): a glyph name on <FontAwesomeIcon> becomes the meaning it stands for,
//   icon="pen"                         → :icon="$icons.edit"
//   :icon="open ? 'chevron-up' : 'x'"  → :icon="open ? $icons.collapse : $icons.close"
// Meanings come from src/boots/Icons/icons.js; synonyms fold into one meaning (`pencil`, `pen-to-square` → edit).
// Flagged, never guessed: a glyph that stands for two meanings today (`grip`: menu or reorder, `upload`: publish or
// a file upload) and a name no meaning covers. The sweeps (plans 17, 18) run it per partition and resolve the flags.
// CLI: see p3-lib.mjs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, attributeName, parseScript, parseSfc, runCodemod, walkTemplate } from "./p3-lib.mjs";

const ICON_ELEMENTS = /^(FontAwesomeIcon|font-awesome-icon)$/;
const SYNONYMS = {
  pencil: "edit",
  "pen-to-square": "edit",
  trash: "delete",
  backward: "back",
  search: "search",
  "arrows-rotate": "refresh",
  "info-circle": "info",
  "play-circle": "play",
  "circle-play": "play",
  "check-square": "checkboxOn",
  "caret-down": "expand",
};
const AMBIGUOUS = { grip: ["menu", "reorder"], upload: ["publish", "upload"] };

// { meaning: glyph } read from the frozen object literal of icons.js (the codemod runs without a bundler).
export function readIcons(source = readFileSync(join(ROOT, "src/boots/Icons/icons.js"), "utf8")) {
  const exported = parseScript(source).body.find((node) => node.declaration?.declarations?.[0].id.name === "ICONS");
  const literal = exported.declaration.declarations[0].init.arguments[0];
  return Object.fromEntries(literal.properties.map((prop) => [prop.key.name, prop.value.value]));
}

// → { meaning } or { flag } for a glyph name ("fa-solid fa-pen" counts as "pen").
export function meaningOf(name, icons) {
  const glyph = name.trim().replace(/^(fa-solid|fas)\s+fa-/, "");
  if (AMBIGUOUS[glyph]) return { flag: `"${glyph}" is ${AMBIGUOUS[glyph].join(" or ")}: pick the meaning by hand` };
  const meaning = SYNONYMS[glyph] ?? Object.keys(icons).find((key) => icons[key] === glyph);
  return meaning ? { meaning } : { flag: `"${glyph}" has no meaning in icons.js: ask plan 19 for one` };
}

function staticIcon(attr, icons) {
  const { meaning, flag } = meaningOf(attr.value?.value ?? "", icons);
  if (flag) return { flags: [{ offset: attr.range[0], message: flag }] };
  const [start, end] = attr.range;
  return { edits: [{ start, end, text: `:icon="$icons.${meaning}"` }] };
}

// The string literals an `:icon` expression can evaluate to: the expression itself, the branches of a ternary, the
// operands of `||` / `??`. A literal in a condition or a call argument (`mode === 'trash'`) is not a glyph.
function valueLiterals(node) {
  if (node?.type === "Literal") return typeof node.value === "string" ? [node] : [];
  if (node?.type === "ConditionalExpression") return [node.consequent, node.alternate].flatMap(valueLiterals);
  if (node?.type === "LogicalExpression") return [node.left, node.right].flatMap(valueLiterals);
  return [];
}

function boundIcon(attr, icons) {
  const result = { edits: [], flags: [] };
  for (const literal of valueLiterals(attr.value.expression)) {
    const { meaning, flag } = meaningOf(literal.value, icons);
    if (flag) result.flags.push({ offset: literal.range[0], message: flag });
    else result.edits.push({ start: literal.range[0], end: literal.range[1], text: `$icons.${meaning}` });
  }
  return result;
}

export function transform(text, _file, icons = readIcons()) {
  const edits = [];
  const flags = [];
  walkTemplate(parseSfc(text), (node) => {
    if (node.type !== "VElement" || !ICON_ELEMENTS.test(node.rawName)) return;
    for (const attr of node.startTag.attributes.filter((a) => attributeName(a) === "icon" && a.value)) {
      const result = attr.directive ? boundIcon(attr, icons) : staticIcon(attr, icons);
      edits.push(...(result.edits ?? []));
      flags.push(...(result.flags ?? []));
    }
  });
  return { edits, flags };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const icons = readIcons();
  runCodemod("p3-icons", (text, file) => transform(text, file, icons));
}
