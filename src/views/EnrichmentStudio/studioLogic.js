// Studio helpers (contract A4 § 6): the steps rail, the brief form from a workflow's inputs schema, the questions
// form, the search-phrase pick and where a finished run's document opens. Pure functions — the views render them.

const STEP_LOOK = {
  waiting: { icon: "scheduled", tone: "neutral" },
  running: { icon: "running", tone: "info" },
  review: { icon: "preview", tone: "warning" },
  approved: { icon: "success", tone: "positive" },
  failed: { icon: "warning", tone: "negative" },
};

const RUN_TONES = { running: "info", waiting: "warning", done: "positive", failed: "negative", cancelled: "neutral" };

// The content type a workflow document lands in. Coupled to django-contentdb `CONTENTDB_ENRICHMENT_DOCUMENT_TYPE`
// (default "blog-post") until the run carries its draft's type — docs/panels-routing.md.
export const DOCUMENT_TYPE = "blog-post";
export const MAX_SECONDARY = 2;
const LONG_TEXT = 300;
// A run that has not changed for this long while a step is marked running has likely lost its task.
export const STALE_MS = 3 * 60 * 1000;
const CLOSED_RUN = ["done", "cancelled"];

/** The icon and tone of a step state. */
export const stepLook = (status) => STEP_LOOK[status] || STEP_LOOK.waiting;

/** The rail: one item per step with its status icon and tone; `current` marks the run's first open step. */
export function railItems(run) {
  return (run?.steps || []).map((step) => ({
    key: step.key,
    label: step.label,
    status: step.status,
    ...stepLook(step.status),
    current: step.key === run.current_step,
  }));
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

/** The label of the run's current step ("" when every step is approved). */
export function currentStepLabel(run) {
  return (run?.steps || []).find((step) => step.key === run.current_step)?.label || "";
}

/** What people call a run: its working title, else its topic, else the workflow's name. */
export function runTitle(run) {
  const inputs = run?.inputs || {};
  return inputs.title || inputs.topic || run?.definition_label || "";
}

/** The brief form of an inputs schema: one field per property, required ones first in the schema's order. */
export function briefFields(schema) {
  const required = schema?.required || [];
  const fields = Object.entries(schema?.properties || {}).map(([key, prop]) => ({
    key,
    label: prop.title || key,
    required: required.includes(key),
    multiline: (prop.maxLength || 0) > LONG_TEXT,
    minLength: prop.minLength ?? null,
    maxLength: prop.maxLength ?? null,
    pattern: prop.pattern || "",
    default: prop.default ?? "",
  }));
  return [...fields.filter((f) => f.required), ...fields.filter((f) => !f.required)];
}

export const initialBrief = (fields) => Object.fromEntries(fields.map((field) => [field.key, field.default]));

/** The first problem of one brief value: required | too_short | too_long | format, or "". */
export function briefFieldError(field, raw) {
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

/** { field key: error code } of the brief; empty when it can be sent. */
export function briefErrors(fields, values) {
  const errors = {};
  for (const field of fields) {
    const error = briefFieldError(field, values[field.key]);
    if (error) errors[field.key] = error;
  }
  return errors;
}

/** The brief as the API takes it: trimmed, empty values left out. */
export function cleanBrief(values) {
  const entries = Object.entries(values).map(([key, value]) => [key, String(value ?? "").trim()]);
  return Object.fromEntries(entries.filter(([, value]) => value));
}

/** Which renderer a step output takes: questions | document | keywords | meta | text | data. */
export function outputKind(step, value) {
  if (step?.output === "questions") return "questions";
  if (step?.output === "document") return "document";
  if (typeof value?.text === "string") return "text";
  const data = value?.data;
  if (Array.isArray(data?.candidates) || typeof data?.primary === "string") return "keywords";
  if (typeof data?.title === "string" && typeof data?.description === "string") return "meta";
  return "data";
}

/** The ids of the questions that still need an answer (not optional, blank). */
export function missingAnswers(questions, answers) {
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
 * The artifact with `phrase` picked as `role`: primary replaces the primary; secondary toggles (at most two). The same
 * object comes back when nothing changes (the caller saves nothing).
 */
export function pickKeyword(data, phrase, role) {
  if (data?.primary === phrase) return data;
  const secondary = (data?.secondary || []).filter((item) => item !== phrase);
  if (role === "primary") return { ...data, primary: phrase, secondary };
  if (role !== "secondary") return data;
  const picked = keywordRole(data, phrase) === "secondary";
  if (picked) return { ...data, secondary };
  if (secondary.length >= MAX_SECONDARY) return data;
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
