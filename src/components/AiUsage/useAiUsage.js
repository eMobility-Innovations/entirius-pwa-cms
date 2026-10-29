import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { GET_UsageMonth } from "@/api/enrichment/api";
import { AREAS } from "@/configs/areas";
import { useAccessStore } from "@/stores/access";
import { useMuninStore } from "@/stores/munin";
import { REFRESH_MS } from "./aiUsage";

// Whether the AI-usage counter shows: the enrichment module is enabled and its proposals area is readable.
export function useAiUsageVisible() {
  const munin = useMuninStore();
  const access = useAccessStore();
  return computed(() => munin.isModuleEnabled("enrichment") && access.can(AREAS.ENRICHMENT_PROPOSALS));
}

// This month's AI usage, loaded on mount and every REFRESH_MS while the tab is visible. A failed read keeps the last
// numbers (null until one succeeds) and never toasts: the counter is display only and the toolbox may be down.
export function useAiUsage() {
  const usage = ref(null);
  let timer = null;

  async function load() {
    if (document.hidden) return;
    try {
      usage.value = (await GET_UsageMonth()).data;
    } catch {
      // quiet: the last numbers (or "—") stay
    }
  }

  onMounted(() => {
    load();
    timer = setInterval(load, REFRESH_MS);
  });
  onBeforeUnmount(() => clearInterval(timer));
  return usage;
}
