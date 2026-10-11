<template>
  <p
    v-if="state && state !== 'configured'"
    class="ai-hint"
    :class="`ai-hint--${state}`"
    role="status"
    data-testid="ai-toolbox-hint"
    :data-state="state"
  >
    <span>{{ $t(`config_health.checks.toolbox_status.${state}`) }}</span>
    <a
      v-if="fixUrl && !isInternalFix(fixUrl)"
      :href="safeHref(fixUrl)"
      target="_blank"
      rel="noopener noreferrer"
      class="ai-hint__fix"
    >
      {{ $t("config_health.fix") }}
    </a>
    <router-link v-else-if="fixUrl" :to="fixUrl" class="ai-hint__fix">{{ $t("config_health.fix") }}</router-link>
  </p>
</template>

<script setup>
import { computed } from "vue";
import { useConfigHealthStore } from "@/stores/configHealth";
import { isInternalFix } from "@/utils/configHealth";
import { safeHref } from "@/utils/safeHref";

// The one hint of the AI toolbox state, the same on every screen with an AI action: switched off on purpose
// (`disabled`, calm), not set up (`unconfigured`), not answering (`unreachable`). Nothing while the toolbox works.
const store = useConfigHealthStore();
const state = computed(() => store.aiState);
// A switched-off toolbox needs no fixing; the other states link the health row's fix when it has one.
const fixUrl = computed(() => store.failingFor("toolbox.status")[0]?.fix_url || "");
</script>

<style scoped>
.ai-hint {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  justify-content: space-between;
  margin: 0;
  padding: var(--space-5) var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--warning-subtle);
  color: var(--text-body);
}
.ai-hint--disabled {
  background: var(--info-subtle);
}
.ai-hint--unreachable {
  background: var(--negative-subtle);
}
.ai-hint__fix {
  font-weight: 600;
  color: inherit;
}
</style>
