<template>
  <div class="tag-changes flex-column gap-4" data-testid="tag-changes">
    <p v-if="!groups.length" class="fs-300 t-muted m-0">{{ $t("enrichment.review.tags_none") }}</p>
    <div v-for="group in groups" :key="group.name" class="flex-column gap-2" :data-testid="`tag-changes-${group.name}`">
      <span class="field-label">{{ $t(`enrichment.review.tags_${group.name}`) }}</span>
      <ul class="tag-changes__list">
        <li v-for="chip in group.chips" :key="chip.value">
          <StatusBadge :tone="group.tone" :dot="false" :label="`${group.sign}${chip.label}`" />
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { loadCatalog, optionLabel } from "./fieldCatalog";
import { optionChanges } from "./reviewLogic";

const GROUPS = [
  { name: "added", tone: "positive", sign: "+ " },
  { name: "removed", tone: "negative", sign: "− " },
  { name: "kept", tone: "neutral", sign: "" },
];

// A select / tag proposal as chips: the tags it adds, removes and keeps, named by the module's field catalog (the
// option value stands in until the catalog is there). `locator` gives the field and the channel.
export default {
  name: "TagChanges",
  props: {
    proposed: { type: Object, default: null },
    current: { type: Object, default: null },
    locator: { type: Object, default: () => ({}) },
  },
  data() {
    return { catalogFields: [] };
  },
  computed: {
    groups() {
      const changes = optionChanges(this.proposed, this.current);
      return GROUPS.filter((group) => changes[group.name].length).map((group) => ({
        ...group,
        chips: changes[group.name].map((value) => ({
          value,
          label: optionLabel(this.catalogFields, this.locator.feature_idx, value),
        })),
      }));
    },
  },
  watch: {
    "locator.channel": { immediate: true, handler: "loadLabels" },
  },
  methods: {
    async loadLabels(channel) {
      const { fields } = await loadCatalog(channel);
      if (channel === this.locator.channel) this.catalogFields = fields;
    },
  },
};
</script>

<style lang="scss" scoped>
.tag-changes__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
