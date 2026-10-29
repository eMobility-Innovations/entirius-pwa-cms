import { t } from "@/i18n";
import { pluralKey } from "@/utils/plural";

// The AI work of one product: which tasks still run or just finished, what each one came to in plain words, and
// which of them still matter (the rest is history).

const ACTIVE = ["open", "in_progress"];

export const isActive = (task) => ACTIVE.includes(task?.status);

/** Tasks that were running in `before` and are no longer running in `after` — finished while watched. */
export function finishedTasks(before, after) {
  const wasActive = new Set(before.filter(isActive).map((task) => task.id));
  return after.filter((task) => wasActive.has(task.id) && !isActive(task));
}

/** The languages a task works in: its `languages`, or the `target_languages` of a translation. */
export function taskLanguages(task) {
  const params = task?.params || {};
  return params.languages || params.target_languages || [];
}

const toReview = (task) => (task.proposal_counts?.pending || 0) + (task.proposal_counts?.drifted || 0);

function finishedState(counts) {
  if (counts.applied) return { state: "applied", count: counts.applied };
  if (counts.rejected) return { state: "rejected" };
  if (counts.superseded) return { state: "replaced" };
  return { state: "nothing" };
}

/** An open task the internal worker has not picked up yet: `queued_ahead` counts the runs before it in its lane
 * (null once it runs, and for an external worker — that one shows as running). */
export const isQueued = (task) => task?.status === "open" && Number.isInteger(task?.queued_ahead);

/** { state, count?, failed?, code?, errorId? } — state: queued · running · review · applied · rejected · replaced ·
 * nothing · cancelled · failed. A queued task's `count` is the runs ahead of it; a done task with failed subjects
 * carries `failed` and the first reason. */
export function taskOutcome(task) {
  if (isQueued(task)) return { state: "queued", count: task.queued_ahead };
  if (isActive(task)) return { state: "running" };
  if (task.status === "cancelled") return { state: "cancelled" };
  const [error] = task.errors || [];
  // Tasks from before failure reasons were recorded carry none.
  const reason = { code: error?.code || "NOT_RECORDED", errorId: error?.error_id || "" };
  if (task.status === "failed") return { state: "failed", ...reason };
  const review = toReview(task);
  const base = review ? { state: "review", count: review } : finishedState(task.proposal_counts || {});
  const failed = task.counts?.failed || 0;
  return failed ? { ...base, failed, ...reason } : base;
}

/** Whether Try again applies: the task failed, or it is done with failed products. A running, queued or cancelled
 * task has nothing failed to run again. */
export function isRetryable(task) {
  const { state, failed } = taskOutcome(task);
  return state === "failed" || !!failed;
}

function queuedText(ahead) {
  if (!ahead) return t("enrichment.ai.outcome.queued_next");
  return t(`enrichment.ai.outcome.queued_${pluralKey(ahead)}`, { count: ahead });
}

// The kind-specific name of the code (translate + PROVIDER_NOT_CONFIGURED = the translator), else the generic one,
// else a code-free sentence — never the code itself.
function failureReason({ code, errorId }, worker) {
  const known = [`${worker?.kind}_${code}`, code]
    .map((key) => `enrichment.ai.error.${key}`)
    .find((path) => t(path) !== path);
  return t(known || "enrichment.ai.error.unknown", { id: errorId });
}

/** What a task came to, in plain words: "3 proposals to review", "Queued — 2 runs ahead", "Failed: <reason>"; a done
 * task with failed products says so after it. `worker` names the reason by its kind. */
export function outcomeText(task, worker = null) {
  const outcome = taskOutcome(task);
  const { state, count = 0, failed } = outcome;
  if (state === "failed") return t("enrichment.ai.outcome.failed", { reason: failureReason(outcome, worker) });
  if (state === "queued") return queuedText(count);
  const text = t(`enrichment.ai.outcome.${state === "review" ? `review_${pluralKey(count)}` : state}`, { count });
  if (!failed) return text;
  return `${text} · ${t("enrichment.ai.outcome.partly_failed", { count: failed, reason: failureReason(outcome, worker) })}`;
}

const RANK = { running: 0, queued: 1, review: 2, failed: 3 };

/** `current`: running, queued, waiting for review, or the latest run of its worker that failed — in that order.
 * `history`: everything already handled. Tasks come newest first. */
export function groupTasks(tasks) {
  const latestOfType = new Map();
  for (const task of tasks) if (!latestOfType.has(task.type)) latestOfType.set(task.type, task.id);
  const matters = (task) => {
    const { state } = taskOutcome(task);
    if (state === "failed") return latestOfType.get(task.type) === task.id;
    return state in RANK;
  };
  const current = tasks.filter(matters).sort((a, b) => RANK[taskOutcome(a).state] - RANK[taskOutcome(b).state]);
  return { current, history: tasks.filter((task) => !matters(task)) };
}

/** A task in people's words: the template it ran from, else its worker; "" when neither is known (never its key). */
export function taskLabel(task, workers = [], templates = []) {
  const template = templates.find((t) => t.key === task?.params?.template);
  return template?.label || workers.find((w) => w.key === task?.type)?.label || "";
}
