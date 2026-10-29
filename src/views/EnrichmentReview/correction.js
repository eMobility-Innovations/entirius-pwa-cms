// Correction helpers (contract A3 § 1): what a proposal can be corrected with, the request body, the error in plain
// words, the rules list and the version labels. Pure functions — the components render what these return.

const REVISABLE = ["pending", "drifted"];
const TEXT_ACTIONS = ["shorten", "expand", "formal", "casual", "fit_limit", "variants"];
export const MAX_RULES = 20;
export const MAX_RULE_LENGTH = 200;

/** "text" for `{ text }`, "select" for `{ option }` / `{ options }`, else null (media, JSON). */
export function valueShape(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.text === "string") return "text";
  return "option" in value || "options" in value ? "select" : null;
}

/** A pending (or drifted) text or select proposal takes a new version. */
export function revisable(proposal) {
  return REVISABLE.includes(proposal?.status) && valueShape(proposal?.proposed_value) !== null;
}

/** The quick actions of a value shape; a batch never asks for variants (nothing to pick from). */
export function quickActionsFor(shape, { batch = false } = {}) {
  if (shape !== "text") return [];
  return batch ? TEXT_ACTIONS.filter((key) => key !== "variants") : TEXT_ACTIONS;
}

/** The body of `revise`: only what was given; a selection narrows the scope to that fragment. */
export function reviseBody({ instruction = "", quickAction = null, selection = "" } = {}) {
  const body = {};
  if (instruction.trim()) body.instruction = instruction.trim();
  if (quickAction) body.quick_action = quickAction;
  if (selection) body.scope = { type: "selection", text: selection };
  return body;
}

const ERROR_KEYS = { REVISION_NOT_APPLICABLE: "enrichment.correct.error.not_applicable" };

/**
 * The i18n key of a known correction error code, else "" (the caller falls back to the API message). The client
 * rejects with the bare v2 body.
 */
export function reviseErrorKey(err) {
  return ERROR_KEYS[(err?.response?.data ?? err)?.error] || "";
}

/** The rules with `rule` added: trimmed, no duplicate, within the limits; `error` names what stopped it. */
export function addRule(rules, rule) {
  const text = (rule || "").trim();
  if (!text) return { rules, error: "" };
  if (text.length > MAX_RULE_LENGTH) return { rules, error: "too_long" };
  if (rules.includes(text)) return { rules, error: "" };
  if (rules.length >= MAX_RULES) return { rules, error: "too_many" };
  return { rules: [...rules, text], error: "" };
}

/** The value as text: `{ text }`, the picked option(s), else "". */
export function valueText(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.options)) return value.options.join(", ");
  return value.option == null ? "" : String(value.option);
}

const FACT_LABEL_MAX = 200;

/** The sentence of a text that holds `number` (tags dropped, at most 200 characters), "" when none does. */
export function sentenceWith(text, number) {
  const plain = (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const sentence = plain.split(/(?<=[.!?])\s/).find((part) => part.includes(number)) || "";
  return sentence.trim().slice(0, FACT_LABEL_MAX);
}

/** The value with its text replaced, keeping the rest of the envelope. */
export function withText(value, text) {
  return { ...(value || {}), text };
}

const RESTORED = /^#(\d+)$/;

// The fixed English instructions the API expands a quick action into (django-enrichment `revise_prompt.QUICK_ACTIONS`,
// joined to the operator's words by a blank line). A version stores the expanded text; the thread shows the label.
const QUICK_PROMPTS = {
  shorten: "Make the text noticeably shorter; keep the key information.",
  expand: "Expand the text with more useful detail; do not invent facts.",
  formal: "Rewrite the text in a more formal tone.",
  casual: "Rewrite the text in a more casual, friendly tone.",
  fit_limit: "Shorten the text so it fits the field's maximum length.",
  variants: "Propose alternative versions of the value.",
  fix_warnings: "Fix every problem listed in the warnings block; change nothing else.",
};

/** A stored instruction split into the quick action behind it (or null) and the operator's own words. */
export function splitInstruction(stored = "") {
  const text = (stored || "").trim();
  const match = Object.entries(QUICK_PROMPTS).find(([, prompt]) => text === prompt || text.startsWith(`${prompt}\n\n`));
  if (!match) return { quickAction: null, instruction: text };
  return { quickAction: match[0], instruction: text.slice(match[1].length).trim() };
}

/**
 * What a version says about itself: { author: ai | user | restore, restoredFrom?, quickAction, instruction,
 * fragment } — `fragment` is the selected text a correction was narrowed to.
 */
export function versionInfo(revision) {
  const restored = revision.author_kind === "restore" ? RESTORED.exec(revision.instruction || "") : null;
  if (restored) return { author: "restore", restoredFrom: Number(restored[1]), quickAction: null, instruction: "", fragment: "" };
  const fragment = revision.scope?.type === "selection" ? revision.scope.text || "" : "";
  return { author: revision.author_kind, ...splitInstruction(revision.instruction), fragment };
}

/** The selected text inside a textarea (or "" when the selection is collapsed). */
export function textareaSelection(el) {
  if (!el || typeof el.selectionStart !== "number") return "";
  return el.value.slice(el.selectionStart, el.selectionEnd).trim();
}

/** `fragment` when it occurs exactly once in `text` (a selection scope the API accepts), else "". */
export function uniqueFragment(text, fragment) {
  return fragment && text.split(fragment).length === 2 ? fragment : "";
}
