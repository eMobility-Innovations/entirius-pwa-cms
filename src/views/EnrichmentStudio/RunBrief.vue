<template>
  <section class="run-brief flex-column gap-3" :aria-label="$t('enrichment.studio.brief.label')" data-testid="run-brief">
    <div class="run-brief__head">
      <div class="run-brief__summary flex-column gap-1">
        <span class="run-brief__label">{{ $t("enrichment.studio.brief.label") }}</span>
        <p class="run-brief__topic type-title m-0" :class="{ 'run-brief__topic--clamped': !open && details.length }" data-testid="run-brief-topic">
          {{ topic }}
        </p>
      </div>
      <BasicButton
        v-if="details.length"
        variant="ghost"
        :icon="open ? 'collapse' : 'expand'"
        :aria-expanded="String(open)"
        data-testid="run-brief-toggle"
        @click="open = !open"
      >
        {{ $t(open ? "enrichment.studio.brief.hide" : "enrichment.studio.brief.show") }}
      </BasicButton>
    </div>
    <dl v-if="open && details.length" class="run-brief__details m-0">
      <div v-for="item in details" :key="item.key" class="flex-column gap-1">
        <dt class="run-brief__name">{{ $t(`enrichment.studio.brief.${item.key}`) }}</dt>
        <dd class="run-brief__value m-0">{{ item.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<script>
import { briefHasValue } from "./studioLogic";

// The brief fields shown under the topic, in this order (the language and channel are chips in the page header).
const DETAILS = ["title", "angle", "audience", "notes", "cover_hint", "cover_product", "cover_text_wanted", "cover_text"];

// The run's brief under the page header: the full topic always, the rest of the brief (working title, angle,
// audience, notes, the cover's hints, product and text) open until the first step is approved, folded after that.
export default {
  name: "RunBrief",
  props: {
    run: { type: Object, required: true },
  },
  data() {
    return { open: !this.run.steps.some((step) => step.status === "approved") };
  },
  computed: {
    inputs() {
      return this.run.inputs || {};
    },
    topic() {
      return this.inputs.topic || this.inputs.title || this.run.definition_label;
    },
    details() {
      return DETAILS.filter((key) => briefHasValue(this.inputs[key])).map((key) => ({ key, value: this.shown(this.inputs[key]) }));
    },
  },
  methods: {
    // A checkbox reads yes / no, a picked product its name and SKU.
    shown(value) {
      if (typeof value === "boolean") return this.$t(value ? "common.yes" : "common.no");
      if (value && typeof value === "object") return value.label && value.label !== value.ref ? `${value.label} (${value.ref})` : value.ref;
      return value;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.run-brief {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.run-brief__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.run-brief__summary {
  flex: 1 1 20rem;
  min-width: 0;
}
.run-brief__label,
.run-brief__name {
  font-size: var(--fs-250);
  font-weight: 600;
  color: var(--text-secondary);
}
.run-brief__topic {
  color: var(--text-strong);
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.run-brief__topic--clamped {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}
.run-brief__details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-4) var(--space-6);
}
.run-brief__value {
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

// A phone keeps the strip short: the step under it should start on the first screen.
@include max-tablet {
  .run-brief {
    padding: var(--space-4);
  }
  // Over the type role's size (`:root .type-title`).
  .run-brief .run-brief__topic {
    font-size: var(--fs-400);
    line-height: 1.4;
  }
}
</style>
