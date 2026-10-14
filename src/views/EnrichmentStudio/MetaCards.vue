<template>
  <div class="meta-cards flex-column gap-5" data-testid="meta-cards">
    <section v-for="field in fields" :key="field.key" class="meta-cards__card flex-column gap-2" :data-testid="`meta-${field.key}`">
      <div class="flex ai-ct flex-wrap gap-3">
        <h4 class="meta-cards__name m-0">{{ $t(`enrichment.studio.meta.${field.key}`) }}</h4>
        <LengthCounter v-if="field.rules" class="meta-cards__counter" :length="field.value.length" :rules="field.rules" />
      </div>
      <p class="m-0 meta-cards__value">{{ field.value || "—" }}</p>
    </section>

    <div class="flex-column gap-2">
      <span class="field-label">{{ $t("enrichment.studio.meta.preview") }}</span>
      <SearchSnippet :title="data.title || ''" :url="data.slug ? `/${data.slug}` : ''" :text="data.description || ''" />
    </div>

    <section v-if="faq.length" class="flex-column gap-3" data-testid="meta-faq">
      <h4 class="meta-cards__name m-0">{{ $t("enrichment.studio.meta.faq", { count: faq.length }) }}</h4>
      <dl class="m-0 flex-column gap-3">
        <div v-for="(item, index) in faq" :key="index" class="flex-column gap-1">
          <dt class="fw-600">{{ item.question }}</dt>
          <dd class="m-0 meta-cards__value">{{ item.answer }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script>
import LengthCounter from "@/views/EnrichmentReview/LengthCounter.vue";
import SearchSnippet from "@/views/EnrichmentReview/SearchSnippet.vue";

// Search engines cut a title near 60 characters and a description near 160 (the meta template's limits).
const LIMITS = { title: { max: 60 }, description: { min: 120, max: 160 }, og_title: { max: 90 }, og_description: { max: 200 } };
const FIELDS = ["title", "description", "og_title", "og_description", "slug"];

// The metadata step as field cards: each value with its length against the limit, how the page reads in a search
// result, and the FAQ. Corrections go through Regenerate with an instruction.
export default {
  name: "MetaCards",
  components: { LengthCounter, SearchSnippet },
  props: {
    proposal: { type: Object, required: true },
  },
  computed: {
    data() {
      return this.proposal.proposed_value?.data || {};
    },
    fields() {
      return FIELDS.filter((key) => key in this.data).map((key) => ({
        key,
        value: String(this.data[key] ?? ""),
        rules: LIMITS[key] || null,
      }));
    },
    faq() {
      return Array.isArray(this.data.faq) ? this.data.faq : [];
    },
  },
};
</script>

<style lang="scss" scoped>
.meta-cards__card {
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.meta-cards__name {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
.meta-cards__counter {
  margin-left: auto;
}
.meta-cards__value {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
