<template>
  <BasicMenu :label="$t('enrichment.review.details.title')" placement="bottom-end" sheet @open="loadModel">
    <template #trigger>
      <IconButton icon="info" size="sm" :label="$t('enrichment.review.details.title')" data-testid="proposal-meta" />
    </template>
    <template #panel>
      <div class="proposal-details flex-column gap-4" data-testid="proposal-details">
        <dl class="proposal-details__rows m-0">
          <dt>{{ $t("enrichment.cost.label") }}</dt>
          <dd><CostLabel :cost="proposal.cost_usd" /></dd>
          <template v-if="model !== null">
            <dt>{{ $t("enrichment.review.details.model") }}</dt>
            <dd data-testid="proposal-model">{{ model || $t("enrichment.review.details.default_model") }}</dd>
          </template>
          <template v-if="source">
            <dt>{{ $t("enrichment.review.details.source") }}</dt>
            <dd data-testid="proposal-source-line">{{ source }}</dd>
          </template>
        </dl>
        <ProfileUsageNote :proposal="proposal" :task="task" />
      </div>
    </template>
  </BasicMenu>
</template>

<script>
import CostLabel from "./CostLabel.vue";
import ProfileUsageNote from "./ProfileUsageNote.vue";
import { workerOf } from "./reviewLogic";
import { modelOf } from "./workerModel";

// The ⓘ next to a proposal's cost: a small panel with what the AI call cost, the model, the worker and kind behind it
// and what the AI was given from the company profile. Loaded when opened, never for a card nobody asks about.
export default {
  name: "ProposalDetails",
  components: { CostLabel, ProfileUsageNote },
  props: {
    proposal: { type: Object, required: true },
    task: { type: Object, default: null },
  },
  data() {
    return { model: null };
  },
  computed: {
    source() {
      const p = this.proposal;
      const confidence = p.confidence != null ? `${Math.round(Number(p.confidence) * 100)}%` : "";
      return [workerOf(p.source) || p.source, p.target_kind, confidence].filter(Boolean).join(" · ");
    },
  },
  methods: {
    async loadModel() {
      this.model = await modelOf(this.proposal.source);
    },
  },
};
</script>

<style lang="scss" scoped>
.proposal-details {
  max-width: 22rem;
  font-size: var(--fs-300);
  color: var(--text-body);
}
.proposal-details__rows {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-2) var(--space-4);

  dt {
    color: var(--text-secondary);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
}
</style>
