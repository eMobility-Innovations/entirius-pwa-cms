import { computed, ref } from "vue";
import { GET_Task, GET_Templates, GET_Workers } from "@/api/enrichment/api";
import { runName, runTitle } from "./runLabel";
import { listOf } from "@/api/enrichment/listOf";

// The AI runs behind the proposals on a page, labelled for people (runLabel.js): `load(ids)` fetches the runs not
// known yet (a failed one stays unlabelled, never asked again here); `labels` = { [taskId]: { name, title, at } } —
// `name` what ran, `title` with what it covered, `at` when it started. Worker and template names load once.
export function useRunLabels() {
  const tasks = ref({});
  const workers = ref([]);
  const templates = ref([]);
  let names = null;

  function loadNames() {
    names ??= Promise.all([GET_Workers(), GET_Templates()])
      .then(([w, tpl]) => {
        workers.value = listOf(w.data);
        templates.value = listOf(tpl.data);
      })
      .catch(() => {}); // without names a run reads "AI task"
    return names;
  }

  async function load(ids) {
    loadNames();
    const known = (id) => id in tasks.value;
    const missing = [...new Set(ids.filter((id) => id != null && id !== "").map(String))].filter((id) => !known(id));
    const answers = await Promise.allSettled(missing.map((id) => GET_Task(id)));
    const loaded = Object.fromEntries(missing.map((id, i) => [id, answers[i].value?.data || null]));
    tasks.value = { ...tasks.value, ...loaded };
  }

  const labels = computed(() =>
    Object.fromEntries(
      Object.entries(tasks.value)
        .filter(([, task]) => task)
        .map(([id, task]) => [
          id,
          { name: runName(task, workers.value, templates.value), title: runTitle(task, workers.value, templates.value), at: task.created_at },
        ])
    )
  );

  return { labels, load };
}
