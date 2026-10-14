import { GET_ProfileVersions } from "@/api/enrichment/api";

// "Likely used from profile: Tone, Facts (4)" under a proposal (contract A4 § 2): which profile sections the task's
// prompt was given, worked out from the profile versions the task stamped (`profile_versions`: instance + channel
// overlay snapshots) — their routing, else the defaults per kind, kept only where the snapshot has content.
// An approximation of `profile_service.context_for`, which does not record its choice; the note says so.

const DEFAULT_ROUTING = {
  write: ["brand", "persona", "tone", "language", "facts"],
  pick: ["brand", "language"],
  generate: ["brand", "persona", "tone", "language", "facts", "proof", "seo"],
  questions: ["brand", "facts"],
};
const ORDER_FIRST = ["facts", "brand"];

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

// Snapshots never change, so a used profile is fetched once per channel and version set.
const cache = new Map();

async function fetchUsedProfile(channel, versionIds) {
  const scopes = channel ? ["", channel] : [""];
  const answers = await Promise.all(scopes.map((scope) => GET_ProfileVersions({ channel: scope })));
  const [base, overlay] = answers.map(({ data }) => (data || []).find((v) => versionIds.includes(v.id))?.data);
  return base || overlay ? mergeProfiles(base, overlay) : null;
}

/** The merged snapshots a task's prompt used; null when unavailable (a failure is not remembered). */
export function loadUsedProfile(channel, versionIds) {
  const key = `${channel}:${versionIds.join(",")}`;
  if (!cache.has(key)) {
    const promise = fetchUsedProfile(channel, versionIds).catch(() => {
      cache.delete(key);
      return null;
    });
    cache.set(key, promise);
  }
  return cache.get(key);
}

/** Test seam: forget the cached profiles. */
export const clearProfileCache = () => cache.clear();
