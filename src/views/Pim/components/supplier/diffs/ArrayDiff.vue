<template>
  <div class="array-diff">
    <div class="array-diff__summary">
      <span v-if="addedCount > 0" class="t-positive">
        {{ $t("pim.supplier.diff.added", { count: addedCount }) }}
      </span>
      <span v-if="removedCount > 0" class="t-negative">
        {{ $t("pim.supplier.diff.removed", { count: removedCount }) }}
      </span>
      <span v-if="addedCount === 0 && removedCount === 0" class="t-muted">
        {{ $t("pim.supplier.diff.no_change") }}
      </span>
    </div>
    <BasicButton
      v-if="addedItems.length + removedItems.length > 0"
      size="sm"
      variant="ghost"
      @click="expanded = !expanded"
    >
      {{ expanded ? $t("pim.supplier.timeline.hide_diff") : $t("pim.supplier.timeline.show_diff") }}
    </BasicButton>
    <div v-if="expanded" class="array-diff__details">
      <ul v-if="addedItems.length" class="array-diff__list">
        <li v-for="(item, i) in addedItems" :key="`a-${i}`" class="t-positive">+ {{ item }}</li>
      </ul>
      <ul v-if="removedItems.length" class="array-diff__list">
        <li v-for="(item, i) in removedItems" :key="`r-${i}`" class="t-negative">− {{ item }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: "ArrayDiff",
  props: {
    before: { type: Array, default: () => [] },
    after: { type: Array, default: () => [] },
  },
  data() {
    return { expanded: false };
  },
  computed: {
    beforeSet() {
      return new Set((this.before || []).map(String));
    },
    afterSet() {
      return new Set((this.after || []).map(String));
    },
    addedItems() {
      return [...this.afterSet].filter((v) => !this.beforeSet.has(v));
    },
    removedItems() {
      return [...this.beforeSet].filter((v) => !this.afterSet.has(v));
    },
    addedCount() {
      return this.addedItems.length;
    },
    removedCount() {
      return this.removedItems.length;
    },
  },
};
</script>

<style lang="scss" scoped>
.array-diff {
  font-size: var(--fs-200);
}
.array-diff__summary {
  display: flex;
  gap: var(--space-8);
}
.array-diff__details {
  margin-top: var(--space-5);
}
.array-diff__list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--font-mono, monospace);
}
</style>
