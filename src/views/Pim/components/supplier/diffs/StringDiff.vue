<template>
  <div class="string-diff">
    <div class="string-diff__col">
      <div class="string-diff__label t-muted">{{ $t("pim.supplier.diff.before") }}</div>
      <div class="string-diff__value string-diff__value--before">{{ formatVal(before) }}</div>
    </div>
    <div class="string-diff__col">
      <div class="string-diff__label t-muted">{{ $t("pim.supplier.diff.after") }}</div>
      <div class="string-diff__value string-diff__value--after">{{ formatVal(after) }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: "StringDiff",
  props: {
    before: { default: null },
    after: { default: null },
  },
  methods: {
    formatVal(v) {
      if (v == null || v === "") return this.$t("pim.supplier.diff.no_change");
      return typeof v === "string" ? v : JSON.stringify(v);
    },
  },
};
</script>

<style lang="scss" scoped>
.string-diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
}
.string-diff__label {
  font-size: var(--fs-200);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-2);
}
.string-diff__value {
  padding: var(--space-5);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  font-size: var(--fs-200);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow-y: auto;
}
.string-diff__value--before {
  border-left: 2px solid var(--negative);
}
.string-diff__value--after {
  border-left: 2px solid var(--positive);
}

@media (max-width: 640px) {
  .string-diff {
    grid-template-columns: 1fr;
  }
}
</style>
