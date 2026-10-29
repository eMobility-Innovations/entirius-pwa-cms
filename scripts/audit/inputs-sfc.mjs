// Input audit, SFC side (plan 61a): every text/number input of one .vue file — label, v-model path, the props that
// constrain it today — plus what its <script> tells the join: the `@/api` functions it imports, the fields a
// `validateRequired` rule names, and the payload keys a model path is copied into.
import { parse } from "@vue/compiler-sfc";

const ELEMENT = 1;
const ATTRIBUTE = 6;
const DIRECTIVE = 7;
const INPUTS = new Set(["BasicInput", "NumberInput", "BasicTextarea", "BasicDatePicker", "ColorInput", "input", "textarea"]);
const NATIVE_SKIP = new Set(["checkbox", "radio", "file", "hidden", "range", "submit", "button", "color"]);
const CONSTRAINTS = ["type", "step", "min", "max", "maxlength", "inputmode", "pattern", "required", "suffix", "decimals", "readonly", "disabled", "format"];
// NumberInput's own defaults (src/boots/NumberInput): a stepper without min/max still clamps to 0…9999.
const NUMBER_DEFAULTS = { min: "0", max: "9999", step: "1" };

const pascal = (tag) => tag.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
const componentOf = (tag) => (["input", "textarea"].includes(tag) ? tag : pascal(tag));

/** Every prop of a node as { name: { value, bound } }: `:x="e"` is bound, `x="v"` static, `v-model` → model. */
export function propsOf(node) {
  const out = {};
  for (const prop of node.props) {
    if (prop.type === ATTRIBUTE) out[prop.name] = { value: prop.value?.content ?? "true", bound: false };
    if (prop.type !== DIRECTIVE) continue;
    if (prop.name === "model") out["v-model"] = { value: prop.exp?.content ?? "", bound: true };
    if (prop.name === "bind" && prop.arg?.content) out[prop.arg.content] = { value: prop.exp?.content ?? "", bound: true };
  }
  return out;
}

// `required` / `required=""` / `:required="x"` are on; `:required="false"` is off.
const isOn = (prop) => Boolean(prop) && prop.value.trim() !== "false";
const pick = (props, ...names) => names.map((name) => props[name]).find(Boolean) || null;

/** `$t('a.b')` / `t("a.b")` → the key, or null for any other expression. */
export function i18nKey(expr) {
  return expr?.match(/^\$?t\(\s*["'`]([\w.-]+)["'`]\s*\)$/)?.[1] || null;
}

function labelOf(prop, messages) {
  if (!prop) return null;
  if (!prop.bound) return { text: prop.value, key: null };
  const key = i18nKey(prop.value.trim());
  if (!key) return { text: null, key: null, expr: prop.value };
  return { text: key.split(".").reduce((o, k) => o?.[k], messages) ?? null, key };
}

function constraintsOf(component, props) {
  const out = {};
  for (const name of CONSTRAINTS) {
    const prop = props[name];
    if (prop) out[name] = prop.bound && !/^(true|false)$/.test(prop.value.trim()) ? `{${prop.value}}` : prop.value.trim();
  }
  if (component !== "NumberInput") return out;
  for (const [name, value] of Object.entries(NUMBER_DEFAULTS)) out[name] ??= `${value} (default)`;
  // A literal step (`step="0.01"`, `:step="0.01"`) decides the places; a step from a variable leaves them unknown.
  const step = String(out.step).replace(/^\{|\}$/g, "").split(" ")[0];
  if (/^\d+(\.\d+)?$/.test(step)) out.decimals ??= (step.split(".")[1] || "").length;
  return out;
}

function serverErrorKey(field) {
  return field ? pick(field, "error")?.value.match(/getFieldError\(\s*["'`](\w+)["'`]/)?.[1] || null : null;
}

function inputRecord(node, field, messages) {
  const props = propsOf(node);
  const component = componentOf(node.tag);
  const fieldProps = field ? propsOf(field) : null;
  const model = pick(props, "v-model", "modelValue", "model-value", "value");
  return {
    line: node.loc.start.line,
    component,
    model: model?.value.trim() || null,
    label: labelOf(fieldProps && pick(fieldProps, "label"), messages),
    placeholder: labelOf(pick(props, "placeholder"), messages),
    ariaLabel: labelOf(pick(props, "aria-label", "ariaLabel"), messages),
    constraints: constraintsOf(component, props),
    required: isOn(fieldProps?.required) || isOn(props.required),
    serverErrors: serverErrorKey(fieldProps),
  };
}

function isAuditedInput(node) {
  if (node.type !== ELEMENT || !INPUTS.has(componentOf(node.tag))) return false;
  if (node.tag !== "input") return true;
  const type = propsOf(node).type;
  return !(type && !type.bound && NATIVE_SKIP.has(type.value));
}

function walk(node, field, messages, out) {
  if (isAuditedInput(node)) out.push(inputRecord(node, field, messages));
  const nearest = node.type === ELEMENT && pascal(node.tag) === "FormField" ? node : field;
  for (const child of node.children || []) walk(child, nearest, messages, out);
}

/** The imported `@/api/<module>/api` functions: { name, module }. */
export function apiImports(script) {
  const out = [];
  const re = /import\s*\{([^}]+)\}\s*from\s*["']@\/api\/([\w/]+?)(?:\/api)?(?:\.js)?["']/g;
  for (const [, names, module] of script.matchAll(re)) {
    for (const name of names.split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) out.push({ name, module });
  }
  return out;
}

/** Field names a `validateRequired(form, { field: label })` call checks. */
export function requiredRules(script) {
  const out = new Set();
  for (const [, body] of script.matchAll(/validateRequired\(\s*[\w.]+\s*,\s*\{([^}]*)\}/g)) {
    for (const [, key] of body.matchAll(/["']?(\w+)["']?\s*:/g)) out.add(key);
  }
  return [...out];
}

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Keys of object literals the model path is copied into: `{ value: form.price_net }` → ["value"]. */
export function payloadKeys(script, model) {
  if (!model || !/^[\w.]+$/.test(model)) return [];
  const re = new RegExp(`(?:^|[{,])\\s*(\\w+)\\s*:\\s*[^,;\\n{}?]*?(?<![\\w.])${escapeRe(model)}(?![\\w$]|\\.\\w)`, "gm");
  const last = model.split(".").pop();
  return [...new Set([...script.matchAll(re)].map((m) => m[1]).filter((key) => key !== last))];
}

/** Parse one SFC: { inputs, imports, required } with every input carrying its payload keys. */
export function extractInputs(source, messages = {}) {
  const { descriptor } = parse(source);
  const script = [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join("\n");
  const inputs = [];
  if (descriptor.template?.ast) walk(descriptor.template.ast, null, messages, inputs);
  for (const input of inputs) input.payloadKeys = payloadKeys(script, input.model);
  return { inputs, imports: apiImports(script), required: requiredRules(script) };
}
