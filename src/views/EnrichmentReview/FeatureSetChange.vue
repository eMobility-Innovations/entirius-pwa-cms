<template>
  <div class="feature-set-change" data-testid="feature-set-change">
    <div class="feature-set-change__row">
      <span class="t-secondary">{{ $t("enrichment.review.feature_set.now") }}</span>
      <span class="feature-set-change__value" data-testid="feature-set-now">{{ label(beforeIdx) }}</span>
    </div>
    <div class="feature-set-change__row">
      <span class="t-secondary">{{ $t("enrichment.review.feature_set.proposed") }}</span>
      <strong class="feature-set-change__value" data-testid="feature-set-proposed">{{ label(afterIdx) }}</strong>
    </div>
  </div>
</template>

<script>
// A feature-set proposal in plain words: the set the product is on now and the one the AI proposes, by name
// (`{featureset_idx}` in proposed_value and current_snapshot). Names come from the global feature-set list,
// fetched once per page load; an unknown idx shows as the idx itself.
import { GET_FeatureSetsGlobal } from "@/api/pim/api";

let namesPromise = null;
export function loadFeatureSetNames() {
  namesPromise ??= GET_FeatureSetsGlobal({ page_size: 500 })
    .then(({ data }) => Object.fromEntries((data.results || data || []).map((fs) => [fs.idx, fs.name || fs.idx])))
    .catch(() => {
      namesPromise = null;
      return {};
    });
  return namesPromise;
}

const idxOf = (value) => (value && typeof value === "object" ? value.featureset_idx || "" : value || "");

export default {
  name: "FeatureSetChange",
  props: {
    proposed: { type: [Object, String], default: null },
    current: { type: [Object, String], default: null },
  },
  data() {
    return { names: {} };
  },
  computed: {
    beforeIdx() {
      return idxOf(this.current);
    },
    afterIdx() {
      return idxOf(this.proposed);
    },
  },
  async mounted() {
    this.names = await loadFeatureSetNames();
  },
  methods: {
    label(idx) {
      if (!idx) return "—";
      return this.names[idx] || idx;
    },
  },
};
</script>

<style scoped>
.feature-set-change {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}
.feature-set-change__row {
  display: flex;
  gap: var(--space-3, 12px);
  align-items: baseline;
}
.feature-set-change__value {
  font-size: 1.05em;
}
</style>
