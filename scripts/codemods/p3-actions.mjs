#!/usr/bin/env node
// P3 actions codemod (plan 11, docs/ui-rules.md C6): every BasicButton names its role with `variant`, never with
// colour classes, and every icon-only action becomes an IconButton.
//   class="btn-primary ml-2" :text="$t('x')" :isDisabled="busy" icon="plus"
//     → variant="primary" class="ml-2" :disabled="busy", label {{ $t('x') }} in the default slot, icon dropped
//   custom :label="$t('y')" class="btn-danger" + #custom <FontAwesomeIcon :icon="$icons.delete" />
//     → <IconButton icon="delete" :label="$t('y')" variant="danger" />
//   BulkActionBar actions: buttonClass: "bg-accent-fill t-on-accent-fill" → variant: "primary"
// Colour classes → variant per r02 §3.1 on their P2 names (p2-colour-map.json) plus the polish role classes (btn-*).
// A labelled button loses its icon (icon policy: a Figma screen's text + icon button gets it back in its P5 plan).
// Flagged, never guessed: the dark toggle (bg-inverse: IconButton `pressed` by hand), one-off colours, a colour in a
// `:class` binding, an icon-only button without a label or without one FontAwesomeIcon, a glyph without a meaning.
// The sweeps (plans 17, 18) run it per partition and resolve the flags. CLI: see p3-lib.mjs.
import { pathToFileURL } from "node:url";
import {
  collector,
  contentChildren,
  expressionOf,
  findAttr,
  lineIndent,
  normalName,
  parseSfc,
  removeNode as removeAttr,
  runCodemod,
  sourceOf,
  staticClasses,
  walkTemplate,
} from "./p3-lib.mjs";
import { meaningOf, readIcons } from "./p3-icons.mjs";

const ROLE_OF_CLASS = {
  "btn-primary": "primary",
  "bg-accent-fill": "primary",
  "bg-positive-fill": "primary",
  "btn-secondary": "secondary",
  "btn-outline": "secondary",
  "bg-raised": "secondary",
  "btn-ghost": "ghost",
  "btn-danger": "danger",
  "bg-negative-subtle": "danger",
  "bg-negative-fill": "danger",
  "btn-danger-fill": "danger-solid",
};
// Text and border colours that come with a role's fill: they go with it; alone they are a one-off.
const COMPANIONS = new Set([
  ...["t-on-accent-fill", "t-on-status-fill", "b-accent", "b-negative", "t-negative"],
  ...["t-secondary", "t-muted", "t-body"],
]);
// Legacy colour classes that survived P2 (`txt-gray-700`, `txt-basic-600`, `bg-gray-200`) are colours too.
// `txt-center` / `txt-left` / `txt-right` / `txt-justify` align text: not colours.
const COLOUR_CLASS = /^(btn-[a-z-]+|(t|bg|b)-(?!inherit$)[a-z][a-z0-9-]*|txt-(?!(center|left|right|justify)$)[a-z][a-z0-9-]*)$/;
const COLOUR_IN_EXPRESSION = /(^|[\s'"`{])((btn|bg|t|b)-[a-z]|txt-(?!(center|left|right|justify)\b)[a-z])/;
const ICON_BUTTON_VARIANT = { ghost: null, secondary: "outline", primary: "primary", danger: "danger" };
const ICON_ELEMENT = /^(FontAwesomeIcon|font-awesome-icon)$/;
const LABEL_ATTRIBUTES = ["label", "arialabel", "title"];
// Static text Vue decoded from entities (or that reads as markup) cannot move into a slot as it is.
const ESCAPED = /[<>&{}]/;
// Directives that stay first on the tag (v-if, v-for, :key).
const STRUCTURAL = /^(v-(if|else-if|else|for)\b|:key=)/;
// Attributes an IconButton does not take over as they are.
const REPLACED_ON_ICON_BUTTON = new Set(["custom", "icon", "text", ...LABEL_ATTRIBUTES]);

// → { colour, variant } or { colour, flag } for the classes of one tag (or of one buttonClass string).
export function classify(classes) {
  const colour = classes.filter((name) => COLOUR_CLASS.test(name));
  if (colour.includes("bg-inverse")) return { colour, flag: "dark toggle (bg-inverse): IconButton `pressed` by hand" };
  const roles = new Set(colour.map((name) => ROLE_OF_CLASS[name]).filter(Boolean));
  const unknown = colour.some((name) => !ROLE_OF_CLASS[name] && !COMPANIONS.has(name));
  if (unknown || roles.size > 1 || (!roles.size && colour.length)) {
    return { colour, flag: `one-off colours "${colour.join(" ")}": pick the variant by hand` };
  }
  return { colour, variant: [...roles][0] ?? "ghost" };
}

// A colour picked in a `:class` binding (active states) cannot become a static variant.
function dynamicColour(text, node) {
  const bound = findAttr(node, "class", true);
  return bound?.value && COLOUR_IN_EXPRESSION.test(expressionOf(text, bound)) ? bound : null;
}

// --- labelled BasicButton ---------------------------------------------------------------------------------------

function variantEdits(text, node, result) {
  if (findAttr(node, "variant")) return;
  const bound = dynamicColour(text, node);
  if (bound) return result.flag(bound, "a colour in :class: pick the variant by hand");
  const staticClass = findAttr(node, "class", false);
  const { colour, variant, flag } = classify(staticClasses(node));
  if (flag) return result.flag(staticClass, flag);
  const rest = staticClasses(node).filter((name) => !colour.includes(name));
  const multiline = staticClass && sourceOf(text, node.startTag).includes("\n");
  const separator = multiline ? `\n${lineIndent(text, staticClass.range[0])}` : " ";
  const replacement = `variant="${variant}"${rest.length ? `${separator}class="${rest.join(" ")}"` : ""}`;
  if (staticClass) return result.edit(staticClass.range[0], staticClass.range[1], replacement);
  const afterName = node.startTag.range[0] + 1 + node.rawName.length;
  result.edit(afterName, afterName, ` ${replacement}`);
}

function disabledEdits(node, result) {
  const attr = findAttr(node, "isdisabled");
  if (!attr) return;
  const key = attr.directive ? attr.key.argument : attr.key;
  result.edit(key.range[0], key.range[1], "disabled");
}

// The slot text of a `text` / `:text` attribute; null when the binding can be false (then the button is icon-only).
function slotLabel(text, attr) {
  if (!attr.directive) return ESCAPED.test(attr.value?.value ?? "<") ? null : attr.value.value;
  const node = attr.value?.expression;
  return node && !mayBeFalse(node) ? `{{ ${expressionOf(text, attr)} }}` : null;
}

// True when a `:text` expression can evaluate to a falsy literal (`false`, `""`) or `cond && x`.
function mayBeFalse(node) {
  if (node.type === "Literal") return typeof node.value !== "string" || !node.value;
  if (node.type === "ConditionalExpression") return mayBeFalse(node.consequent) || mayBeFalse(node.alternate);
  if (node.type === "LogicalExpression") return node.operator === "&&" || mayBeFalse(node.right);
  return false;
}

// Puts `label` into the default slot: a self-closing tag gets a body and an end tag.
function fillSlot(text, node, label, result) {
  const tag = node.startTag;
  const multiline = sourceOf(text, tag).includes("\n");
  const indent = lineIndent(text, node.range[0]);
  const body = multiline ? `\n${indent}  ${label}\n${indent}` : label;
  if (!tag.selfClosing) return result.edit(tag.range[1], tag.range[1], body);
  const from = tag.attributes.at(-1)?.range[1] ?? tag.range[0] + 1 + node.rawName.length;
  result.edit(from, tag.range[1], `${multiline ? `\n${indent}` : ""}>${body}</${node.rawName}>`);
}

// `text` → default slot; false (and a flag) when that cannot be done safely.
function labelEdits(text, node, attr, result) {
  const label = slotLabel(text, attr);
  const busySlot = contentChildren(node).length || findAttr(node, "custom");
  const problem = label === null ? "`text` can be false (icon-only then) or holds markup: by hand" : null;
  if (problem || busySlot) {
    result.flag(attr, problem ?? "`text` next to slot content: by hand");
    return false;
  }
  removeAttr(text, attr, result);
  fillSlot(text, node, label, result);
  return true;
}

// A tag that already has `variant` is on the new API: its meaning icon stays. Removals go in before the `variant`
// insertion, so the two share a start offset in that order (applyEdits sorts stably).
function labelledEdits(text, node, result) {
  const icon = findAttr(node, "icon");
  if (icon && !findAttr(node, "variant")) removeAttr(text, icon, result);
  variantEdits(text, node, result);
  disabledEdits(node, result);
}

// --- icon-only BasicButton → IconButton -------------------------------------------------------------------------

// → { meaning } or { flag } for a glyph named by a FontAwesomeIcon (static, `$icons.x` or a string literal).
function iconOfElement(text, element, icons) {
  const attr = findAttr(element, "icon");
  if (!attr?.directive) return meaningOf(attr?.value?.value ?? "", icons);
  const expression = attr.value?.expression;
  if (expression?.type === "Literal" && typeof expression.value === "string") return meaningOf(expression.value, icons);
  const meaning = expressionOf(text, attr).match(/^\$icons\.(\w+)$/)?.[1];
  return meaning ? { meaning } : { flag: "a computed icon: IconButton by hand" };
}

// → { meaning } or { flag }: the icon of the `custom` slot, or a legacy `icon` value that is a meaning key.
function iconOf(text, node, icons) {
  const legacy = findAttr(node, "icon");
  if (legacy) {
    const value = legacy.directive ? legacy.value?.expression?.value : legacy.value?.value;
    if (Object.hasOwn(icons, value ?? "")) return { meaning: value };
    return { flag: `legacy font glyph "${value ?? "?"}": pick a meaning by hand` };
  }
  const slot = contentChildren(node).find((c) => c.type === "VElement" && c.rawName === "template");
  const glyphs = slot ? contentChildren(slot) : [];
  if (glyphs.length !== 1 || !ICON_ELEMENT.test(glyphs[0].rawName ?? "")) {
    return { flag: "icon-only without one FontAwesomeIcon in its slot: IconButton by hand" };
  }
  return iconOfElement(text, glyphs[0], icons);
}

// → `label="…"` / `:label="…"` from label, aria-label, title or a wrapping ToolTip; null when there is none.
function labelOf(text, node) {
  const attr = LABEL_ATTRIBUTES.map((name) => findAttr(node, name)).find(Boolean);
  const parent = node.parent;
  const tip = parent?.type === "VElement" && parent.rawName === "ToolTip" ? findAttr(parent, "tip") : null;
  const from = attr ?? tip;
  if (!from?.value) return null;
  return from.directive ? `:label="${expressionOf(text, from)}"` : `label="${from.value.value}"`;
}

function iconButtonVariant(text, node) {
  const bound = dynamicColour(text, node);
  if (bound) return { flag: "a colour in :class (toggle?): IconButton `pressed` by hand" };
  const { colour, variant, flag } = classify(staticClasses(node));
  if (flag) return { flag };
  if (ICON_BUTTON_VARIANT[variant] === undefined) return { flag: `"${variant}" has no IconButton variant: by hand` };
  return { colour, variant: ICON_BUTTON_VARIANT[variant] };
}

// The attributes an IconButton keeps: everything but label/icon/text/custom, colour classes out, isDisabled renamed.
function keptAttributes(text, node, colour) {
  return node.startTag.attributes.flatMap((attr) => {
    const name = normalName(attr);
    if (REPLACED_ON_ICON_BUTTON.has(name)) return [];
    if (name === "isdisabled") return [attr.directive ? `:disabled="${expressionOf(text, attr)}"` : "disabled"];
    if (name !== "class" || attr.directive) return [sourceOf(text, attr)];
    const rest = (attr.value?.value ?? "").split(/\s+/).filter((c) => c && !colour.includes(c));
    return rest.length ? [`class="${rest.join(" ")}"`] : [];
  });
}

function iconButtonEdits(text, node, result, icons) {
  const icon = iconOf(text, node, icons);
  if (icon.flag) return result.flag(node, icon.flag);
  const label = labelOf(text, node);
  if (!label) return result.flag(node, "icon-only without a label: name it by hand");
  const wrapper = node.parent?.rawName === "ToolTip" ? node.parent : null;
  if (wrapper) result.flag(wrapper, "drop the ToolTip wrapper: the label is the tooltip");
  const { colour, variant, flag } = iconButtonVariant(text, node);
  if (flag) return result.flag(node, flag);
  const kept = keptAttributes(text, node, colour);
  const structural = kept.filter((attr) => STRUCTURAL.test(attr));
  const own = [`icon="${icon.meaning}"`, label, variant && `variant="${variant}"`].filter(Boolean);
  const attributes = [...structural, ...own, ...kept.filter((attr) => !STRUCTURAL.test(attr))];
  const multiline = sourceOf(text, node.startTag).includes("\n");
  const indent = lineIndent(text, node.range[0]);
  const [separator, close] = multiline ? [`\n${indent}  `, `\n${indent}/>`] : [" ", " />"];
  result.edit(node.range[0], node.range[1], `<IconButton${separator}${attributes.join(separator)}${close}`);
}

function buttonEdits(text, node, result, icons) {
  const textAttr = findAttr(node, "text");
  const slotLabelled = contentChildren(node).some((c) => !(c.type === "VElement" && c.rawName === "template"));
  if (!textAttr && !slotLabelled) return iconButtonEdits(text, node, result, icons);
  if (!textAttr || labelEdits(text, node, textAttr, result)) labelledEdits(text, node, result);
}

// --- BulkActionBar actions in the script ------------------------------------------------------------------------

const SKIPPED_KEYS = new Set(["parent", "templateBody", "tokens", "comments", "loc", "range"]);

function walkScript(node, visit) {
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key) || !value || typeof value !== "object") continue;
    const children = Array.isArray(value) ? value : [value];
    children.filter((child) => typeof child?.type === "string").forEach((child) => walkScript(child, visit));
  }
}

function buttonClassEdits(ast, result) {
  walkScript(ast, (node) => {
    if (node.type !== "Property" || (node.key.name ?? node.key.value) !== "buttonClass") return;
    const value = node.value;
    if (value.type !== "Literal" || typeof value.value !== "string") {
      return result.flag(node, "a computed buttonClass: variant by hand");
    }
    const { variant, flag } = classify(value.value.split(/\s+/));
    if (flag) return result.flag(node, `buttonClass: ${flag}`);
    result.edit(node.range[0], node.range[1], `variant: ${value.raw[0]}${variant}${value.raw[0]}`);
  });
}

export function transform(text, _file, icons = readIcons()) {
  const ast = parseSfc(text);
  const result = collector();
  walkTemplate(ast, (node) => {
    if (node.type === "VElement" && node.rawName === "BasicButton") buttonEdits(text, node, result, icons);
  });
  buttonClassEdits(ast, result);
  return { edits: result.edits, flags: result.flags };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const icons = readIcons();
  runCodemod("p3-actions", (text, file) => transform(text, file, icons));
}
