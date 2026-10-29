<template>
  <div class="change-summary flex ai-ct gap-3" data-testid="change-summary">
    <template v-if="summary.media">
      <span class="change-summary__thumb" aria-hidden="true">
        <FontAwesomeIcon :icon="$icons[summary.media]" />
      </span>
      <Tag v-if="summary.duration != null" :label="$t('enrichment.review.duration', { seconds: summary.duration })" />
    </template>
    <span v-else-if="summary.tags" class="change-summary__excerpt" data-testid="change-summary-tags">
      {{ $t("enrichment.review.tag_changes", summary.tags) }}
    </span>
    <template v-else>
      <Tag :label="$t(`enrichment.review.change_${summary.state}`)" />
      <span class="change-summary__excerpt" :title="summary.excerpt">{{ summary.excerpt || "—" }}</span>
      <LengthCounter v-if="rules" :length="summary.length" :rules="rules" compact class="change-summary__count" />
    </template>
  </div>
</template>

<script>
import LengthCounter from "./LengthCounter.vue";
import { changeSummary } from "./reviewLogic";

// A proposal's change in one line, for list rows: a "new" / "changed" tag, a plain-text excerpt cut with an
// ellipsis, the length when the field has a target; tags as "+2 −1 tags"; media as a small icon tile with its duration. The full
// preview (diff, rendered HTML, player) lives only in the detail views — no media is fetched here.
export default {
  name: "ChangeSummary",
  components: { LengthCounter },
  props: {
    proposal: { type: Object, required: true },
    rules: { type: Object, default: null },
  },
  computed: {
    summary() {
      return changeSummary(this.proposal);
    },
  },
};
</script>

<style lang="scss" scoped>
.change-summary {
  min-width: 0;
}
.change-summary__excerpt {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--fs-300);
  color: var(--text-body);
}
.change-summary__count {
  flex-shrink: 0;
  white-space: nowrap;
}
// A 9:16 tile, the shape of a product video: a stand-in for a poster frame, no media request.
.change-summary__thumb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 27px;
  height: 48px;
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  color: var(--text-secondary);
}
</style>
