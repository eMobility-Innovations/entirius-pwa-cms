// Task progress: the counts a worker keeps on the task (`proposed`, `failed`, anything else it adds).
const FIRST = ["proposed", "failed"];

/** [[key, value]] with proposed and failed first, the other counts after them in their own order. */
export function orderedCounts(counts) {
  const entries = Object.entries(counts || {});
  const rank = ([key]) => (FIRST.includes(key) ? FIRST.indexOf(key) : FIRST.length);
  return entries.sort((a, b) => rank(a) - rank(b));
}

/** A running task refreshes the list; an open one too when the list shows that single task (just created). */
export function needsRefresh(tasks, single = false) {
  return tasks.some((task) => task.status === "in_progress" || (single && task.status === "open"));
}

const STATUS_TONE = { open: "info", in_progress: "warning", done: "positive", cancelled: "neutral", failed: "negative" };

/** The StatusBadge tone of a task status. */
export function taskStatusTone(status) {
  return STATUS_TONE[status] || "neutral";
}
