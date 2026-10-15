// The company profile editor's pure helpers (contract A4 § 2): the form read from the profile's JSON Schema, the
// table rows, the JSON check, the API errors by path and the completeness. The components render what these return.

const LONG_TEXT = 500;
const ID_PREFIX = { facts: "fact", rules: "rule" };

/** The schema node with its local `$ref` (`#/$defs/x`) resolved. */
export function resolve(root, node) {
  if (!node?.$ref) return node || {};
  const name = node.$ref.replace("#/$defs/", "");
  return resolve(root, root.$defs?.[name]);
}

/** How a schema node is edited: markdown · line · chips · table · group · switch · map · json. */
export function fieldKind(root, raw) {
  const node = resolve(root, raw);
  if (node.type === "boolean") return "switch";
  if (node.type === "string") return node.maxLength > LONG_TEXT ? "markdown" : "line";
  if (node.type === "array") return resolve(root, node.items).type === "object" ? "table" : "chips";
  if (node.type !== "object") return "json";
  if (node.properties) return "group";
  return resolve(root, node.additionalProperties).type === "string" ? "map" : "json";
}

/** The columns of a table node: [{ key, kind, required }]. */
export function columnsOf(root, raw) {
  const items = resolve(root, resolve(root, raw).items);
  const required = items.required || [];
  return Object.entries(items.properties || {}).map(([key, node]) => ({
    key,
    kind: fieldKind(root, node),
    required: required.includes(key),
  }));
}

function describe(root, key, node) {
  const kind = fieldKind(root, node);
  if (kind === "table") return { key, kind, columns: columnsOf(root, node) };
  return { key, kind };
}

/** The sections of the form, in schema order: [{ key, kind, fields?, columns? }]; a group lists its fields. */
export function sectionsFrom(schema) {
  return Object.entries(schema?.properties || {}).map(([key, raw]) => {
    const section = describe(schema, key, raw);
    if (section.kind !== "group") return section;
    const props = resolve(schema, raw).properties;
    return { ...section, fields: Object.entries(props).map(([name, node]) => describe(schema, name, node)) };
  });
}

/** A row id the operator never types: `fact-3` after `fact-2`. */
export function nextId(rows, section) {
  const prefix = ID_PREFIX[section] || "row";
  const numbers = (rows || []).map((row) => Number(String(row.id || "").split("-").pop()) || 0);
  return `${prefix}-${Math.max(0, ...numbers) + 1}`;
}

/** A new table row: ids generated, switches on, the rest empty. */
export function emptyRow(columns, rows, section) {
  const row = {};
  columns.forEach(({ key, kind }) => {
    if (key === "id") row.id = nextId(rows, section);
    else if (kind === "switch") row[key] = true;
    else if (kind !== "map") row[key] = "";
  });
  return row;
}

/** `{ pl: "sofa", de: "Sofa" }` → "pl: sofa; de: Sofa". */
export function mapToText(map) {
  return Object.entries(map || {})
    .map(([lang, value]) => `${lang}: ${value}`)
    .join("; ");
}

/** "pl: sofa; de: Sofa" → `{ pl: "sofa", de: "Sofa" }`; parts without a "lang:" are dropped. */
export function textToMap(text) {
  const pairs = String(text || "")
    .split(";")
    .map((part) => part.split(":"))
    .filter((parts) => parts.length > 1 && parts[0].trim())
    .map(([lang, ...rest]) => [lang.trim(), rest.join(":").trim()]);
  return Object.fromEntries(pairs);
}

const isEmpty = (value) =>
  value === "" ||
  value == null ||
  (Array.isArray(value) && !value.length) ||
  (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);

/** Nothing filled in: the value is empty once its empty strings, lists and objects are dropped. */
export const isBlankValue = (value) => isEmpty(pruneEmpty(value));

/** The data without empty strings, lists and objects ("empty = missing"); `false` and 0 stay. */
export function pruneEmpty(value) {
  if (Array.isArray(value)) return value.map(pruneEmpty).filter((item) => !isEmpty(item));
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value).map(([key, item]) => [key, pruneEmpty(item)]);
  return Object.fromEntries(entries.filter(([, item]) => !isEmpty(item)));
}

/** The API's 400 details as `{ "<path without data.>": message }` (the client rejects with the bare v2 body). */
export function errorsByPath(err) {
  const details = (err?.response?.data ?? err)?.details;
  if (!Array.isArray(details)) return {};
  const pairs = details
    .filter((d) => d.field)
    .map((d) => [d.field.replace(/^data\.?/, ""), d.description || d.issue || ""]);
  return Object.fromEntries(pairs);
}

/** The status sections as { done, total, byKey }. */
export function completeness(status) {
  const sections = status?.sections || [];
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));
  return { done: sections.filter((s) => s.complete).length, total: sections.length, byKey };
}

/** Pretty JSON for the editor and the version diff. */
export const prettyJson = (data) => JSON.stringify(data || {}, null, 2);

const ROW_PATH = /^\d+(\.[a-z_]+)?$/;

/** Whether an error at `path` (inside `section`) shows at a control: a group's field, a table row or its cell. */
export function shownInline(section, path) {
  if (section.kind === "table") return ROW_PATH.test(path);
  if (section.kind !== "group") return false;
  const [head, ...rest] = path.split(".");
  const field = section.fields.find((f) => f.key === head);
  if (!field) return false;
  return !rest.length || (field.kind === "table" && ROW_PATH.test(rest.join(".")));
}

/** The errors whose path starts with `key.`, keyed by the rest of the path. */
export function errorsInside(errors, key) {
  const prefix = `${key}.`;
  const pairs = Object.entries(errors)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, message]) => [path.slice(prefix.length), message]);
  return Object.fromEntries(pairs);
}

const isRecord = (value) => value && typeof value === "object";

/** A table row as one line: its values joined, ids left out, translations as "pl: …; de: …", a row that is off marked. */
function rowLine(row, offLabel) {
  const parts = Object.entries(row)
    .filter(([key, value]) => key !== "id" && key !== "active" && !isEmpty(value))
    .map(([, value]) => (isRecord(value) ? mapToText(value) : String(value)));
  return `• ${parts.join(" · ")}${row.active === false ? ` (${offLabel})` : ""}`;
}

/** A profile value as plain text for the version diff — text as written, rows as lines, fields under their names. */
export function readableText(value, { label = (key) => key, offLabel = "off" } = {}) {
  if (value == null) return "";
  if (!isRecord(value)) return String(value);
  if (Array.isArray(value)) return value.map((item) => (isRecord(item) ? rowLine(item, offLabel) : `• ${item}`)).join("\n");
  return Object.entries(value)
    .map(([key, item]) => `${label(key)}:\n${readableText(item, { label, offLabel })}`)
    .join("\n\n");
}

/** The sections that differ between two versions' data, in the schema's order: [{ key, before, after }]. */
export function changedSections(before = {}, after = {}, order = []) {
  const keys = [...new Set([...order, ...Object.keys(before || {}), ...Object.keys(after || {})])];
  return keys
    .filter((key) => prettyJson(before?.[key]) !== prettyJson(after?.[key]))
    .map((key) => ({ key, before: before?.[key], after: after?.[key] }));
}

/** An error path in words: "facts.2.value" → ["facts", "row 3", "value"] named by `name`, joined with " › ". */
export function pathWords(path, name) {
  return path
    .split(".")
    .map((part, index) => (/^\d+$/.test(part) ? name("row", Number(part) + 1) : name(index ? "field" : "section", part)))
    .join(" › ");
}
