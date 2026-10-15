import { diffArrays, diffWords } from "diff";

// Review helpers: the word diff, HTML detection, grouping by product, the worker of a proposal and the source text
// of a translation. Pure functions — the components render what these return.

const asText = (value) => (value == null ? "" : typeof value === "string" ? value : JSON.stringify(value));

/** [{ text, type }] with type same · added · removed, word by word. */
export function wordDiff(before, after) {
  return diffWords(asText(before), asText(after)).map((part) => ({
    text: part.value,
    type: part.added ? "added" : part.removed ? "removed" : "same",
  }));
}

export function isHtml(value) {
  return typeof value === "string" && /<([a-z][a-z0-9]*)\b[^>]*>/i.test(value);
}

/** Proposals grouped by their subject (a PIM SKU), in the order the list has them; a product is titled by its name
 * and SKU, as on a list row ("Orion lamp · ENT-S001"), a Studio article by its title. */
export function groupBySubject(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.subject_ref)) {
      const label = runUidOf(row) ? row.subject_label || row.subject_ref : subjectName(row);
      groups.set(row.subject_ref, { subjectRef: row.subject_ref, label, proposals: [] });
    }
    groups.get(row.subject_ref).proposals.push(row);
  }
  return [...groups.values()];
}

/** `worker:<key>@v<n>` → "<key>@v<n>"; any other source → "". */
export function workerOf(source) {
  const match = /^worker:(.+@v\d+)$/.exec(source || "");
  return match ? match[1] : "";
}

/** The source language when the proposal is a translation from another language, else "". */
export function translationSource(task, proposal) {
  const source = task?.params?.source_language || "";
  const target = proposal.target_locator?.language || "";
  return source && target && source !== target ? source : "";
}

/** The value of a PIM field in one language: a system field (`<idx>_t9n`) or a text attribute. */
export function sourceText(product, featureIdx, language) {
  if (!product || !featureIdx) return "";
  const system = product[`${featureIdx}_t9n`];
  if (system) return system[language] || "";
  const attribute = (product.attributes || []).find((a) => a.feature_idx === featureIdx);
  return attribute?.value_txt_t9n?.[language] || "";
}

/** An editable proposal carries its value as `{ text }`. */
export function editableText(proposal) {
  const text = proposal?.proposed_value?.text;
  return typeof text === "string" ? text : null;
}

/** Nothing there yet: null, "", whitespace or an empty paragraph — a proposal for it is new text, not a change. */
export function isBlank(value) {
  return !plainText(value).trim();
}

/** The visible text of a value (HTML tags dropped, entities decoded) — what a length counter counts. */
export function plainText(value) {
  const text = asText(value);
  if (!isHtml(text)) return text;
  return new DOMParser().parseFromString(text, "text/html").body.textContent || "";
}

const HTML_TOKEN = /<[^>]+>|\s+|[^<\s]+/g;
const isTag = (token) => token.startsWith("<");

/** Text runs of a diff part wrapped in `wrapper`; with `keepTags` the part's tags stay in place (insertions). */
function markRuns(tokens, wrapper, keepTags) {
  let out = "";
  let run = "";
  const flush = () => {
    if (run.trim()) out += `<${wrapper}>${run}</${wrapper}>`;
    else out += run;
    run = "";
  };
  for (const token of tokens) {
    if (!isTag(token)) {
      run += token;
      continue;
    }
    if (!keepTags) continue;
    flush();
    out += token;
  }
  flush();
  return out;
}

/** One HTML flow: the new markup, inserted words in <mark>, removed words in <del>. Sanitise before rendering. */
export function htmlDiff(before, after) {
  const tokens = (value) => asText(value).match(HTML_TOKEN) || [];
  return diffArrays(tokens(before), tokens(after))
    .map((part) => {
      if (part.added) return markRuns(part.value, "mark", true);
      if (part.removed) return markRuns(part.value, "del", false);
      return part.value.join("");
    })
    .join("");
}

const META_DESCRIPTION = { min: 120, max: 155, snippet: true };
const META_TITLE = { min: 30, max: 60, snippet: true };
const VARCHAR255_T9N = 4;

/** Length rules of a PIM text field: the meta description target, else the column limit of a short text. */
export function textRules(featureIdx, feature) {
  if (featureIdx === "meta_description") return META_DESCRIPTION;
  if (featureIdx === "meta_title") return META_TITLE;
  if (feature?.feature_type === VARCHAR255_T9N) return { max: 255 };
  return null;
}

const NEAR = 20;

/** positive inside the target, warning up to NEAR characters off it (or close to a hard max), negative beyond. */
export function lengthTone(length, { min, max }) {
  if (min == null) {
    if (length > max) return "negative";
    return length > max - NEAR ? "warning" : "positive";
  }
  if (length >= min && length <= max) return "positive";
  const off = length < min ? min - length : length - max;
  return off <= NEAR ? "warning" : "negative";
}

const MEDIA_KINDS = { video: "video", picture: "image", image: "image" };
const EXCERPT = 160;

/** The value a text proposal carries: `{ text }` (PIM convention), else the single value of its envelope. */
function textOf(value) {
  if (value == null || typeof value !== "object") return value;
  if ("text" in value) return value.text;
  const values = Object.values(value);
  return values.length === 1 ? values[0] : "";
}

/** A select value — `{ option }` (single) or `{ options }` (multi), contract A3 § 2 — else false. */
export function isOptionValue(value) {
  return !!value && typeof value === "object" && ("options" in value || "option" in value);
}

const optionList = (value) => (Array.isArray(value?.options) ? value.options : value?.option ? [value.option] : []);

/** { added, removed, kept } option values of a select proposal against what the product has now. */
export function optionChanges(proposed, current) {
  const after = optionList(proposed);
  const before = optionList(current);
  return {
    added: after.filter((value) => !before.includes(value)),
    removed: before.filter((value) => !after.includes(value)),
    kept: after.filter((value) => before.includes(value)),
  };
}

/** One list row's change, never the full preview: media → { media: icon, duration }; select → { tags: { added,
 * removed } } counts; text → { state, excerpt, length } with state new (nothing there before) or changed. */
const READ_FIRST = ["title", "topic", "text", "description", "question"];

/** The first readable text inside a structured value (a Studio step's output), never its JSON. */
function firstText(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const preferred = Array.isArray(value) ? [] : READ_FIRST.filter((key) => key in value).map((key) => value[key]);
  for (const part of [...preferred, ...Object.values(value)]) {
    const text = firstText(part);
    if (text.trim()) return text;
  }
  return "";
}

const RUN_PREFIX = "run:";

/** The Studio run uid of a proposal written by a Studio step (`subject_ref` "run:<uid>"), else "". */
export function runUidOf(proposal) {
  const ref = proposal?.subject_ref || "";
  return ref.startsWith(RUN_PREFIX) ? ref.slice(RUN_PREFIX.length) : "";
}

/** What a proposal is about, for a heading: its name and code ("Orion lamp · ENT-S001"), or whichever it has. */
export function subjectName(proposal) {
  const { subject_label: label, subject_ref: ref } = proposal || {};
  if (!label || label === ref) return ref || "";
  return ref ? `${label} · ${ref}` : label;
}

export function changeSummary(proposal) {
  const icon = MEDIA_KINDS[proposal.target_kind];
  if (icon) return { media: icon, duration: proposal.proposed_value?.duration_s ?? null };
  if (isOptionValue(proposal.proposed_value)) {
    const { added, removed } = optionChanges(proposal.proposed_value, proposal.current_snapshot);
    return { tags: { added: added.length, removed: removed.length } };
  }
  const text = textOf(proposal.proposed_value);
  const readable = typeof text === "string" && text ? text : firstText(proposal.proposed_value);
  const after = plainText(readable).replace(/\s+/g, " ").trim();
  const before = textOf(proposal.current_snapshot);
  return { state: isBlank(before) ? "new" : "changed", excerpt: after.slice(0, EXCERPT), length: after.length };
}
