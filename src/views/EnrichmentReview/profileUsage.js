import { GET_Profile } from "@/api/enrichment/api";

// "Used from profile: Tone, Facts (4)" under a proposal (contract A4 § 2): which profile sections the task's prompt
// was given — the routing of the merged profile (instance + channel overlay), else the defaults per kind, kept only
// where the profile has content. Mirrors `profile_service.context_for`; the task's `profile_versions` say whether a
// profile was used at all.

const DEFAULT_ROUTING = {
  write: ["brand", "persona", "tone", "language", "facts"],
  pick: ["brand", "language"],
  generate: ["brand", "persona", "tone", "language", "facts", "proof", "seo"],
  questions: ["brand", "facts"],
};
const ORDER_FIRST = ["facts", "brand"];
const CACHE_MS = 60000;

const hasContent = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasContent);
  return typeof value === "string" ? value.trim() !== "" : value != null;
};

/** The instance data with the overlay's non-empty sections on top (a whole section replaces the instance's). */
export function mergeProfiles(base, overlay) {
  const own = Object.entries(overlay || {}).filter(([, value]) => hasContent(value));
  return { ...(base || {}), ...Object.fromEntries(own) };
}

/** The routed sections with content, facts and brand first: [{ key, count? }] (count = facts in the registry). */
export function usedSections({ data, taskType, kind }) {
  const routing = data?.routing || {};
  const keys = routing[taskType] || routing[kind] || DEFAULT_ROUTING[kind] || ["brand"];
  const ordered = [...ORDER_FIRST.filter((key) => keys.includes(key)), ...keys.filter((key) => !ORDER_FIRST.includes(key))];
  return ordered
    .filter((key) => hasContent(data?.[key]))
    .map((key) => (key === "facts" ? { key, count: data.facts.length } : { key }));
}

const cache = new Map();

/** The merged profile of a channel, fetched once a minute for every card of a screen; null when unavailable. */
export function loadMergedProfile(channel = "") {
  const hit = cache.get(channel);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const scopes = channel ? ["", channel] : [""];
  const promise = Promise.all(scopes.map((scope) => GET_Profile({ channel: scope })))
    .then(([base, overlay]) => mergeProfiles(base.data.data, overlay?.data.data))
    .catch(() => null);
  cache.set(channel, { at: Date.now(), promise });
  return promise;
}

/** Test seam: forget the cached profiles. */
export const clearProfileCache = () => cache.clear();
