<template>
  <BasicTooltip v-if="tip" :text="tip">
    <span class="cost-label" tabindex="0" :aria-label="`${$t('enrichment.cost.label')}: ${shown}. ${tip}`" data-testid="cost-label">
      {{ shown }}
    </span>
  </BasicTooltip>
  <span v-else class="cost-label" :aria-label="`${$t('enrichment.cost.label')}: ${shown}`" data-testid="cost-label">{{ shown }}</span>
</template>

<script>
import { formatUsd } from "@/utils/format";

// What an AI run cost, after the fact: "$0.04"; "Free" when nothing was paid (a step without AI calls); "—" with a
// tooltip when the AI service reported no cost; a known sum with a missing part says so in its tooltip (`partial`).
export default {
  name: "CostLabel",
  props: {
    cost: { type: [String, Number], default: null },
    partial: { type: Boolean, default: false },
  },
  computed: {
    shown() {
      if (formatUsd(this.cost) && Number(this.cost) === 0) return this.$t("enrichment.cost.free");
      return formatUsd(this.cost) || "—";
    },
    tip() {
      if (!formatUsd(this.cost)) return this.$t("enrichment.cost.unknown");
      return this.partial ? this.$t("enrichment.cost.partial") : "";
    },
  },
};
</script>

<style lang="scss" scoped>
.cost-label {
  font-size: var(--fs-200);
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
