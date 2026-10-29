// Studio helpers (contract A4 § 6): the steps rail, what the operator should do next, the brief form from a
// workflow's inputs schema, the questions form, the search-phrase pick and where a finished run's document opens.
// Pure functions — the views render them.

const STEP_TONES = { waiting: "neutral", running: "info", review: "warning", approved: "positive", failed: "negative" };

const RUN_TONES = { running: "info", waiting: "warning", done: "positive", failed: "negative", cancelled: "neutral" };

// The content type a workflow document lands in. Coupled to django-contentdb `CONTENTDB_ENRICHMENT_DOCUMENT_TYPE`
// (default "blog-post") until the run carries its draft's type — docs/panels-routing.md.
export const DOCUMENT_TYPE = "blog-post";
export const MAX_SECONDARY = 2;
const LONG_TEXT = 300;
// A run that has not changed for this long while a step is marked running has likely lost its task.
export const STALE_MS = 3 * 60 * 1000;
const CLOSED_RUN = ["done", "cancelled"];
const WORDS_PER_MINUTE = 200;
// Runs waiting for the operator first, then failed ones, then the working ones; the rest keep their date order.
const OPEN_RANK = { waiting: 0, failed: 1, running: 2 };
// The brief field the channel's languages fill (a select instead of free text).
export const LANGUAGE_FIELD = "language";

/** The tone of a step state. */
export const stepTone = (status) => STEP_TONES[status] || STEP_TONES.waiting;

/** The steps a step still waits for (needed, not approved yet), in run order. */
export function blockers(run, step) {
  const needs = step?.needs || [];
  return (run?.steps || []).filter((other) => needs.includes(other.key) && other.status !== "approved");
}

/** The rail's second line as a key under `enrichment.studio.rail` with its params: the step's state in words. */
export function railLine(run, step) {
  if (isStepStopped(run, step)) return { key: "stopped", params: {} };
  if (step.status !== "waiting") return { key: step.status, params: {} };
  const last = blockers(run, step).at(-1);
  return last ? { key: "waiting", params: { step: last.label } } : { key: "queued", params: {} };
}

/** Whether a step stopped with its cancelled run (anything not approved by then). */
export const isStepStopped = (run, step) => run?.status === "cancelled" && step.status !== "approved";

/**
 * The rail: one item per step with its number, tone, look (its status, or "stopped") and second line; `current` marks
 * the run's first open step.
 */
export function railItems(run) {
  return (run?.steps || []).map((step, index) => {
    const stopped = isStepStopped(run, step);
    return {
      key: step.key,
      label: step.label,
      status: step.status,
      look: stopped ? "stopped" : step.status,
      number: index + 1,
      tone: stopped ? "neutral" : stepTone(step.status),
      current: step.key === run.current_step,
      line: railLine(run, step),
    };
  });
}

/**
 * What the operator should do now: `your_turn` (a step waits for review), `failed`, `writing` (the AI works, nothing
 * to do), `waiting`, `done` or `cancelled` — with the step it is about (null for a closed run).
 */
export function nextAction(run) {
  if (isRunClosed(run)) return { kind: run.status, step: null };
  const steps = run?.steps || [];
  for (const [status, kind] of [["review", "your_turn"], ["failed", "failed"], ["running", "writing"]]) {
    const step = steps.find((s) => s.status === status);
    if (step) return { kind, step };
  }
  return { kind: "waiting", step: null };
}

/** The step after `key` in the run (what an approval leads to), or null after the last one. */
export function nextStep(run, key) {
  const steps = run?.steps || [];
  const index = steps.findIndex((step) => step.key === key);
  return index < 0 ? null : steps[index + 1] || null;
}

/** The runs of one list page, open ones first (waiting, failed, working); the order inside a group is kept. */
export function openFirst(runs) {
  const rank = (run) => OPEN_RANK[run.status] ?? Object.keys(OPEN_RANK).length;
  return [...(runs || [])].sort((a, b) => rank(a) - rank(b));
}

export const runTone = (status) => RUN_TONES[status] || "neutral";

/** The step to open first: the one waiting for the operator, else the one working, else a failed one, else the current. */
export function defaultStep(run) {
  const steps = run?.steps || [];
  const first = (status) => steps.find((step) => step.status === status)?.key;
  return first("review") || first("running") || first("failed") || run?.current_step || steps.at(-1)?.key || "";
}

/** A done or cancelled run: no decisions, no refresh. */
export const isRunClosed = (run) => CLOSED_RUN.includes(run?.status);

/** A run that has not changed for STALE_MS (false without `modified_at`). */
export const isRunStale = (run, now = Date.now()) => now - Date.parse(run?.modified_at) > STALE_MS;

/** An open run still working on a step that has not gone quiet: the view keeps refreshing it. */
export function isRunWorking(run, now = Date.now()) {
  if (isRunClosed(run) || isRunStale(run, now)) return false;
  return (run?.steps || []).some((step) => step.status === "running");
}

/** What people call a run: its working title, else its topic, else the workflow's name. */
export function runTitle(run) {
  const inputs = run?.inputs || {};
  return inputs.title || inputs.topic || run?.definition_label || "";
}

/**
 * The brief form of an inputs schema: one field per property, required ones first in the schema's order. `type` is
 * "string" | "boolean" | "object"; `picker` (`x-picker`, e.g. "pim-product") picks an object value; `visibleIf`
 * (`x-visible-if`) names the field that must be on for this one to show — and then it must be filled.
 */
export function briefFields(schema) {
  const required = schema?.required || [];
  const fields = Object.entries(schema?.properties || {}).map(([key, prop]) => ({
    key,
    label: prop.title || key,
    type: BRIEF_TYPES.includes(prop.type) ? prop.type : "string",
    picker: prop["x-picker"] || "",
    visibleIf: prop["x-visible-if"] || "",
    required: required.includes(key),
    multiline: (prop.maxLength || 0) > LONG_TEXT,
    minLength: prop.minLength ?? null,
    maxLength: prop.maxLength ?? null,
    pattern: prop.pattern || "",
    default: prop.default ?? (prop.type in DEFAULTS ? DEFAULTS[prop.type] : ""),
  }));
  return [...fields.filter((f) => f.required), ...fields.filter((f) => !f.required)];
}

const BRIEF_TYPES = ["string", "boolean", "object"];
/** The backend module a picker searches: without it the field is left out of the form. */
export const PICKER_MODULES = { "pim-product": "pim" };
const DEFAULTS = { boolean: false, object: null };

export const initialBrief = (fields) => Object.fromEntries(fields.map((field) => [field.key, field.default]));

/** Whether a field shows: always, or while the field it depends on (`visibleIf`) is on. */
export const isFieldVisible = (field, values) => !field.visibleIf || Boolean(values?.[field.visibleIf]);

/** Whether a field must be filled: required by the schema, or shown because the field it depends on is on. */
export const isFieldRequired = (field, values) => field.required || (Boolean(field.visibleIf) && isFieldVisible(field, values));

/** A brief value as the API takes it, undefined when empty: `true` (never `false`), a picked object, trimmed text. */
function briefValue(value) {
  if (typeof value === "boolean") return value || undefined;
  if (value && typeof value === "object") return value.ref ? value : undefined;
  return String(value ?? "").trim() || undefined;
}

/** Whether the operator gave a value (an unchecked box and an empty pick are no value). */
export const briefHasValue = (value) => briefValue(value) !== undefined;

/** The first problem of one brief value: required | too_short | too_long | format, or "". */
export function briefFieldError(field, raw) {
  if (field.type === "boolean") return "";
  if (field.type === "object") return field.required && !briefHasValue(raw) ? "required" : "";
  const value = String(raw ?? "").trim();
  if (!value) return field.required ? "required" : "";
  if (field.minLength != null && value.length < field.minLength) return "too_short";
  if (field.maxLength != null && value.length > field.maxLength) return "too_long";
  return matchesPattern(field.pattern, value) ? "" : "format";
}

// A schema pattern JavaScript cannot compile is left to the server, which validates the brief anyway.
function matchesPattern(pattern, value) {
  if (!pattern) return true;
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    return true;
  }
}

/** { field key: error code } of the brief's shown fields; empty when it can be sent. */
export function briefErrors(fields, values) {
  const errors = {};
  for (const field of fields.filter((f) => isFieldVisible(f, values))) {
    const error = briefFieldError({ ...field, required: isFieldRequired(field, values) }, values[field.key]);
    if (error) errors[field.key] = error;
  }
  return errors;
}

/** The brief as the API takes it: empty values and the values of hidden fields left out. */
export function cleanBrief(values, fields = []) {
  const hidden = new Set(fields.filter((field) => !isFieldVisible(field, values)).map((field) => field.key));
  const entries = Object.entries(values).filter(([key]) => !hidden.has(key));
  return Object.fromEntries(entries.map(([key, value]) => [key, briefValue(value)]).filter(([, value]) => value !== undefined));
}

/** Which renderer a step output takes: questions | document | cover | keywords | meta | scenes | text | data. */
export function outputKind(step, value) {
  if (step?.output === "questions") return "questions";
  if (step?.output === "document") return "document";
  if (step?.output === "image") return "cover";
  if (typeof value?.text === "string") return "text";
  const data = value?.data;
  if (Array.isArray(data?.candidates) || typeof data?.primary === "string") return "keywords";
  if (typeof data?.title === "string" && typeof data?.description === "string") return "meta";
  if (Array.isArray(data?.scenes)) return "scenes";
  return "data";
}

/** The ids of the questions that still need an answer (not optional, blank); none with a minimum of answers — then
 * any answers count (`answersShort`). */
export function missingAnswers(questions, answers, minimum = 0) {
  if (minimum > 0) return [];
  return (questions || [])
    .filter((question) => !question.optional && !String(answers?.[question.id] ?? "").trim())
    .map((question) => question.id);
}

/** A question's controls: a choice question with choices is a pick, everything else free text. */
export const isChoice = (question) => question.type === "choice" && (question.choices || []).length > 0;

/** "primary" | "secondary" | "" — what a phrase is in the search-phrase artifact. */
export function keywordRole(data, phrase) {
  if (data?.primary === phrase) return "primary";
  return (data?.secondary || []).includes(phrase) ? "secondary" : "";
}

/**
 * The artifact with `phrase` picked as `role` (primary | secondary | skip): primary replaces the primary, secondary
 * adds it (at most two), skip drops it. The main phrase changes only by picking another one. The same object comes
 * back when nothing changes (the caller saves nothing).
 */
export function pickKeyword(data, phrase, role) {
  const current = keywordRole(data, phrase) || "skip";
  if (current === "primary" || role === current) return data;
  const secondary = (data?.secondary || []).filter((item) => item !== phrase);
  if (role === "primary") return { ...data, primary: phrase, secondary };
  if (role === "skip") return { ...data, secondary };
  if (role !== "secondary" || secondary.length >= MAX_SECONDARY) return data;
  return { ...data, secondary: [...secondary, phrase] };
}

/** The phrases the table lists: the candidates, else the primary and secondary ones the artifact names. */
export function keywordRows(data) {
  if (Array.isArray(data?.candidates) && data.candidates.length) return data.candidates;
  const named = [data?.primary, ...(data?.secondary || [])].filter(Boolean);
  return named.map((phrase) => ({ phrase, volume: null, intent: data?.intent || "", serp_notes: "" }));
}

/** The CMS route of the draft a finished run created, or null before it exists. */
export function draftRoute(run) {
  if (!run?.subject_ref) return null;
  return { name: "Builder", params: { content_type: "content", type: DOCUMENT_TYPE, uid: run.subject_ref } };
}

/** Words of a markdown text (a document summary). */
export const wordCount = (text) => (String(text || "").match(/[\p{L}\p{N}]+/gu) || []).length;

/** Words and whole reading minutes (at least one) of a text step. */
export function readingStats(text) {
  const words = wordCount(text);
  return { words, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) };
}

/** How many questions have an answer. */
export const answeredCount = (questions, answers) =>
  (questions || []).filter((question) => String(answers?.[question.id] ?? "").trim()).length;

/** How many more answers the step needs: `min_answers` of the artifact, capped at the number of questions. */
export function answersShort(questions, answers, minimum) {
  const needed = Math.min(Number(minimum) || 0, (questions || []).length);
  return Math.max(0, needed - answeredCount(questions, answers));
}

/** "m:ss" of a duration in milliseconds (never negative). */
export function elapsedLabel(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The error code a failed step's task recorded, "" when none. */
export const failureCode = (task) => task?.errors?.[0]?.code || "";
