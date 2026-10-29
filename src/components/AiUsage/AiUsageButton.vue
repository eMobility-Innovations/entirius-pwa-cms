<template>
  <BasicMenu :label="$t('ai_usage.title')" placement="bottom-end" sheet>
    <template #trigger>
      <BasicButton
        variant="ghost"
        icon="enrich"
        class="ai-usage__button"
        :label="ariaLabel"
        data-testid="ai-usage-button"
      >
        <span class="ai-usage__text">{{ summary(usage) }}</span>
      </BasicButton>
    </template>
    <template #panel>
      <div class="ai-usage__panel p-5" data-testid="ai-usage-panel">
        <p class="ai-usage__title fw-600 m-0">{{ $t("ai_usage.title") }}</p>
        <p class="ai-usage__period t-muted fs-250 mt-1 mb-0">{{ formatPeriod(usage?.period) }}</p>
        <dl class="ai-usage__numbers mt-4 mb-0">
          <dt>{{ $t("ai_usage.tokens_row") }}</dt>
          <dd data-testid="ai-usage-tokens">{{ formatTokensExact(usage?.tokens) }}</dd>
          <dt>{{ $t("ai_usage.cost_row") }}</dt>
          <dd data-testid="ai-usage-cost">{{ formatCost(usage?.cost_usd, usage?.currency) }}</dd>
        </dl>
        <p class="t-muted fs-250 mt-4 mb-0" data-testid="ai-usage-note">{{ costNote(usage) }}</p>
      </div>
    </template>
  </BasicMenu>
</template>

<script setup>
// The header AI-usage counter (desktop; R1: next to configuration health and the bell): this month's tokens and billed
// cost of the instance's AI toolbox, a popover with the month, exact numbers and what the cost includes. A phone has no
// room in the header row: the phone menu shows AiUsageLine instead. The parent decides visibility (useAiUsageVisible).
import { computed } from "vue";
import { t } from "@/i18n";
import BasicButton from "@/boots/BasicButton/index.vue";
import BasicMenu from "@/boots/BasicMenu/index.vue";
import { costNote, formatCost, formatPeriod, formatTokens, formatTokensExact, summary } from "./aiUsage";
import { useAiUsage } from "./useAiUsage";

const usage = useAiUsage();

const ariaLabel = computed(() =>
  t("ai_usage.label", {
    tokens: formatTokens(usage.value?.tokens),
    cost: formatCost(usage.value?.cost_usd, usage.value?.currency),
  })
);
</script>

<style lang="scss" scoped>
.ai-usage__text {
  font-variant-numeric: tabular-nums;
}

.ai-usage__panel {
  min-width: 16rem;
}

.ai-usage__numbers {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-4);

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    color: var(--text-strong);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    text-align: right;
  }
}
</style>
