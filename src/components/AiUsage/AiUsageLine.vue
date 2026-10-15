<template>
  <div class="ai-usage-line flex ai-ct gap-2 pv-3 ph-5 fs-250" data-testid="ai-usage-line">
    <FontAwesomeIcon :icon="$icons.enrich" class="t-muted" aria-hidden="true" />
    <span class="ai-usage-line__text t-body">{{ summary(usage) }}</span>
  </div>
</template>

<script setup>
// The phone form of the AI-usage counter: one quiet line at the top of the phone menu (the header row has no room for
// it next to the bell, the user and the menu button). Same numbers and refresh as the header counter.
import { summary } from "./aiUsage";
import { useAiUsage } from "./useAiUsage";

const usage = useAiUsage();
</script>

<style scoped>
.ai-usage-line {
  border-bottom: 1px solid var(--border-hairline);
  font-variant-numeric: tabular-nums;
}
</style>
