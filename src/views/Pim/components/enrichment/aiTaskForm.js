// The "Run AI task" form, generated from a worker's `params_schema` (a pydantic JSON schema). Kept small on
// purpose: a string, a string enum, an array of strings (`fields` = the field picker, else a language list), the
// free-text `prompt`, a small bounded integer (`count`: how many variants). `channel` is never asked — the dialog fills
// it from the active PIM channel; `rules` live on the template; `picture_ref` comes from the dialog's picture picker;
// an image `preset` is a toolbox key the templates carry (a custom run takes the toolbox default for the operation).
// Other types keep the backend default. Research (augmentations, contract A4 § 5) sits next to it.

const HIDDEN = new Set(["channel", "rules", "picture_ref", "preset"]);
// Hidden params a template keeps through an edit (the form never shows them, so they are carried over).
const KEPT = ["preset"];
const MAX_COUNT_OPTIONS = 10;
export const ALL_LANGUAGES = "*";

// `str | None` arrives as anyOf [{type: string}, {type: null}]; an Enum class as a $ref into $defs.
function resolveProp(schema, raw) {
  const prop = raw.anyOf?.find((p) => p.type !== "null") || raw;
  const ref = prop.$ref || prop.allOf?.[0]?.$ref;
  if (!ref) return { ...raw, ...prop };
  return { ...schema.$defs?.[ref.split("/").pop()], ...raw, ...prop };
}

function fieldKind(name, prop) {
  if (prop.type === "array" && prop.items?.type === "string") return name === "fields" ? "fields" : "languages";
  if (prop.type === "integer") return countRange(prop).length ? "count" : null;
  if (prop.type !== "string") return null;
  if (prop.enum) return "enum";
  if (name === "prompt") return "prompt";
  if (name.endsWith("language")) return "language";
  return "text";
}

// An integer with both bounds and a short range (`n`: 1–4) is picked from its values.
function countRange(prop) {
  const { minimum: min, maximum: max } = prop;
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min || max - min >= MAX_COUNT_OPTIONS) return [];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** [{ name, kind, title, options, default, required, allowAll }] — kind: text · enum · prompt · language ·
 * languages · fields · count. `allowAll`: a `write` worker's languages take "All languages" (`["*"]`). */
export function buildFields(schema, workerKind = "") {
  const required = new Set(schema?.required || []);
  return Object.entries(schema?.properties || {})
    .filter(([name]) => !HIDDEN.has(name))
    .map(([name, raw]) => {
      const prop = resolveProp(schema, raw);
      return {
        name,
        kind: fieldKind(name, prop),
        title: prop.title || name,
        options: prop.enum || countRange(prop),
        default: prop.default,
        required: required.has(name),
        allowAll: workerKind === "write" && name === "languages",
      };
    })
    .filter((field) => field.kind);
}

function defaultFor(field, { languages, source, hasSource }) {
  if (field.kind === "language") return source;
  if (field.kind === "fields") return [];
  if (field.allowAll) return [ALL_LANGUAGES];
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

/** Required by the schema, or (`run`) by the run itself: a custom picture instruction (`operation: instruct`) needs its
 * prompt — a template may leave it to the run. */
export function isRequired(field, values = {}, run = false) {
  return field.required || (run && field.name === "prompt" && values.operation === "instruct");
}

const blank = (value) => isEmpty(typeof value === "string" ? value.trim() : value);

export function missingRequired(fields, values, { run = false } = {}) {
  return fields.filter((field) => isRequired(field, values, run) && blank(values[field.name])).map((field) => field.name);
}

/** The hidden params of `params` a template keeps (an image preset). */
export function keptParams(params = {}) {
  return Object.fromEntries(KEPT.filter((name) => params[name] !== undefined).map((name) => [name, params[name]]));
}

/** A template's params over the defaults, for the fields the form has. */
export function presetValues(fields, values, params = {}) {
  const preset = fields.filter((field) => params[field.name] !== undefined);
  return { ...values, ...Object.fromEntries(preset.map((field) => [field.name, JSON.parse(JSON.stringify(params[field.name]))])) };
}

const RESEARCH = { write: ["seo_brief"] };

/** The research a run can add: what the worker's kind supports, plus what a template presets. */
export function researchKeys(kind, preset = []) {
  return [...new Set([...(RESEARCH[kind] || []), ...preset])];
}

/** { augment, seo_scope } — the research a template presets; SEO is remembered per category by default. */
export function defaultResearch(params = {}) {
  return { augment: [...(params.augment || [])], seo_scope: params.seo_scope || "category" };
}

/** Task / template params: the form values (empty optional lists dropped, the backend default stands) + research.
 * `research` null = the kind takes none; else `augment` is always sent, so a run can switch off a template's preset. */
export function buildParams(fields, values, research = null) {
  const optionalEmpty = (field) => !field.required && Array.isArray(values[field.name]) && !values[field.name].length;
  const skipped = new Set(fields.filter(optionalEmpty).map((field) => field.name));
  const params = Object.fromEntries(Object.entries(values).filter(([name]) => !skipped.has(name)));
  if (!research) return params;
  if (!research.augment.length) return { ...params, augment: [] };
  return { ...params, augment: [...research.augment], seo_scope: research.seo_scope };
}

/** POST tasks/ body: one task over the picked SKUs of one channel (or, with `filters`, the PIM products matching them);
 * `template` presets params and rules server side; `module` = whose subjects the refs are (default PIM). */
export function buildTaskPayload({ worker, params, channel, skus, template = "", filters = null, module = "pim" }) {
  const scope = filters ? { mode: "filter", filters: { ...filters } } : { mode: "list", refs: [...skus] };
  const body = {
    type: worker.key,
    params: worker.params_schema?.properties?.channel ? { ...params, channel } : { ...params },
    scope_spec: { ...scope, module, channel },
  };
  return template ? { ...body, template } : body;
}
