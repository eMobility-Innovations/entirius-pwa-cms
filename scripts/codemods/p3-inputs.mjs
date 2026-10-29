#!/usr/bin/env node
// P3 inputs codemod (plan 16, docs/ui-components.md § P3 inputs): the input family moves onto v-model, `disabled` and
// FormField-owned labels.
//   <Switcher :selected="x" @onSelect="x = !x" /> → <BasicSwitch v-model="x" />; `:selected` without a handler →
//     `:model-value`; `prevent` → `disabled`
//   <TextAreaBasic> → <BasicTextarea>: `limit` → `maxlength`
//   <LockedField> → <BasicInput readonly>
//   `isDisabled` / `is-disabled` / `is_disabled` → `disabled` on BasicInput, NumberInput and the textarea
//   a floating `label` on BasicInput / the textarea → <FormField :label> around the control (with its v-if / v-show /
//     v-for, :key and id); dropped when the control already sits in a FormField with a label
// Flagged, never guessed: any other @onSelect handler (that Switcher stays as it is), `validate` (FormField `error`),
// the BasicCheckbox array API (`values`), the old textarea API (`value`, `type`, `size`, its events), a label on a
// control in a FormField without one, an attribute outside the map. Class and style stay on a wrapped control: they
// may style it (line height, surface), so the sweep moves only the layout ones. The sweeps (plans 17, 18) run it per
// partition and resolve the flags. The three tags are global registrations, so no import changes. CLI: see p3-lib.mjs.
import { pathToFileURL } from "node:url";
import {
  addAttribute,
  applyEdits,
  collector,
  lineIndent,
  normalName,
  parseSfc,
  removeNode,
  renameKey,
  renameTag,
  runCodemod,
  sourceOf,
  walkTemplate,
} from "./p3-lib.mjs";

const SWITCH = "switch";
const TEXTAREA = "textarea";
const NEW_TEXTAREA = "basicTextarea";
const NEW_SWITCH = "basicSwitch";
const LOCKED = "locked";
const INPUT = "input";
const NUMBER = "number";
const CHECKBOX = "checkbox";
// Normalised tag (lower case, no dashes) → the control it is.
const KIND_OF_TAG = {
  switcher: SWITCH,
  basicswitch: NEW_SWITCH,
  textareabasic: TEXTAREA,
  basictextarea: NEW_TEXTAREA,
  lockedfield: LOCKED,
  basicinput: INPUT,
  numberinput: NUMBER,
  basiccheckbox: CHECKBOX,
};
const TARGET = { [SWITCH]: "BasicSwitch", [TEXTAREA]: "BasicTextarea", [LOCKED]: "BasicInput" };
const DISABLED_SPELLINGS = new Set(["isdisabled", "is_disabled"]);
// Attributes that move from a labelled control onto the FormField around it; class and style stay on the control.
const MOVES_TO_FIELD = /^(v-(if|else-if|else|for|show)|key|id)$/;
const STRUCTURAL = /^v-(if|else-if|else|for|show)$/;
const PASSTHROUGH = /^(key|ref|class|style|id|data[a-z_]+)$/;
// Attributes each target takes as they are (normalised names; `@x` is a listener, `v-model` the model).
const KEPT = {
  [SWITCH]: new Set(["label", "hint", "disabled"]),
  [TEXTAREA]: new Set(["v-model", "modelvalue", "@update:modelvalue", "rows", "placeholder", "disabled", "readonly"]),
  [LOCKED]: new Set(["v-model", "modelvalue"]),
  [NEW_SWITCH]: new Set(["v-model", "modelvalue", "@update:modelvalue", "label", "hint", "disabled"]),
  [NEW_TEXTAREA]: new Set([
    ...["v-model", "modelvalue", "@update:modelvalue"],
    ...["rows", "placeholder", "disabled", "readonly", "maxlength"],
  ]),
};

const kindOf = (node) => KIND_OF_TAG[node.rawName.toLowerCase().replace(/-/g, "")];
const isFormField = (node) => node?.type === "VElement" && node.rawName.toLowerCase().replace(/-/g, "") === "formfield";

// The FormField a control sits in, directly or through wrapper elements (`<FormField><div class="flex"><BasicInput>`).
function enclosingFormField(node) {
  for (let parent = node.parent; parent; parent = parent.parent) if (isFormField(parent)) return parent;
  return null;
}

// One name per attribute: `v-if`, `v-model`, `@onselect`, `selected` (bound or static alike).
function idOf(attr) {
  if (!attr.directive) return normalName(attr);
  const directive = attr.key.name.name;
  if (directive === "on") return `@${normalName(attr)}`;
  if (directive === "bind") return normalName(attr);
  return `v-${directive}`;
}

const findById = (node, id) => node.startTag.attributes.find((attr) => idOf(attr) === id);

// --- element edits -----------------------------------------------------------------------------------------------

// isDisabled / is-disabled / is_disabled → disabled; both spellings on one element are flagged.
function disabledEdits(node, result) {
  const old = node.startTag.attributes.filter((attr) => DISABLED_SPELLINGS.has(idOf(attr)));
  if (!old.length) return;
  if (old.length > 1 || findById(node, "disabled")) return result.flag(old[0], "two disabled spellings: merge by hand");
  renameKey(old[0], "disabled", result);
}

// The one expression of a listener (`@x="a = !a"` parses as a statement list).
function handlerExpression(handler) {
  const expression = handler.value?.expression;
  if (expression?.type !== "VOnExpression") return expression;
  const [only, ...rest] = expression.body;
  return !rest.length && only?.type === "ExpressionStatement" ? only.expression : null;
}

// `x = !x` on the very expression `:selected` shows.
function isToggleOf(text, handler, selected) {
  const expression = handlerExpression(handler);
  if (expression?.type !== "AssignmentExpression" || expression.right.type !== "UnaryExpression") return false;
  const target = sourceOf(text, expression.left);
  return target === sourceOf(text, selected.value.expression) && target === sourceOf(text, expression.right.argument);
}

// Switcher: the model first; any other handler leaves the element as it is.
function switchEdits(text, node, result) {
  const selected = findById(node, "selected");
  const handler = findById(node, "@onselect");
  if (handler && !(selected?.directive && isToggleOf(text, handler, selected))) {
    const expression = handler.value?.expression;
    const code = expression ? sourceOf(text, expression).trim().replace(/\s+/g, " ") : "";
    result.flag(handler, `@onSelect="${code}": v-model or @update:model-value by hand`);
    return null;
  }
  renameTag(node, TARGET[SWITCH], result);
  if (handler) {
    removeNode(text, handler, result);
    result.edit(...selected.range, `v-model="${sourceOf(text, selected.value.expression)}"`);
  } else if (selected) {
    const model = selected.directive ? sourceOf(text, selected.value.expression) : "true";
    result.edit(...selected.range, `:model-value="${model}"`);
  }
  const prevent = findById(node, "prevent");
  if (prevent) renameKey(prevent, "disabled", result);
  unknownAttributes(text, node, [SWITCH, "selected", "@onselect", "prevent"], result);
  return null;
}

function textareaEdits(text, node, result) {
  renameTag(node, TARGET[TEXTAREA], result);
  const limit = findById(node, "limit");
  if (limit) renameKey(limit, limit.directive ? "maxlength" : ":maxlength", result); // `maxlength` is a Number prop
  disabledEdits(node, result);
  validateFlag(node, result);
  unknownAttributes(text, node, [TEXTAREA, "limit", "label", "validate", ...DISABLED_SPELLINGS], result);
  idInFieldFlag(node, result);
  return labelMove(text, node, result);
}

// A converted switch keeps its flags on the next run.
function newSwitchEdits(text, node, result) {
  unknownAttributes(text, node, [NEW_SWITCH], result);
  return null;
}

// A converted textarea keeps its flags on the next run: the old API it still carries is broken on BasicTextarea.
function newTextareaEdits(text, node, result) {
  disabledEdits(node, result);
  validateFlag(node, result);
  unknownAttributes(text, node, [NEW_TEXTAREA, "validate", ...DISABLED_SPELLINGS], result);
  idInFieldFlag(node, result);
  return null;
}

function lockedEdits(text, node, result) {
  renameTag(node, TARGET[LOCKED], result);
  addAttribute(node, "readonly", result);
  unknownAttributes(text, node, [LOCKED, "label"], result);
  idInFieldFlag(node, result);
  return labelMove(text, node, result);
}

function inputEdits(text, node, result) {
  disabledEdits(node, result);
  validateFlag(node, result);
  idInFieldFlag(node, result);
  return labelMove(text, node, result);
}

function numberEdits(text, node, result) {
  disabledEdits(node, result);
  return null;
}

function checkboxEdits(text, node, result) {
  const values = findById(node, "values");
  const message = "BasicCheckbox array API: a boolean v-model per checkbox (or BasicRadioGroup) by hand";
  if (values) result.flag(values, message);
  return null;
}

function validateFlag(node, result) {
  const validate = findById(node, "validate");
  if (validate) result.flag(validate, "validate: the message goes to FormField `error` by hand");
}

// Flags an attribute outside the target's map (`kind` names the map; `handled` are the names the edits took care of).
function unknownAttributes(text, node, [kind, ...handled], result) {
  for (const attr of node.startTag.attributes) {
    const id = idOf(attr);
    if (KEPT[kind].has(id) || handled.includes(id) || PASSTHROUGH.test(id) || STRUCTURAL.test(id)) continue;
    result.flag(attr, `unknown attribute "${sourceOf(text, attr.key)}" on <${node.rawName}>: by hand`);
  }
}

// --- floating label → FormField ---------------------------------------------------------------------------------

// Returns the FormField wrap `{ attributes }` when the control takes one; drops or flags the label otherwise.
function labelMove(text, node, result) {
  const label = findById(node, "label");
  if (!label) return null;
  const field = enclosingFormField(node);
  if (!field) {
    const moved = node.startTag.attributes.filter((attr) => MOVES_TO_FIELD.test(idOf(attr)));
    [label, ...moved].forEach((attr) => removeNode(text, attr, result));
    const structural = moved.filter((attr) => STRUCTURAL.test(idOf(attr)));
    const ordered = [...structural, label, ...moved.filter((attr) => !structural.includes(attr))];
    return { attributes: ordered.map((attr) => sourceOf(text, attr)) };
  }
  if (!findById(field, "label")) {
    result.flag(label, "a label inside a FormField without one: move it to the field by hand");
    return null;
  }
  removeNode(text, label, result);
  return null;
}

// The field's label points at the field's id: a control's own id inside a labelled FormField breaks that.
function idInFieldFlag(node, result) {
  const id = findById(node, "id");
  const field = enclosingFormField(node);
  if (id && field && findById(field, "label")) {
    result.flag(id, "an id on a control in a labelled FormField: move it to the field (its label points there)");
  }
}

// The control, its own edits applied, inside `<FormField …>` at the control's indent.
function wrapInField(text, node, local, wrap) {
  const [start, end] = node.range;
  const own = local.edits.map((e) => ({ ...e, start: e.start - start, end: e.end - start }));
  const indent = lineIndent(text, start);
  const control = applyEdits(text.slice(start, end), own).replace(/\n/g, "\n  ");
  return `<FormField ${wrap.attributes.join(" ")}>\n${indent}  ${control}\n${indent}</FormField>`;
}

const EDITS = {
  [SWITCH]: switchEdits,
  [TEXTAREA]: textareaEdits,
  [NEW_TEXTAREA]: newTextareaEdits,
  [NEW_SWITCH]: newSwitchEdits,
  [LOCKED]: lockedEdits,
  [INPUT]: inputEdits,
  [NUMBER]: numberEdits,
  [CHECKBOX]: checkboxEdits,
};

export function transform(text) {
  const ast = parseSfc(text);
  const result = collector();
  walkTemplate(ast, (node) => {
    const kind = node.type === "VElement" ? kindOf(node) : undefined;
    if (!kind) return;
    const local = collector();
    const wrap = EDITS[kind](text, node, local);
    result.flags.push(...local.flags);
    if (wrap) result.edit(node.range[0], node.range[1], wrapInField(text, node, local, wrap));
    else result.edits.push(...local.edits);
  });
  return { edits: result.edits, flags: result.flags };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCodemod("p3-inputs", transform);
