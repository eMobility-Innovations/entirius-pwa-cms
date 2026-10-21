<template>
  <div class="meta-cards flex-column gap-6" data-testid="meta-cards">
    <StepCallout v-if="warnings.length" tone="warning" icon="warning" data-testid="meta-warnings">
      <ul class="meta-cards__warnings m-0 p-0 flex-column gap-1">
        <li v-for="(warning, index) in warnings" :key="index">{{ warningText(warning) }}</li>
      </ul>
    </StepCallout>
    <section class="flex-column gap-2">
      <h3 class="meta-cards__heading m-0">{{ $t("enrichment.studio.meta.preview") }}</h3>
      <SearchSnippet :title="data.title || ''" :url="data.slug ? `/${data.slug}` : ''" :text="data.description || ''" />
    </section>

    <dl class="meta-cards__fields m-0 flex-column gap-4">
      <div v-for="field in fields" :key="field.key" class="flex-column gap-1" :data-testid="`meta-${field.key}`">
        <dt class="flex ai-ct flex-wrap gap-3">
          <span class="meta-cards__name">{{ $t(`enrichment.studio.meta.${field.key}`) }}</span>
          <LengthCounter v-if="field.rules" class="meta-cards__counter" :length="field.value.length" :rules="field.rules" />
        </dt>
        <dd class="m-0 meta-cards__value">{{ field.value || "—" }}</dd>
      </div>
    </dl>

    <section v-if="faq.length" class="flex-column gap-3" data-testid="meta-faq">
      <div>
        <BasicButton
          variant="ghost"
          :icon="showFaq ? 'collapse' : 'expand'"
          :aria-expanded="String(showFaq)"
          data-testid="meta-faq-toggle"
          @click="showFaq = !showFaq"
        >
          {{ $t("enrichment.studio.meta.faq", { count: faq.length }) }}
        </BasicButton>
      </div>
      <dl v-if="showFaq" class="m-0 flex-column gap-4">
        <div v-for="(item, index) in faq" :key="index" class="flex-column gap-1">
          <dt class="meta-cards__name">{{ item.question }}</dt>
          <dd class="m-0 meta-cards__value">{{ item.answer }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script>
import LengthCounter from "@/views/EnrichmentReview/LengthCounter.vue";
import SearchSnippet from "@/views/EnrichmentReview/SearchSnippet.vue";
import StepCallout from "./StepCallout.vue";

// Search engines cut a title near 60 characters and a description near 160 (the meta template's limits). Each limit
// is a target range, so a value that uses the room up to the limit reads positive, not as a warning.
const LIMITS = {
  title: { min: 30, max: 60 },
  description: { min: 120, max: 160 },
  og_title: { min: 30, max: 90 },
  og_description: { min: 60, max: 200 },
};
const FIELDS = ["title", "description", "og_title", "og_description", "slug"];
const FAQ_PATH = /^faq\[(\d+)\]/;

// The metadata step: its quality warnings first (a value over its limit, a rule, a number outside the facts — each
// named by its field), how the page reads in a search result, then each value with its length against the limit,
// then the FAQ (folded, with its count). Corrections go through Regenerate with an instruction.
export default {
  name: "MetaCards",
  components: { LengthCounter, SearchSnippet, StepCallout },
  props: {
    proposal: { type: Object, required: true },
  },
  data() {
    return { showFaq: false };
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
    warnings() {
      return this.proposal.warnings || [];
    },
  },
  methods: {
    warningText(warning) {
      const field = this.fieldName(warning.path);
      return field ? `${field}: ${warning.message}` : warning.message;
    },
    // `description` → its label; `faq[1].answer` → "FAQ 2"; anything else as the API names it.
    fieldName(path) {
      if (!path) return "";
      if (FIELDS.includes(path)) return this.$t(`enrichment.studio.meta.${path}`);
      const faq = FAQ_PATH.exec(path);
      return faq ? this.$t("enrichment.studio.meta.faq_item", { number: Number(faq[1]) + 1 }) : path;
    },
  },
};
</script>

<style lang="scss" scoped>
.meta-cards__heading,
.meta-cards__name {
  font-size: var(--fs-250);
  font-weight: 600;
  color: var(--text-strong);
}
.meta-cards__warnings {
  list-style: none;
}
.meta-cards__counter {
  margin-left: auto;
}
.meta-cards__value {
  line-height: 1.6;
  color: var(--text-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
