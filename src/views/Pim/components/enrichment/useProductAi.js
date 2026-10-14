import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { t } from "@/i18n";
import { GET_Proposals, GET_Tasks } from "@/api/enrichment/api";
import { finishedTasks, isActive } from "./productAi";

export const POLL_MS = 4000;
const RECENT_TASKS = 10;
const MAX_PROPOSALS = 50;

// The AI work of one PIM product (`sku` a ref): its pending proposals and its recent tasks. While a task runs the tasks are
// polled; a task that finishes reloads the proposals and says so in a toast.
export function useProductAi(sku) {
  const notify = useNotifyStore();
  const proposals = ref([]);
  const tasks = ref([]);
  const loading = ref(false);
  const running = computed(() => tasks.value.some(isActive));
  let timer = null;

  const scope = () => ({ subject_ref: sku.value, target_module: "pim" });

  async function loadProposals() {
    const { data } = await GET_Proposals({ ...scope(), status: "pending", page_size: MAX_PROPOSALS });
    proposals.value = data.results || [];
  }

  async function loadTasks() {
    const { data } = await GET_Tasks({ ...scope(), page_size: RECENT_TASKS });
    const finished = finishedTasks(tasks.value, data.results || []);
    tasks.value = data.results || [];
    if (finished.length) await loadProposals();
    finished.forEach(announce);
  }

  function announce(task) {
    const done = task.status === "done";
    const msg = done
      ? t("enrichment.ai.task_done", { count: task.counts?.proposed ?? 0 })
      : t("enrichment.ai.task_failed", { id: task.id });
    notify.spawnNotification({ type: done ? "positive" : "negative", msg });
  }

  function schedule() {
    clearTimeout(timer);
    if (running.value) timer = setTimeout(syncTasks, POLL_MS);
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
  onBeforeUnmount(() => clearTimeout(timer));
  return { proposals, tasks, loading, running, refresh, track, syncTasks };
}
