<template>
  <div class="document-summary flex-column gap-5" data-testid="document-summary">
    <dl class="document-summary__facts m-0">
      <template v-for="fact in facts" :key="fact.key">
        <dt class="field-label">{{ $t(`enrichment.studio.document.${fact.key}`) }}</dt>
        <dd class="m-0" :data-testid="`document-${fact.key}`">{{ fact.value }}</dd>
      </template>
    </dl>
    <p class="m-0 t-secondary">
      {{ $t(draft ? "enrichment.studio.document.created" : "enrichment.studio.document.on_approve") }}
    </p>
    <div v-if="draft">
      <router-link :to="draft" class="t-accent fw-600" data-testid="open-draft">
        {{ $t("enrichment.studio.document.open") }}
      </router-link>
    </div>
  </div>
</template>

<script>
import { draftRoute, wordCount } from "./studioLogic";

// The last step: what the document will hold (title, address, language, length, FAQ) and, once approved, the way to
// the unpublished draft in Pages.
export default {
  name: "DocumentSummary",
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
  },
};
</script>

<style lang="scss" scoped>
.document-summary__facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-5);
  align-items: baseline;
}
</style>
