<template>
  <section class="variant-picker flex-column gap-4" :aria-label="$t('enrichment.correct.variants_title')" data-testid="variant-picker">
    <div class="flex ai-ct jc-sb flex-wrap gap-3">
      <span class="field-label">{{ $t("enrichment.correct.variants_title") }}</span>
      <BasicButton size="sm" variant="ghost" :disabled="busy" data-testid="variant-cancel" @click="$emit('cancel')">
        {{ $t("common.cancel") }}
      </BasicButton>
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
        {{ $t("enrichment.correct.variant_pick", { number: index + 1 }) }}
      </BasicButton>
    </div>
  </section>
</template>

<script>
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { isHtml } from "./reviewLogic";
import { valueText } from "./correction";

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// "3 variants": the AI's candidates side by side in reading order; picking one saves it as the next version
// (`pick` with the value). Nothing is saved until then.
export default {
  name: "VariantPicker",
  props: {
    candidates: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
  },
  emits: ["pick", "cancel"],
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
.variant-picker__item {
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}
.variant-picker__text {
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
  white-space: pre-wrap;
  word-break: break-word;
}
.variant-picker__pick {
  align-self: flex-end;
}
</style>
