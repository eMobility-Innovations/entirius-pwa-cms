#!/usr/bin/env node
// P3 overlays codemod (plan 12, docs/ui-rules.md C4): confirmations become ConfirmDialog, tooltips BasicTooltip. The
// prop/event map is the one the transition wrappers apply (src/functionals/Confirmation-modal,
// Unsaved-changes-modal; tests/unit/functionals/ConfirmationModal.spec.js pins it):
//   <Confirmation-modal> / <ConfirmationModal> → <ConfirmDialog>: visible → open, destructive → tone="danger",
//     @accept → @confirm, @reject → @cancel, #header → title (a lone <h2>{{ x }}</h2>) or the #title slot,
//     #description → the default slot
//   <UnsavedChangesModal> → <ConfirmDialog> with the unsaved.* title, message and labels: @save → @confirm,
//     @stay → @cancel, @discard stays
//   <ToolTip> → <BasicTooltip>: tip → text, is_wrapper dropped (a wrapper is the default), a standalone hint gets
//     variant="help", the .left / .right alignment classes go (placement flips by itself); <HelpTooltip> →
//     variant="help"; <HoverMe> → <BasicTooltip> (the cursor-following tip is dropped, Q-9)
// Their imports and `components` entries go when no tag of theirs is left. Flagged, never guessed: a custom #footer
// (a BasicModal by hand), a dialog without a title, a computed is_wrapper, an attribute outside the map.
// The sweeps (plans 17, 18) run it per partition and resolve the flags. CLI: see p3-lib.mjs.
import { pathToFileURL } from "node:url";
import {
  addAttributes,
  collector,
  componentsObject,
  contentChildren,
  expressionOf,
  normalName,
  parseSfc,
  removeNode,
  removeProperties,
  renameTag,
  runCodemod,
  sourceOf,
  staticClasses,
  walkTemplate,
} from "./p3-lib.mjs";

const CONFIRM = "confirm";
const UNSAVED = "unsaved";
const TOOLTIP = "tooltip";
const HELP = "help";
const HOVER = "hover";
// Normalised tag (lower case, no dashes) → the component it is.
const KIND_OF_TAG = {
  confirmationmodal: CONFIRM,
  unsavedchangesmodal: UNSAVED,
  tooltip: TOOLTIP,
  helptooltip: HELP,
  hoverme: HOVER,
};
const TARGET = { [CONFIRM]: "ConfirmDialog", [UNSAVED]: "ConfirmDialog" };
// Import paths of the removed components, by kind.
const IMPORT_PATH = {
  [CONFIRM]: /\/Confirmation-modal(\/index\.vue)?$/,
  [UNSAVED]: /\/Unsaved-changes-modal(\/index\.vue)?$/,
  [TOOLTIP]: /\/ToolTip(\/ToolTip\.vue)?$/,
  [HELP]: /\/HelpTooltip(\/index\.vue)?$/,
  [HOVER]: /\/HoverMe(\/index\.vue)?$/,
};
const UNSAVED_PROPS = [
  `:title="$t('unsaved.title')"`,
  `:message="$t('unsaved.message')"`,
  `:confirm-label="$t('unsaved.save_and_leave')"`,
  `:discard-label="$t('unsaved.discard')"`,
];
// Attributes every component takes as they are: identity, styling, test ids (v-if, v-for… pass as directives).
const PASSTHROUGH = /^(key|ref|class|style|id|data[a-z]+)$/;
const ALIGNMENT_CLASSES = new Set(["left", "right"]);
const ESCAPED = /["<>&{}]/;

const kindOf = (node) => KIND_OF_TAG[node.rawName.toLowerCase().replace(/-/g, "")];
// v-if, v-else, v-for, v-show, v-model…: a directive that is neither a binding nor a listener.
const isStructural = (attr) => attr.directive && !["bind", "on"].includes(attr.key.name.name);
const slotName = (template) =>
  template.startTag.attributes.find((a) => a.directive && a.key.name.name === "slot")?.key.argument?.name;
const slotTemplates = (node) =>
  contentChildren(node).filter((child) => child.type === "VElement" && child.rawName === "template");

// --- attribute edits -------------------------------------------------------------------------------------------

const renameKey = (attr, name, result) => {
  const key = attr.directive ? attr.key.argument : attr.key;
  result.edit(key.range[0], key.range[1], name);
};

// destructive → tone: static or `true` = danger, `false` = gone, anything else a ternary on it.
function toneEdit(text, attr, result) {
  const expression = attr.directive ? attr.value?.expression : null;
  if (!attr.directive || expression?.value === true) return result.edit(...attr.range, 'tone="danger"');
  if (expression?.value === false) return removeNode(text, attr, result);
  result.edit(...attr.range, `:tone="(${expressionOf(text, attr)}) ? 'danger' : 'default'"`);
}

const CONFIRM_ATTRS = {
  visible: (text, attr, result) => renameKey(attr, "open", result),
  destructive: toneEdit,
  accept: (text, attr, result) => renameKey(attr, "confirm", result),
  reject: (text, attr, result) => renameKey(attr, "cancel", result),
};
const UNSAVED_ATTRS = {
  visible: CONFIRM_ATTRS.visible,
  save: (text, attr, result) => renameKey(attr, "confirm", result),
  stay: (text, attr, result) => renameKey(attr, "cancel", result),
  discard: () => {},
};
const TOOLTIP_ATTRS = {
  tip: (text, attr, result) => renameKey(attr, "text", result),
  is_wrapper: (text, attr, result) => removeNode(text, attr, result),
  text: () => {},
};

// Class attribute without the ToolTip alignment classes (.left / .right).
function alignmentEdit(text, node, result) {
  const attr = node.startTag.attributes.find((a) => !a.directive && normalName(a) === "class");
  const classes = staticClasses(node);
  const kept = classes.filter((name) => !ALIGNMENT_CLASSES.has(name));
  if (!attr || kept.length === classes.length) return;
  if (kept.length) result.edit(...attr.range, `class="${kept.join(" ")}"`);
  else removeNode(text, attr, result);
}

// Applies the map to every attribute; one outside it (and outside PASSTHROUGH) is flagged and kept.
function attributeEdits(text, node, map, result) {
  for (const attr of node.startTag.attributes) {
    const name = normalName(attr);
    if (Object.hasOwn(map, name)) map[name](text, attr, result);
    else if (!PASSTHROUGH.test(name) && !isStructural(attr)) {
      result.flag(attr, `unknown attribute "${sourceOf(text, attr.key)}" on <${node.rawName}>: by hand`);
    }
  }
}

// --- tag edits -------------------------------------------------------------------------------------------------

// An expression as an attribute value: its double-quoted strings become single-quoted; null when it has both.
function bindable(expression) {
  if (!expression.includes('"')) return expression;
  return expression.includes("'") ? null : expression.replaceAll('"', "'");
}

// A header that is one plain <h2>/<h3> of text or of one {{ expression }} → the `title` prop; null otherwise.
function titleProp(text, template) {
  const [heading, ...rest] = contentChildren(template);
  if (rest.length || heading?.type !== "VElement" || !/^h[1-4]$/.test(heading.rawName)) return null;
  if (heading.startTag.attributes.length) return null;
  const parts = contentChildren(heading);
  if (parts.length === 1 && parts[0].type === "VExpressionContainer" && parts[0].expression) {
    const expression = bindable(sourceOf(text, parts[0].expression));
    return expression && `:title="${expression}"`;
  }
  const plain = parts.every((part) => part.type === "VText") && parts.map((part) => part.value).join("").trim();
  return plain && !ESCAPED.test(plain) ? `title="${plain}"` : null;
}

// #header → `title` (or the #title slot), #description → the default slot; false when the element is skipped.
function slotEdits(text, node, result) {
  const templates = slotTemplates(node);
  const footer = templates.find((template) => slotName(template) === "footer");
  if (footer) {
    result.flag(footer, "custom #footer: a BasicModal with this footer, by hand");
    return false;
  }
  const header = templates.find((template) => slotName(template) === "header");
  const title = header && titleProp(text, header);
  if (title) {
    removeNode(text, header, result);
    addAttributes(text, node, [title], result);
  } else if (header) {
    renameSlot(header, "title", result);
  } else {
    result.flag(node, "no #header: give the ConfirmDialog a title by hand");
  }
  const description = templates.find((template) => slotName(template) === "description");
  if (description) renameSlot(description, "default", result);
  return true;
}

function renameSlot(template, name, result) {
  const slot = template.startTag.attributes.find((a) => a.directive && a.key.name.name === "slot");
  result.edit(slot.key.argument.range[0], slot.key.argument.range[1], name);
}

function confirmEdits(text, node, result) {
  if (!slotEdits(text, node, result)) return false;
  renameTag(node, TARGET[CONFIRM], result);
  attributeEdits(text, node, CONFIRM_ATTRS, result);
  return true;
}

function unsavedEdits(text, node, result) {
  renameTag(node, TARGET[UNSAVED], result);
  attributeEdits(text, node, UNSAVED_ATTRS, result);
  addAttributes(text, node, UNSAVED_PROPS, result);
  return true;
}

// ToolTip: a wrapper (is_wrapper true) keeps its slot; a standalone hint is the help variant.
function tooltipEdits(text, node, result) {
  const wrapper = node.startTag.attributes.find((a) => normalName(a) === "is_wrapper");
  const expression = wrapper?.directive ? wrapper.value?.expression : null;
  if (expression && expression.type !== "Literal") {
    result.flag(wrapper, "a computed is_wrapper: BasicTooltip by hand");
    return false;
  }
  const isWrapper = Boolean(wrapper) && (!wrapper.directive || expression.value === true);
  renameTag(node, "BasicTooltip", result);
  alignmentEdit(text, node, result);
  attributeEdits(text, node, TOOLTIP_ATTRS, result);
  addAttributes(text, node, isWrapper ? [] : ['variant="help"'], result);
  return true;
}

function helpEdits(text, node, result) {
  renameTag(node, "BasicTooltip", result);
  attributeEdits(text, node, { text: () => {} }, result);
  addAttributes(text, node, ['variant="help"'], result);
  return true;
}

function hoverEdits(text, node, result) {
  renameTag(node, "BasicTooltip", result);
  attributeEdits(text, node, { text: () => {} }, result);
  return true;
}

const EDITS = {
  [CONFIRM]: confirmEdits,
  [UNSAVED]: unsavedEdits,
  [TOOLTIP]: tooltipEdits,
  [HELP]: helpEdits,
  [HOVER]: hoverEdits,
};

// --- imports -----------------------------------------------------------------------------------------------------

// Drops the import of every removed component whose tags are all converted, and its `components` entry.
function importEdits(text, ast, done, result) {
  const components = componentsObject(ast);
  const entries = new Set();
  for (const node of ast.body.filter((n) => n.type === "ImportDeclaration")) {
    const kind = Object.keys(IMPORT_PATH).find((k) => IMPORT_PATH[k].test(node.source.value));
    if (!kind || !done.has(kind)) continue;
    const end = text[node.range[1]] === "\n" ? node.range[1] + 1 : node.range[1];
    result.edit(node.range[0], end, "");
    const local = node.specifiers[0]?.local.name;
    const entry = components?.properties.find((p) => p.value?.name === local);
    if (entry) entries.add(entry);
  }
  if (entries.size) removeProperties(components, entries, result);
}

export function transform(text) {
  const ast = parseSfc(text);
  const result = collector();
  const converted = new Set();
  const skipped = new Set();
  walkTemplate(ast, (node) => {
    const kind = node.type === "VElement" ? kindOf(node) : undefined;
    if (!kind) return;
    (EDITS[kind](text, node, result) ? converted : skipped).add(kind);
  });
  importEdits(text, ast, new Set([...converted].filter((kind) => !skipped.has(kind))), result);
  return { edits: result.edits, flags: result.flags };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCodemod("p3-overlays", transform);
