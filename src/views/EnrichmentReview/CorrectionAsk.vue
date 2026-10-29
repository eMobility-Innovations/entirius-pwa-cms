<template>
  <div class="correction-ask flex-column gap-1">
    <span v-if="ask.quickAction" class="correction-ask__action" data-testid="ask-action">
      <FontAwesomeIcon :icon="$icons.enrich" aria-hidden="true" />
      {{ $t(`enrichment.correct.quick.${ask.quickAction}`) }}
    </span>
    <p v-if="ask.instruction" class="correction-ask__text m-0" data-testid="ask-text">{{ ask.instruction }}</p>
    <span v-if="fragment" class="correction-ask__fragment fs-200" :title="fragment">
      {{ $t("enrichment.thread.only_fragment", { text: excerpt }) }}
    </span>
  </div>
</template>

<script>
const EXCERPT = 60;

// The operator's side of a correction, as a chat bubble: the quick action by its label, their own words, and the
// fragment it was narrowed to. `ask` is a versionInfo() or a pending request ({ quickAction, instruction, selection }).
export default {
  name: "CorrectionAsk",
  props: {
    ask: { type: Object, required: true },
  },
  computed: {
    fragment() {
      return this.ask.fragment || this.ask.selection || "";
    },
    excerpt() {
      return this.fragment.length > EXCERPT ? `${this.fragment.slice(0, EXCERPT)}…` : this.fragment;
    },
  },
};
</script>

<style lang="scss" scoped>
// The operator's message: an accent-tinted bubble on the right, its tail corner at the top. On accent-subtle text is
// text-strong or text-body in both themes (docs/ui-rules.md T1).
.correction-ask {
  max-width: min(85%, 32rem);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-base);
  background: var(--accent-subtle);
  color: var(--text-strong);
}
.correction-ask__action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-300);
  font-weight: 600;
  line-height: 1.6;
}
.correction-ask__text {
  font-size: var(--fs-300);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.correction-ask__fragment {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-body);
}
</style>
