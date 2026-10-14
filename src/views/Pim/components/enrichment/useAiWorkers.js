import { computed, ref, watch } from "vue";
import { useMuninStore } from "@/stores/munin";
import { useConfigHealthStore } from "@/stores/configHealth";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { t } from "@/i18n";
import { GET_Workers } from "@/api/enrichment/api";

// The PIM AI actions: present while the enrichment module is on (dormant otherwise), usable while the AI toolbox is
// (configHealth.aiUsable — the hint is <AiToolboxHint />). Workers load once the module is known to be on;
// a failed load is toasted, so an empty menu is never a silent misconfiguration.
export function useAiWorkers() {
  const munin = useMuninStore();
  const health = useConfigHealthStore();
  const workers = ref([]);
  const enabled = computed(() => munin.isModuleEnabled("enrichment"));
  const usable = computed(() => enabled.value && health.aiUsable);

  async function load() {
    try {
      const { data } = await GET_Workers({ target_module: "pim" });
      workers.value = Array.isArray(data) ? data : data?.results || [];
    } catch (err) {
      workers.value = [];
      useNotifyStore().spawnNotification({ type: "negative", msg: extractApiMessage(err, t("notifications.error")) });
    }
  }

  watch(enabled, (on) => on && load(), { immediate: true });
  return { workers, enabled, usable };
}
