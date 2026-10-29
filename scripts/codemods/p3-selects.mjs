#!/usr/bin/env node
// P3 selects codemod (plan 15, docs/ui-rules.md C4): <Dropdown> becomes <BasicSelect>.
//   :values → :options; isDisabled → disabled; icon dropped (the caret is built in); placeholder, class, test ids,
//   aria-* and structural directives stay
//   :selected="x ? [x] : []" or :selected="[x]" + @onSelect="(v) => (x = v)" (or "x = $event") → v-model="x"
//   @onSelect="method" whose body only assigns its argument to x → v-model="x" @update:model-value="method"
//   :selected without @onSelect → :model-value (the array unwrapped)
// Flagged and left a Dropdown, never guessed: a handler that does more than assign (or assigns something else than
// the :selected value), a :selected that is no single value (Dropdown's find_label took the last array item), the
// props and events BasicSelect does not have (validate, custom_droplist, complex_values, can_remove_selected,
// @onUse, @onRemoveSelected, @onExtension*), options carrying label_ext* in the file, any other attribute. Only
// Dropdown tags are touched: Switcher and BasicCheckbox emit onSelect with other payloads (r02 §8).
// The sweeps (plans 17, 18) run it per partition and resolve the flags. CLI: see p3-lib.mjs.
import { pathToFileURL } from "node:url";
import {
  collector,
  normalName,
  parseSfc,
  removeNode,
  renameKey,
  renameTag,
  runCodemod,
  sourceOf,
  walkTemplate,
} from "./p3-lib.mjs";

const TARGET = "BasicSelect";
const NOT_ON_BASIC_SELECT = new Set([
  ...["validate", "custom_droplist", "complex_values", "can_remove_selected"],
  ...["onuse", "onremoveselected", "onextension", "onextension2"],
]);
// Attributes BasicSelect takes as they are (normalised: lower case, no dashes).
const PASSTHROUGH = /^(key|ref|class|style|id|placeholder|data[a-z0-9]*|aria[a-z]+)$/;
const HANDLED = new Set(["values", "selected", "onselect", "isdisabled", "icon"]);
const LABEL_EXT = /\blabel_ext/;

// The names Vue resolves to the Dropdown boot (`DropDown` resolves to nothing: not this codemod's).
const isDropdown = (node) => node.type === "VElement" && ["Dropdown", "dropdown"].includes(node.rawName);
const isStructural = (attr) => attr.directive && !["bind", "on"].includes(attr.key.name.name);
const code = (text, node) => sourceOf(text, node).replace(/\s+/g, "");
const attrOf = (node, name) => node.startTag.attributes.find((attr) => normalName(attr) === name);

// --- the :selected value -----------------------------------------------------------------------------------------

const isEmptyArray = (node) => node?.type === "ArrayExpression" && !node.elements.length;
const isArrayOf = (text, node, value) =>
  node?.type === "ArrayExpression" && node.elements.length === 1 && code(text, node.elements[0]) === code(text, value);

// `[x]` and `x ? [x] : []` → the node of x; null for anything else (an array of several, a bare value).
function selectedValue(text, attr) {
  const node = attr?.directive ? attr.value?.expression : null;
  if (node?.type === "ArrayExpression" && node.elements.length === 1) return node.elements[0];
  const wrapped = node?.type === "ConditionalExpression" && isEmptyArray(node.alternate);
  return wrapped && isArrayOf(text, node.consequent, node.test) ? node.test : null;
}

const bindingOf = (text, attr) => (attr.value ? sourceOf(text, attr.value.expression ?? attr.value) : "");
const isAssignable = (node) => node?.type === "Identifier" || node?.type === "MemberExpression";

// --- the @onSelect handler -----------------------------------------------------------------------------------------

// The target of a lone `target = argument` statement or expression; null for anything else.
function assignedFrom(statement, argument) {
  const node = statement?.type === "ExpressionStatement" ? statement.expression : statement;
  const isAssignment = node?.type === "AssignmentExpression" && node.operator === "=";
  return isAssignment && node.right.type === "Identifier" && node.right.name === argument ? node.left : null;
}

// A function whose body only assigns its one parameter → the assigned node.
function functionTarget(fn) {
  if (!fn || !/Function/.test(fn.type) || fn.params.length !== 1 || fn.params[0].type !== "Identifier") return null;
  const body = fn.body.type === "BlockStatement" ? fn.body.body : [fn.body];
  return body.length === 1 ? assignedFrom(body[0], fn.params[0].name) : null;
}

// Methods of the SFC by name: options API `methods: { … }`, script-setup functions and arrow constants.
function scriptFunctions(ast) {
  const functions = new Map();
  for (const node of ast.body) {
    if (node.type === "FunctionDeclaration") functions.set(node.id.name, node);
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((d) => d.id.type === "Identifier" && d.init && functions.set(d.id.name, d.init));
    }
    const options = node.type === "ExportDefaultDeclaration" ? node.declaration.properties ?? [] : [];
    const methods = options.find((p) => (p.key?.name ?? p.key?.value) === "methods")?.value;
    (methods?.properties ?? []).forEach((p) => p.key && functions.set(p.key.name ?? p.key.value, p.value));
  }
  return functions;
}

// `this.form.x` (options API) and `x.value` (a script-setup ref) read as `form.x` and `x` in the template.
const SCRIPT_SETUP = /<script\b[^>]*\bsetup\b/;
const templateName = (text, node) =>
  SCRIPT_SETUP.test(text) ? code(text, node).replace(/\.value$/, "") : code(text, node).replace(/^this\./, "");

// → { inline: true } when the handler can go (v-model does its work), { method } when it stays, null otherwise.
function handlerKind(text, attr, value, functions) {
  const expression = attr.value?.expression;
  const assigns = (target) => target && templateName(text, target) === code(text, value);
  if (expression?.type === "VOnExpression") {
    const [statement, ...rest] = expression.body;
    return !rest.length && assigns(assignedFrom(statement, "$event")) ? { inline: true } : null;
  }
  if (expression?.type === "Identifier") {
    return assigns(functionTarget(functions.get(expression.name))) ? { method: expression.name } : null;
  }
  return assigns(functionTarget(expression)) ? { inline: true } : null;
}

// --- one tag -----------------------------------------------------------------------------------------------------

// Attributes outside the map; false when the tag is flagged.
function checkAttributes(text, node, result) {
  for (const attr of node.startTag.attributes) {
    const name = normalName(attr);
    if (NOT_ON_BASIC_SELECT.has(name)) {
      result.flag(attr, `"${sourceOf(text, attr.key)}" is not on BasicSelect: by hand`);
    } else if (!HANDLED.has(name) && !PASSTHROUGH.test(name) && !isStructural(attr)) {
      result.flag(attr, `unknown attribute "${sourceOf(text, attr.key)}" on <Dropdown>: by hand`);
    }
  }
  return !result.flags.length;
}

// :selected + @onSelect → v-model / :model-value (+ @update:model-value); false when undecidable (flagged).
function modelEdits(text, node, functions, result) {
  const selected = attrOf(node, "selected");
  const onSelect = attrOf(node, "onselect");
  if (!selected) return result.flag(onSelect ?? node, "no :selected: the model binding by hand");
  const value = selectedValue(text, selected);
  if (!value) return result.flag(selected, `:selected="${bindingOf(text, selected)}" is not one value: by hand`);
  if (!onSelect) return result.edit(...selected.range, `:model-value="${sourceOf(text, value)}"`);
  if (!isAssignable(value)) return result.flag(selected, `"${sourceOf(text, value)}" cannot take a v-model: by hand`);
  const handler = handlerKind(text, onSelect, value, functions);
  if (!handler) return result.flag(onSelect, "@onSelect does more than assign the :selected value: by hand");
  result.edit(...selected.range, `v-model="${sourceOf(text, value)}"`);
  if (handler.inline) removeNode(text, onSelect, result);
  else result.edit(...onSelect.range, `@update:model-value="${handler.method}"`);
}

function tagEdits(text, node, functions, result) {
  if (!checkAttributes(text, node, result)) return;
  modelEdits(text, node, functions, result);
  if (result.flags.length) return;
  renameTag(node, TARGET, result);
  for (const attr of node.startTag.attributes) {
    const name = normalName(attr);
    if (name === "values") renameKey(attr, "options", result);
    if (name === "isdisabled") renameKey(attr, "disabled", result);
    if (name === "icon") removeNode(text, attr, result);
  }
}

export function transform(text) {
  const ast = parseSfc(text);
  const functions = scriptFunctions(ast);
  const result = collector();
  const labelExt = LABEL_EXT.test(text);
  walkTemplate(ast, (node) => {
    if (!isDropdown(node)) return;
    if (labelExt) return result.flag(node, "the file's options carry label_ext*: extension actions by hand");
    // One tag at a time: a flagged tag keeps every byte.
    const tag = collector();
    tagEdits(text, node, functions, tag);
    if (tag.flags.length) result.flags.push(...tag.flags);
    else result.edits.push(...tag.edits);
  });
  return { edits: result.edits, flags: result.flags };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCodemod("p3-selects", transform);
