import { resolve } from "./profileLogic";

// The "Edit JSON" check before Save: the subset of JSON Schema the profile schema uses (type, properties,
// additionalProperties, items, required, maxLength, maxItems, enum, pattern). The server validates again; this only
// shows the errors at their paths while the operator types. Returns { "<path>": { code, arg? } }.

const TYPE_OF = (value) => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
};

function checkScalar(node, value, path, out) {
  if (node.enum && !node.enum.includes(value)) out[path] = { code: "enum", arg: node.enum.join(", ") };
  if (typeof value !== "string") return;
  if (node.maxLength && value.length > node.maxLength) out[path] = { code: "too_long", arg: node.maxLength };
  if (node.minLength && value.length < node.minLength) out[path] = { code: "required" };
  if (node.pattern && !new RegExp(node.pattern).test(value)) out[path] = { code: "format" };
}

function checkObject(root, node, value, path, out) {
  (node.required || []).filter((key) => !(key in value)).forEach((key) => (out[join(path, key)] = { code: "required" }));
  Object.entries(value).forEach(([key, item]) => {
    const child = node.properties?.[key] ?? node.additionalProperties;
    if (child === false || (child === undefined && node.properties)) out[join(path, key)] = { code: "unknown" };
    else if (child) walk(root, child, item, join(path, key), out);
  });
}

function checkArray(root, node, value, path, out) {
  if (node.maxItems && value.length > node.maxItems) out[path] = { code: "too_many", arg: node.maxItems };
  value.forEach((item, index) => walk(root, node.items || {}, item, join(path, index), out));
}

const join = (path, key) => (path ? `${path}.${key}` : String(key));

function walk(root, raw, value, path, out) {
  const node = resolve(root, raw);
  const type = TYPE_OF(value);
  if (node.type && node.type !== type) {
    out[path || "$"] = { code: "type", arg: node.type };
    return;
  }
  if (type === "object") checkObject(root, node, value, path, out);
  else if (type === "array") checkArray(root, node, value, path, out);
  else checkScalar(node, value, path, out);
}

/** `{ data, errors }` of the editor text: a parse error sits at "$", schema errors at their paths. */
export function checkProfileJson(schema, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { data: null, errors: { $: { code: "parse", arg: err.message } } };
  }
  const errors = {};
  walk(schema || {}, schema || {}, data, "", errors);
  return { data, errors };
}
