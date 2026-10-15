import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { t } from "@/i18n";
import { pluralKey } from "@/utils/plural";
import { GET_Proposals, GET_Tasks } from "@/api/enrichment/api";
import { runName } from "@/views/EnrichmentReview/runLabel";
import { finishedTasks, isActive } from "./productAi";

export const POLL_MS = 4000;
const RECENT_TASKS = 10;
const MAX_PROPOSALS = 50;

// The AI work of one PIM product (`sku` a ref): its pending proposals and its recent tasks. While a task runs the tasks are
// polled; a task that finishes reloads the proposals and says so in a toast. Once the product's view is gone nothing
// polls or toasts any more, also for a read that was on its way. `nameOf(task)` names a run in the toasts.
export function useProductAi(sku, nameOf = (task) => runName(task)) {
  const notify = useNotifyStore();
  const proposals = ref([]);
  const tasks = ref([]);
  const loading = ref(false);
  const running = computed(() => tasks.value.some(isActive));
  let timer = null;
  let disposed = false;

  const scope = () => ({ subject_ref: sku.value, target_module: "pim" });

  async function loadProposals() {
    const { data } = await GET_Proposals({ ...scope(), status: "pending", page_size: MAX_PROPOSALS });
    proposals.value = data.results || [];
  }

  async function loadTasks() {
    const { data } = await GET_Tasks({ ...scope(), page_size: RECENT_TASKS });
    if (disposed) return;
    const finished = finishedTasks(tasks.value, data.results || []);
    tasks.value = data.results || [];
    if (finished.length) await loadProposals();
    finished.forEach(announce);
  }

  function announce(task) {
    const done = task.status === "done";
    const msg = done ? doneMessage(task.counts || {}) : t("enrichment.ai.task_failed", { name: nameOf(task) });
    notify.spawnNotification({ type: done ? "positive" : "negative", msg });
  }

  function schedule() {
    clearTimeout(timer);
    if (running.value && !disposed) timer = setTimeout(syncTasks, POLL_MS);
  }

  /** Re-read the tasks quietly (no loader): the poll, and after a review action changed their proposal counts. */
  async function syncTasks() {
    try {
      await loadTasks();
    } catch {
      // A transient failure: the state stays as it was, the next poll retries.
    } finally {
      schedule();
    }
  }

  async function refresh() {
    loading.value = true;
    try {
      await Promise.all([loadProposals(), loadTasks()]);
    } catch (err) {
      notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, t("notifications.error")) });
    } finally {
      loading.value = false;
      schedule();
    }
  }

  /** A task just spawned for this product: show it at once and start watching it. */
  function track(task) {
    tasks.value = [task, ...tasks.value.filter((known) => known.id !== task.id)];
    schedule();
  }

  watch(sku, (ref) => ref && refresh(), { immediate: true });
  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(timer);
  });
  return { proposals, tasks, loading, running, refresh, track, syncTasks };
}

// The finished-run toast; fields the run left alone because the operator had edited their proposal are named too.
function doneMessage(counts) {
  const msg = t("enrichment.ai.task_done", { count: counts.proposed ?? 0 });
  const kept = counts.kept_edited ?? 0;
  return kept ? `${msg} ${t(`enrichment.ai.kept_edited_${pluralKey(kept)}`, { count: kept })}` : msg;
}
