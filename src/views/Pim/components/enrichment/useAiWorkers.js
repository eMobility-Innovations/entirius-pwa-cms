import { computed, ref, watch } from "vue";
import { useConfigHealthStore } from "@/stores/configHealth";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { t } from "@/i18n";
import { AREAS } from "@/configs/areas";
import { useAccessStore } from "@/stores/access";
import { useAiUsageVisible } from "@/components/AiUsage/useAiUsage";
import { GET_Templates, GET_Workers } from "@/api/enrichment/api";
import { listOf } from "@/api/enrichment/listOf";

/** The templates a run can start from: active, of an active worker, in their order. */
export function runnableTemplates(templates, workers) {
  const known = new Set(workers.map((w) => w.key));
  return templates
    .filter((template) => template.active && known.has(template.worker_key))
    .sort((a, b) => a.position - b.position);
}

// The PIM AI actions: present while the enrichment module is on and its proposals area is readable (as the AI usage
// counter; hidden otherwise, nothing loads, nothing toasts), `writable` with write on that area, usable while the AI toolbox is
// (configHealth.aiUsable — the hint is <AiToolboxHint />). Workers and templates load once the module is known to be
// on; a failed worker load is toasted, so an empty menu is never a silent misconfiguration. `reloadTemplates` after one is
// saved from the run dialog. `module` = whose workers (the gallery asks for "contentdb").
export function useAiWorkers(module = "pim") {
  const access = useAccessStore();
  const health = useConfigHealthStore();
  const workers = ref([]);
  const allTemplates = ref([]);
  const enabled = useAiUsageVisible();
  const writable = computed(() => enabled.value && access.can(AREAS.ENRICHMENT_PROPOSALS, "write"));
  const usable = computed(() => enabled.value && health.aiUsable);
  const templates = computed(() => runnableTemplates(allTemplates.value, workers.value));

  async function reloadTemplates() {
    try {
      // Every template, not only this module's: a task's label resolves from any template it ran from.
      const { data } = await GET_Templates();
      allTemplates.value = listOf(data);
    } catch {
      // Templates are optional (an older backend has none): "Custom…" still runs any worker.
      allTemplates.value = [];
    }
  }

  async function load() {
    try {
      const { data } = await GET_Workers({ target_module: module });
      workers.value = listOf(data);
    } catch (err) {
      workers.value = [];
      useNotifyStore().spawnNotification({ type: "negative", msg: extractApiMessage(err, t("notifications.error")) });
    }
    await reloadTemplates();
  }

  watch(enabled, (on) => on && load(), { immediate: true });
  return { workers, templates, allTemplates, enabled, writable, usable, reloadTemplates };
}
