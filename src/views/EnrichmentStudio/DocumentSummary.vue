<template>
  <div class="document-summary flex-column gap-5" data-testid="document-summary">
    <StepCallout
      v-if="draft"
      tone="positive"
      icon="success"
      :title="$t('enrichment.studio.document.created_title')"
      data-testid="document-created"
    >
      <p class="m-0">{{ $t("enrichment.studio.document.created") }}</p>
      <div class="flex ai-ct flex-wrap gap-3">
        <BasicButton variant="primary" data-testid="open-draft" @click="$router.push(draft)">
          {{ $t("enrichment.studio.document.open") }}
        </BasicButton>
        <BasicButton data-testid="start-another" @click="$router.push(another)">
          {{ $t("enrichment.studio.document.another") }}
        </BasicButton>
      </div>
    </StepCallout>

    <dl class="document-summary__facts m-0">
      <template v-for="fact in facts" :key="fact.key">
        <dt class="document-summary__name">{{ $t(`enrichment.studio.document.${fact.key}`) }}</dt>
        <dd class="document-summary__value m-0" :data-testid="`document-${fact.key}`">{{ fact.value }}</dd>
      </template>
    </dl>
  </div>
</template>

<script>
import StepCallout from "./StepCallout.vue";
import { draftRoute, wordCount } from "./studioLogic";

// The last step: what the document will hold (title, address, language, length, FAQ) and, once approved, the
// unpublished draft in Pages to open, or a new piece of content to start.
export default {
  name: "DocumentSummary",
  components: { StepCallout },
  props: {
    proposal: { type: Object, required: true },
    run: { type: Object, required: true },
  },
  computed: {
    value() {
      return this.proposal.proposed_value || {};
    },
    facts() {
      const v = this.value;
      return [
        { key: "title", value: v.title || "—" },
        { key: "slug", value: v.slug ? `/${v.slug}` : "—" },
        { key: "language", value: (v.language || "—").toUpperCase() },
        { key: "words", value: String(wordCount(v.body_markdown)) },
        { key: "faq", value: String((v.faq || []).length) },
      ];
    },
    draft() {
      return draftRoute(this.run);
    },
    another() {
      return { name: "EnrichmentStudio", query: { new: "1" } };
    },
  },
};
</script>

<style lang="scss" scoped>
.document-summary__facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-3) var(--space-6);
  align-items: baseline;
}
.document-summary__name {
  font-size: var(--fs-250);
  font-weight: 600;
  color: var(--text-secondary);
}
.document-summary__value {
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
</style>
