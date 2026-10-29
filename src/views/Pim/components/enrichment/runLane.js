import { t } from "@/i18n";
import { pluralKey } from "@/utils/plural";

// Run lanes of a task (django-enrichment): "now" = the express lane, "queue" = the normal queue.
export const LANE_NOW = "now";
export const LANE_QUEUE = "queue";
// Mirrors ENRICHMENT_RUN_NOW_MAX_SUBJECTS (backend default): above it the server refuses "now" with a 400.
export const RUN_NOW_MAX = 20;

/** One product runs now; a selection goes to the queue. */
export const defaultLane = (count) => (count === 1 ? LANE_NOW : LANE_QUEUE);

export const canRunNow = (count) => count <= RUN_NOW_MAX;

/** What happened to a spawned task, in plain words: running now, queued (and how many runs wait before it). */
export function laneMessage(task) {
  const ahead = task?.queued_ahead || 0;
  if (ahead) return t(`enrichment.ai.lane.queued_${pluralKey(ahead)}`, { count: ahead });
  return task?.lane === LANE_NOW ? t("enrichment.ai.lane.running_now") : t("enrichment.ai.lane.starts_next");
}

/** The toast after a spawn: the lane message, plus the products skipped because the same run is already going. */
export function spawnToast(task) {
  const skipped = task?.skipped_in_flight?.length || 0;
  if (!skipped) return { type: "positive", msg: laneMessage(task) };
  const note = t(`enrichment.ai.lane.skipped_${pluralKey(skipped)}`, { count: skipped });
  return { type: "informative", msg: `${laneMessage(task)} ${note}` };
}
