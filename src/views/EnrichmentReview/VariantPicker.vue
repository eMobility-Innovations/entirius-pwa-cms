<template>
  <section class="variant-picker flex-column gap-3" :aria-label="title" data-testid="variant-picker">
    <div class="flex ai-ct flex-wrap gap-2 rg-1">
      <FontAwesomeIcon :icon="$icons.enrich" class="variant-picker__icon" aria-hidden="true" />
      <span class="variant-picker__title">{{ title }}</span>
      <span class="fs-200 t-muted">{{ $t("enrichment.correct.variants_hint") }}</span>
    </div>
    <div
      v-for="(candidate, index) in candidates"
      :key="index"
      class="variant-picker__item flex-column gap-3"
      :data-testid="`variant-${index}`"
    >
      <div class="variant-picker__text" v-html="sanitizeHtml(asHtml(candidate))" />
      <BasicButton
        class="variant-picker__pick"
        size="sm"
        mutates
        :disabled="busy"
        :data-testid="`variant-pick-${index}`"
        @click="$emit('pick', candidate)"
      >
        {{ $t("enrichment.correct.variant_pick") }}
      </BasicButton>
    </div>
    <BasicButton class="variant-picker__keep" size="sm" variant="ghost" :disabled="busy" data-testid="variant-cancel" @click="$emit('cancel')">
      {{ $t("enrichment.correct.variant_keep") }}
    </BasicButton>
  </section>
</template>

<script>
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { isHtml } from "./reviewLogic";
import { valueText } from "./correction";

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The AI's answer to "3 variants", inside the correction thread: the candidates as cards in reading order, "Use this"
// on each saves it as the next version (`pick` with the value), "Keep current" drops them. Nothing is saved until then.
export default {
  name: "VariantPicker",
  props: {
    candidates: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
  },
  emits: ["pick", "cancel"],
  computed: {
    title() {
      return this.$t("enrichment.correct.variants_title", { count: this.candidates.length });
    },
  },
  methods: {
    sanitizeHtml,
    asHtml(candidate) {
      const text = valueText(candidate);
      return isHtml(text) ? text : escapeHtml(text);
    },
  },
};
</script>

<style lang="scss" scoped>
.variant-picker__icon {
  font-size: var(--fs-200);
  color: var(--accent);
}
.variant-picker__title {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
// Each candidate in the AI's own bubble (CorrectionThread), its "Use this" under the text.
.variant-picker__item {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--accent);
  }
}
.variant-picker__text {
  max-width: 68ch;
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
  white-space: pre-wrap;
  word-break: break-word;
}
.variant-picker__pick {
  align-self: flex-end;
}
.variant-picker__keep {
  align-self: flex-start;
  margin-left: calc(-1 * var(--space-3));
}
</style>
