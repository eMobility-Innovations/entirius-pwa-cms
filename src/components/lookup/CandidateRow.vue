<template>
  <div
    class="candidate-row"
    :data-testid="`candidate-row-${hit.kind}-${hit.ref}`"
  >
    <div class="candidate-row__thumb">
      <img
        v-if="hit.basic?.main_image_url"
        :src="thumbUrl"
        :alt="hit.basic?.name"
      />
      <FontAwesomeIcon v-else :icon="$icons.image" />
    </div>
    <div class="candidate-row__main">
      <div class="candidate-row__title-line">
        <StatusBadge :label="kindLabel" tone="info" />
        <span class="candidate-row__name">{{ hit.basic?.name }}</span>
        <span class="candidate-row__sku fs-200 t-muted">{{
          hit.basic?.sku
        }}</span>
      </div>
      <div class="candidate-row__meta">
        <span
          class="candidate-row__score fs-300 fw-600"
          data-testid="candidate-row-score"
        >
          {{ scoreText }}
        </span>
        <StatusBadge
          v-if="isExact"
          :label="$t('lookup.match.exact_badge')"
          tone="positive"
          data-testid="candidate-row-exact"
        />
        <StatusBadge
          v-if="hit.decision"
          :label="decisionLabel"
          :tone="decisionVariant"
          data-testid="candidate-row-decision"
        />
      </div>
      <div v-if="hit.reasons?.length" class="candidate-row__reasons">
        <span
          v-for="(reason, index) in hit.reasons"
          :key="`${reason.code}-${index}`"
          class="candidate-row__reason-chip"
        >
          {{ reason.label }} ({{ reason.score >= 0 ? "+" : ""
          }}{{ reason.score }})
        </span>
      </div>
    </div>
    <div class="candidate-row__actions">
      <slot name="actions" :hit="hit" />
      <IconButton
        icon="external"
        :label="$t('lookup.row.open')"
        variant="outline"
        data-testid="candidate-row-open"
        @click="open"
      />
    </div>
  </div>
</template>

<script>
import { resolveMediaUrl } from "@/utils/resolveMediaUrl";
import { matchKind } from "@/utils/lookupMatch";

// Response fields the backend controls, but never trust them blindly as
// i18n/object keys or as a source of arbitrary property lookups.
const KNOWN_KINDS = new Set(["pim_product", "atlas_source_product"]);
// Doubles as the decision allowlist: Object.create(null) has no prototype
// chain to leak through a lookup keyed by an untrusted API value.
const DECISION_VARIANTS = Object.assign(Object.create(null), {
  match: "positive",
  review: "warning",
  no_match: "neutral",
});

export default {
  name: "CandidateRow",
  props: {
    hit: { type: Object, required: true },
  },
  computed: {
    score() {
      return this.hit.score ?? this.hit.similarity;
    },
    // A /search/ hit's `similarity` is 0-100 relevance to the query — a percentage. A /check/
    // candidate's `score` is the dedup point total, which is not.
    scoreText() {
      return this.hit.decision ? String(this.score) : `${this.score} %`;
    },
    isExact() {
      return matchKind(this.hit) === "exact";
    },
    thumbUrl() {
      return resolveMediaUrl(this.hit.basic?.main_image_url);
    },
    kindLabel() {
      return KNOWN_KINDS.has(this.hit.kind)
        ? this.$t(`lookup.kind.${this.hit.kind}`)
        : this.hit.kind;
    },
    isKnownDecision() {
      return Object.hasOwn(DECISION_VARIANTS, this.hit.decision ?? "");
    },
    decisionLabel() {
      return this.isKnownDecision
        ? this.$t(`lookup.decision.${this.hit.decision}`)
        : this.hit.decision;
    },
    decisionVariant() {
      return this.isKnownDecision
        ? DECISION_VARIANTS[this.hit.decision]
        : "neutral";
    },
  },
  methods: {
    // `ref` already encodes the identifiers a provider's own catalog needs
    // (PIM: sku === ref; atlas: `<source_idx>:<external_id>`) — no need to
    // parse the admin API's `detail_url`.
    open() {
      if (this.hit.kind === "pim_product") {
        this.$router.push({
          name: "PimProductDetail",
          params: { sku: this.hit.basic?.sku },
        });
        return;
      }
      const [sourceIdx] = String(this.hit.ref || "").split(":");
      if (!sourceIdx) return;
      this.$router.push({
        name: "SourceDetail",
        params: { idx: sourceIdx },
        query: { tab: "products" },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.candidate-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8);
  padding: var(--space-8);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-5);

  &__thumb {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-raised);
    border-radius: var(--radius-base);
    color: var(--text-muted);
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  &__title-line,
  &__meta {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }
  &__title-line {
    flex-wrap: wrap;
  }
  &__name {
    font-weight: 600;
  }
  &__reasons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  &__reason-chip {
    font-size: var(--fs-200);
    color: var(--text-secondary);
    background: var(--surface-raised);
    border-radius: var(--radius-full);
    padding: 2px var(--space-2);
  }
  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
}
</style>
