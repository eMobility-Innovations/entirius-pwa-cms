// The memory list's pure helpers (contract A4 § 3): what waits for the operator first, what expired, where a
// suggestion goes in the profile, an SEO brief in readable parts. The components render what these return.

export const KINDS = ["seo_brief", "answer", "rule_suggestion", "fact_suggestion"];
export const STATUSES = ["active", "dismissed", "promoted"];
export const EXPIRY = ["current", "expired", "all"];
const SUGGESTIONS = ["rule_suggestion", "fact_suggestion"];

/** An expiry date in the past. */
export const isExpired = (entry, now = Date.now()) => !!entry.expires_at && Date.parse(entry.expires_at) <= now;

/** A suggestion still waiting for "Add to profile" or "Dismiss". */
export const isPendingSuggestion = (entry) => SUGGESTIONS.includes(entry.kind) && entry.status === "active";

/** The entries the expiry filter keeps: current (not expired), expired, or all. */
export function byExpiry(entries, mode, now = Date.now()) {
  if (mode === "current") return entries.filter((e) => !isExpired(e, now));
  if (mode === "expired") return entries.filter((e) => isExpired(e, now));
  return entries;
}

/** Waiting suggestions first, the rest after them, each group in the API's order (newest first). */
export function suggestionsFirst(entries) {
  return [...entries.filter(isPendingSuggestion), ...entries.filter((e) => !isPendingSuggestion(e))];
}

/** Where "Add to profile" puts it: a fact into facts, a rule with a pattern into the checked rules, else always-rules. */
export function promoteTarget(entry) {
  if (entry.kind === "fact_suggestion") return "facts";
  if (entry.kind !== "rule_suggestion") return null;
  return entry.data?.pattern ? "rules" : "always_rules";
}

/** An SEO brief's readable parts. */
export function briefOf(entry) {
  const data = entry.data || {};
  return {
    primary: data.primary || "",
    secondary: Array.isArray(data.secondary) ? data.secondary : [],
    intent: data.intent || "",
    language: data.language || "",
  };
}

/** The API filters of the toolbar: only what is set. */
export function memoryParams({ kind, status, subject, page, pageSize }) {
  const params = { page, page_size: pageSize };
  if (kind) params.kind = kind;
  if (status) params.status = status;
  if (subject?.trim()) params.subject_ref = subject.trim();
  return params;
}
