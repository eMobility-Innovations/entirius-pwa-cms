<template>
  <div v-if="denied || failed || gateNotice" class="access-notices">
    <p
      v-if="denied"
      class="access-notice"
      role="status"
      data-testid="access-denied-notice"
    >
      <span>{{ $t("access.denied_panel", { panel: denied }) }}</span>
      <BasicButton
        variant="ghost"
        size="sm"
        @click="access.deniedPanel = null"
        >{{ $t("access.dismiss") }}</BasicButton
      >
    </p>
    <p
      v-if="failed"
      class="access-notice access-notice--negative"
      role="alert"
      data-testid="access-load-failed"
    >
      <span>{{ $t("access.load_failed") }}</span>
      <BasicButton size="sm" @click="access.ensureLoaded()">
        {{ $t("access.retry") }}
      </BasicButton>
    </p>
    <p
      v-if="gateNotice"
      class="access-notice"
      role="status"
      data-testid="access-gate-mode"
    >
      {{ $t("access.gate_mode", { mode: access.gateMode }) }}
    </p>
  </div>
</template>

<script setup>
// Home's access notices (django-access): a deep link refused for a panel (named from the registry, not the server),
// permissions that failed to load (panels stay hidden until Retry loads them), and — for access managers — a gate
// that does not enforce, so a forgotten kill switch is visible. Every text is interpolated, never HTML.
import { computed, onBeforeUnmount } from "vue";
import { useAccessStore } from "@/stores/access";
import { panels } from "@/configs/access";
import { t } from "@/i18n";

const access = useAccessStore();

const denied = computed(() => {
  const panel = panels.find((p) => p.idx === access.deniedPanel);
  return panel ? t(panel.labelKey) : "";
});
const failed = computed(() => access.status === "error");
const gateNotice = computed(
  () =>
    access.managesAccess && !!access.gateMode && access.gateMode !== "enforce"
);

// The refusal is said once: leaving Home forgets it.
onBeforeUnmount(() => {
  access.deniedPanel = null;
});
</script>

<style scoped>
.access-notices {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.access-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  margin: 0;
  padding: var(--space-5) var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--warning-subtle);
  color: var(--text-body);
}

.access-notice--negative {
  background: var(--negative-subtle);
}
</style>
