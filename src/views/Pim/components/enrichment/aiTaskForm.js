// The "Run AI task" form, generated from a worker's `params_schema` (a pydantic JSON schema). Kept small on
// purpose: a string, a string enum, an array of strings (always a language list), the free-text `prompt`.
// `channel` is never asked — the dialog fills it from the active PIM channel. Other types keep the backend default.

const HIDDEN = new Set(["channel"]);

// `str | None` arrives as anyOf [{type: string}, {type: null}]; an Enum class as a $ref into $defs.
function resolveProp(schema, raw) {
  const prop = raw.anyOf?.find((p) => p.type !== "null") || raw;
  const ref = prop.$ref || prop.allOf?.[0]?.$ref;
  if (!ref) return { ...raw, ...prop };
  return { ...schema.$defs?.[ref.split("/").pop()], ...raw, ...prop };
}

function fieldKind(name, prop) {
  if (prop.type === "array" && prop.items?.type === "string") return "languages";
  if (prop.type !== "string") return null;
  if (prop.enum) return "enum";
  if (name === "prompt") return "prompt";
  if (name.endsWith("language")) return "language";
  return "text";
}

/** [{ name, kind, title, options, default, required }] — kind: text · enum · prompt · language · languages. */
export function buildFields(schema) {
  const required = new Set(schema?.required || []);
  return Object.entries(schema?.properties || {})
    .filter(([name]) => !HIDDEN.has(name))
    .map(([name, raw]) => {
      const prop = resolveProp(schema, raw);
      return {
        name,
        kind: fieldKind(name, prop),
        title: prop.title || name,
        options: prop.enum || [],
        default: prop.default,
        required: required.has(name),
      };
    })
    .filter((field) => field.kind);
}

function defaultFor(field, { languages, source, hasSource }) {
  if (field.kind === "language") return source;
  if (field.kind === "languages") return hasSource ? languages.filter((l) => l !== source) : [...languages];
  if (field.kind === "enum") return field.default ?? field.options[0] ?? "";
  return field.default ?? "";
}

/** Source language = the channel's main language; target lists are pre-checked minus the source. */
export function defaultValues(fields, { languages = [], mainLanguage = "" } = {}) {
  const source = mainLanguage || languages[0] || "";
  const hasSource = fields.some((field) => field.kind === "language");
  return Object.fromEntries(fields.map((field) => [field.name, defaultFor(field, { languages, source, hasSource })]));
}

/** A new source language leaves every target list: a text is never translated into its own language. */
export function withSource(values, fields, name, language) {
  const next = { ...values, [name]: language };
  for (const field of fields.filter((f) => f.kind === "languages")) {
    next[field.name] = next[field.name].filter((l) => l !== language);
  }
  return next;
}

const isEmpty = (value) => value == null || value === "" || (Array.isArray(value) && !value.length);

export function missingRequired(fields, values) {
  return fields.filter((field) => field.required && isEmpty(values[field.name])).map((field) => field.name);
}

/** POST tasks/ body: one task over the picked SKUs of one channel. */
export function buildTaskPayload({ worker, values, channel, skus }) {
  const params = { ...values };
  if (worker.params_schema?.properties?.channel) params.channel = channel;
  return {
    type: worker.key,
    params,
    scope_spec: { mode: "list", module: "pim", channel, refs: [...skus] },
  };
}
