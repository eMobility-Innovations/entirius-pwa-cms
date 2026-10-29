#!/usr/bin/env node
// P3 display codemod (plan 13, docs/ui-components.md § P3 display): the global `.chip` becomes a StatusBadge, the
// retired components/Loading.vue becomes a Loader overlay.
//   <span v-if="dirty" class="chip bg-warning-subtle t-warning ml-2">{{ $t("unsaved") }}</span>
//     → <StatusBadge v-if="dirty" tone="warning" :dot="false" :label="$t('unsaved')" class="ml-2" />
//   `chip--sm` → size="sm", `chip--pill` dropped (the badge is a pill), a `.chip__label` child is unwrapped, a
//   `title` equal to the label is dropped (StatusBadge sets it).
//   <Loading :isHandy="true" v-if="busy" /> → <Loader overlay contained v-if="busy" />, its import and its
//   `components` entries removed (only those: `components: { Loading, Other }` keeps Other). Every tag the file
//   registers from Loading.vue is it (`<loading>`, an alias); Loading.vue used in the script too → the tags are
//   flagged and nothing is rewritten.
// Tone from the P2 colour classes: the fill or text colour of a status names it, `bg-raised` is neutral, the text
// colour that comes with a fill goes with it; no colour = neutral. `:dot="false"` keeps the chip's dotless look.
// Flagged, never guessed: a `:class` binding, a click handler, one-off colours, two tones, content that is not one text
// or one interpolation, text with markup. The sweeps (plans 17, 18) run it per partition. CLI: see p3-lib.mjs.
import { pathToFileURL } from "node:url";
import vueParser from "vue-eslint-parser";
import {
  collector,
  componentsObject,
  contentChildren,
  findAttr,
  lineIndent,
  normalName,
  parseSfc,
  removeProperties,
  runCodemod,
  sourceOf,
  staticClasses,
  walkTemplate,
} from "./p3-lib.mjs";

const TONE_OF_CLASS = {
  "bg-positive-subtle": "positive",
  "t-positive": "positive",
  "bg-negative-subtle": "negative",
  "t-negative": "negative",
  "bg-warning-subtle": "warning",
  "t-warning": "warning",
  "bg-info-subtle": "info",
  "t-info": "info",
  "bg-accent-subtle": "accent",
  "t-accent": "accent",
  "bg-raised": "neutral",
};
// Text colours that come with a fill: they go with it; alone they are a one-off.
const COMPANIONS = new Set(["t-strong", "t-body", "t-secondary", "t-muted"]);
const COLOUR_CLASS = /^(t|bg|b)-(?!inherit$)[a-z][a-z-]*$/;
const CHIP_CLASSES = new Set(["chip", "chip--sm", "chip--pill"]);
const ESCAPED = /[<>&{}"]/;
const STRUCTURAL = /^(v-(if|else-if|else|for|show)\b|:key=)/;
const LOADING_IMPORT = /(^|\/)Loading(\.vue)?$/;

// → { colour, tone } or { colour, flag } for the classes of one chip.
export function classify(classes) {
  const colour = classes.filter((name) => COLOUR_CLASS.test(name));
  const tones = new Set(colour.map((name) => TONE_OF_CLASS[name]).filter(Boolean));
  const unknown = colour.some((name) => !TONE_OF_CLASS[name] && !COMPANIONS.has(name));
  if (unknown || tones.size > 1 || (!tones.size && colour.length)) {
    return { colour, flag: `one-off colours "${colour.join(" ")}": pick the tone by hand` };
  }
  return { colour, tone: [...tones][0] ?? "neutral" };
}

// --- template helpers -------------------------------------------------------------------------------------------

// Renders a new tag in the layout of the old one: one line, or one attribute per line.
function renderTag(text, node, name, attributes) {
  const multiline = sourceOf(text, node.startTag).includes("\n");
  const indent = lineIndent(text, node.range[0]);
  const [separator, close] = multiline ? [`\n${indent}  `, `\n${indent}/>`] : [" ", " />"];
  const ordered = [...attributes.filter((a) => STRUCTURAL.test(a)), ...attributes.filter((a) => !STRUCTURAL.test(a))];
  return `<${name}${separator}${ordered.join(separator)}${close}`;
}

// --- .chip → StatusBadge ----------------------------------------------------------------------------------------

// → { label: 'label="…"' | ':label="…"', expression } or { flag } from the chip's content.
function labelOf(text, node) {
  const children = contentChildren(node);
  const only = children.length === 1 ? children[0] : null;
  if (only?.type === "VElement" && staticClasses(only).includes("chip__label")) return labelOf(text, only);
  if (only?.type === "VExpressionContainer" && only.expression) {
    const expression = sourceOf(text, only.expression);
    if (expression.includes('"') && expression.includes("'")) return { flag: "label with both quote kinds: by hand" };
    return { label: `:label="${expression.replace(/"/g, "'")}"`, expression };
  }
  const raw = only?.type === "VText" ? sourceOf(text, only).trim().replace(/\s+/g, " ") : null;
  if (raw && !ESCAPED.test(raw)) return { label: `label="${raw}"`, expression: JSON.stringify(raw) };
  return { flag: "content is not one text or one interpolation: label by hand" };
}

// The title StatusBadge sets itself (equal to the label) goes; any other title stays.
function sameTitle(text, attr, label) {
  if (!attr.directive) return JSON.stringify(attr.value?.value ?? "") === label.expression;
  return attr.value?.expression && sourceOf(text, attr.value.expression) === label.expression;
}

// Every attribute but the static class (rebuilt) and a title equal to the label.
function keptAttributes(text, node, label) {
  return node.startTag.attributes
    .filter((attr) => normalName(attr) !== "class")
    .filter((attr) => !(normalName(attr) === "title" && sameTitle(text, attr, label)))
    .map((attr) => sourceOf(text, attr));
}

function chipEdits(text, node, result) {
  // A bound class picks the colour at run time (a literal or a helper that returns one): never guessed.
  if (findAttr(node, "class", true)) return result.flag(node, "a :class binding can carry the colour: tone by hand");
  if (node.startTag.attributes.some((attr) => attr.directive && attr.key.name.name === "on")) {
    return result.flag(node, "a clickable chip is a control (FilterChip, BasicButton): by hand");
  }
  const classes = staticClasses(node);
  const { colour, tone, flag } = classify(classes);
  if (flag) return result.flag(node, flag);
  const label = labelOf(text, node);
  if (label.flag) return result.flag(node, label.flag);
  const rest = classes.filter((name) => !CHIP_CLASSES.has(name) && !colour.includes(name));
  const own = [`tone="${tone}"`, classes.includes("chip--sm") && 'size="sm"', ':dot="false"', label.label];
  const kept = keptAttributes(text, node, label);
  const attributes = [...own.filter(Boolean), ...kept, rest.length && `class="${rest.join(" ")}"`].filter(Boolean);
  result.edit(node.range[0], node.range[1], renderTag(text, node, "StatusBadge", attributes));
}

// --- Loading → Loader overlay -----------------------------------------------------------------------------------

// `isHandy` (the kit panel's veil) becomes `contained`; a bound value other than a literal stays bound.
function containedAttribute(text, attr) {
  if (!attr.directive) return "contained";
  const expression = attr.value?.expression;
  if (expression?.type === "Literal") return expression.value ? "contained" : null;
  return `:contained="${sourceOf(text, expression)}"`;
}

function loadingEdits(text, node, result) {
  const attributes = node.startTag.attributes.map((attr) =>
    normalName(attr) === "ishandy" ? containedAttribute(text, attr) : sourceOf(text, attr)
  );
  result.edit(node.range[0], node.range[1], renderTag(text, node, "Loader", ["overlay", ...attributes.filter(Boolean)]));
}

const tagKey = (name) => name.toLowerCase().replace(/-/g, "");

const within = (node, outer) => node.range[0] >= outer.range[0] && node.range[1] <= outer.range[1];

// Identifiers named `local` in the script outside the given nodes (the import, its `components` entries).
function otherReferences(ast, local, known) {
  let count = 0;
  vueParser.AST.traverseNodes(ast, {
    enterNode(node) {
      if (node.type === "Identifier" && node.name === local && !known.some((k) => within(node, k))) count += 1;
    },
    leaveNode() {},
  });
  return count;
}

// How the file uses components/Loading.vue: its import, the `components` entries that register it, the tag names that
// render it (normalised: `<loading>`, `<Loading-overlay>` for `LoadingOverlay: Loading`), and whether the script uses
// it anywhere else (then nothing is rewritten, the tags are reported). Without the import only `<Loading>` is it;
// a `Loading` imported from anywhere else is not.
function loadingUse(ast) {
  const imports = ast.body.filter((node) => node.type === "ImportDeclaration");
  const declaration = imports.find((node) => LOADING_IMPORT.test(node.source.value));
  if (!declaration) {
    const shadowed = imports.some((node) => node.specifiers.some((s) => s.local.name === "Loading"));
    return { tags: new Set(shadowed ? [] : ["loading"]), entries: [] };
  }
  const local = declaration.specifiers[0]?.local.name;
  const components = componentsObject(ast);
  const registers = (property) => property.value?.type === "Identifier" && property.value.name === local;
  const entries = (components?.properties ?? []).filter(registers);
  const names = [local, ...entries.map((p) => p.key.name ?? p.key.value)];
  const elsewhere = otherReferences(ast, local, [declaration, ...entries]) > 0;
  return { declaration, components, entries, elsewhere, tags: new Set(names.map(tagKey)) };
}

// The Loading.vue import and its `components` entries, only once every tag of it is rewritten.
function loadingScriptEdits(text, use, result) {
  if (!use.declaration) return;
  const { range } = use.declaration;
  result.edit(range[0], text[range[1]] === "\n" ? range[1] + 1 : range[1], "");
  if (use.entries.length) removeProperties(use.components, new Set(use.entries), result);
}

export function transform(text) {
  const ast = parseSfc(text);
  const result = collector();
  const use = loadingUse(ast);
  walkTemplate(ast, (node) => {
    if (node.type !== "VElement") return;
    if (use.tags.has(tagKey(node.rawName))) {
      if (use.elsewhere) return result.flag(node, "components/Loading.vue is used in the script too: Loader by hand");
      return loadingEdits(text, node, result);
    }
    if (staticClasses(node).includes("chip")) chipEdits(text, node, result);
  });
  if (!use.elsewhere) loadingScriptEdits(text, use, result);
  return { edits: result.edits, flags: result.flags };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCodemod("p3-display", transform);
