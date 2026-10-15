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

/** { state, count?, failed?, code?, errorId? } — state: running · review · applied · rejected · replaced · nothing ·
 * cancelled · failed. A done task with failed subjects carries `failed` and the first reason. */
export function taskOutcome(task) {
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

const RANK = { running: 0, review: 1, failed: 2 };

/** `current`: running, waiting for review, or the latest run of its worker that failed — in that order.
 * `history`: everything already handled. Tasks come newest first. */
export function groupTasks(tasks) {
  const latestOfType = new Map();
  for (const task of tasks) if (!latestOfType.has(task.type)) latestOfType.set(task.type, task.id);
  const matters = (task) => {
    const { state } = taskOutcome(task);
    return state === "running" || state === "review" || (state === "failed" && latestOfType.get(task.type) === task.id);
  };
  const current = tasks.filter(matters).sort((a, b) => RANK[taskOutcome(a).state] - RANK[taskOutcome(b).state]);
  return { current, history: tasks.filter((task) => !matters(task)) };
}

/** A task in people's words: the template it ran from, else its worker; "" when neither is known (never its key). */
export function taskLabel(task, workers = [], templates = []) {
  const template = templates.find((t) => t.key === task?.params?.template);
  return template?.label || workers.find((w) => w.key === task?.type)?.label || "";
}
