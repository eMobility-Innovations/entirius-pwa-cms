import { t } from "@/i18n";
import { pluralKey } from "@/utils/plural";

// The work queue in people's words: a run is split into small batches of products that workers pick up; a worker can
// be paused (by itself after failures, or on a spent AI budget) or have nobody taking its work. Never a key or a code.

export const COST_LIMIT = "COST_LIMIT";
const QUEUE = "enrichment.queue";

/** "12 of 20 batches done · 4 waiting · 2 working · 2 failed"; "" when the run has no batches (an older run). */
export function unitProgress(units) {
  const { queued = 0, leased = 0, done = 0, failed = 0, cancelled = 0 } = units || {};
  const total = queued + leased + done + failed + cancelled;
  if (!total) return "";
  const parts = [t(`${QUEUE}.units_done_${pluralKey(total)}`, { done, total })];
  const rest = [["waiting", queued], ["working", leased], ["failed", failed], ["cancelled", cancelled]];
  rest.filter(([, count]) => count).forEach(([key, count]) => parts.push(t(`${QUEUE}.units_${key}`, { count })));
  return parts.join(" · ");
}

/** A run its cost guard stopped. */
export const costStopped = (task) => (task?.errors || []).some((error) => error.code === COST_LIMIT);

/** Why a batch failed: the CMS's words for a known code, else the worker's own message, else a code-free sentence. */
export function unitError(error) {
  const known = `enrichment.ai.error.${error?.code}`;
  if (error?.code && t(known) !== known) return t(known, { id: error.error_id || "—" });
  return error?.message || t("enrichment.ai.error.unknown");
}

/** "Picked up by a worker" — an event the CMS has no words for reads as a plain queue update. */
export function eventName(event) {
  const path = `${QUEUE}.event.${event}`;
  return t(path) === path ? t(`${QUEUE}.event.other`) : t(path);
}

/** "after 3 tries". */
export const triesText = (attempts) => t(`${QUEUE}.tries_${pluralKey(attempts)}`, { count: attempts });

/** The worker rows the Runs header raises: paused, or work waiting with nobody taking it. */
export const workerAlerts = (rows) => (rows || []).filter((row) => row.state === "paused" || row.nobody_taking);

/** "<label> is paused: <reason>" or "Nobody is taking <label> work — 4 waiting for 20 min". */
export function workerAlertText(row) {
  if (row.state === "paused") return t("enrichment.workers.paused", { label: row.label, reason: row.paused_reason });
  const minutes = Math.max(1, Math.round((row.oldest_queued_age_s || 0) / 60));
  return t("enrichment.workers.nobody_taking", { label: row.label, count: row.queued_units, minutes });
}
