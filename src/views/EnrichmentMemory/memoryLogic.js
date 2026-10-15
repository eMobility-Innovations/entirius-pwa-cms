// The memory list's pure helpers (contract A4 § 3): what waits for the operator first, what expired, where a
// suggestion goes in the profile, an SEO brief in readable parts. The components render what these return.

export const KINDS = ["seo_brief", "answer", "rule_suggestion", "fact_suggestion"];
export const STATUSES = ["active", "dismissed", "promoted"];
export const EXPIRY = ["all", "current", "expired"];
const SUGGESTIONS = ["rule_suggestion", "fact_suggestion"];
// What a memory entry is about, in words, per module of its subject; the subject's own ref is never shown.
const SUBJECTS = { pim: "catalogue", contentdb: "page", enrichment: "studio_run", atlas: "market" };

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

/** The suggestion kinds to pin above the list for the kind and state filters (none when they exclude waiting ones). */
export function pinnedKinds(kind, status) {
  if (status && status !== "active") return [];
  return kind ? SUGGESTIONS.filter((k) => k === kind) : SUGGESTIONS;
}

/** Entries of several answers, newest first. */
export const newestFirst = (entries) => [...entries].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

/** The i18n key under `enrichment.memory.subject` naming what an entry is about. */
export function subjectKey(entry) {
  if (!entry.subject_ref) return "general";
  if (entry.subject_ref.startsWith("run:")) return "studio_run";
  return SUBJECTS[entry.subject_module] || "item";
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

const RUN_REF = /^run:([0-9a-f]+)$/;
const PROPOSAL_REF = /^proposal:(\d+)$/;

/** Where an entry came from, as a link: its Studio article, the proposal it was taken from, or its product; else null. */
export function originLink(entry) {
  const run = RUN_REF.exec(entry.subject_ref || "")?.[1] || RUN_REF.exec(entry.source || "")?.[1] || entry.data?.run;
  if (run) return { label: "open_run", to: { name: "EnrichmentStudioRun", params: { uid: run } } };
  const proposal = PROPOSAL_REF.exec(entry.source || "")?.[1];
  if (proposal) return { label: "open_proposal", to: { name: "EnrichmentProposalEditor", params: { proposalId: proposal } } };
  const sku = entry.subject_module === "pim" && !String(entry.subject_ref || "").includes(":") ? entry.subject_ref : "";
  return sku ? { label: "open_product", to: { name: "PimProductDetail", params: { sku } } } : null;
}
