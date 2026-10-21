import { ref } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { t } from "@/i18n";
import { POST_RetryTask } from "@/api/enrichment/api";
import { spawnToast } from "@/views/Pim/components/enrichment/runLane";

// "Try again" on a failed AI task (a product's AI drawer, the Runs page): the failed products run again as a NEW task,
// the failed one stays in the history. One request per task at a time (`retrying` holds the ids on their way; a second
// click while one is out sends nothing). `retry(task)` answers the new task — the caller shows and watches it as it
// does a task started from a template — or null when it was refused (the API's message is toasted) or already on its way.
export function useTaskRetry() {
  const notify = useNotifyStore();
  const retrying = ref([]);

  async function retry(task) {
    if (retrying.value.includes(task.id)) return null;
    retrying.value = [...retrying.value, task.id];
    try {
      const { data } = await POST_RetryTask(task.id);
      notify.spawnNotification(spawnToast(data));
      return data;
    } catch (err) {
      notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, t("notifications.error")) });
      return null;
    } finally {
      retrying.value = retrying.value.filter((id) => id !== task.id);
    }
  }

  return { retrying, retry };
}
