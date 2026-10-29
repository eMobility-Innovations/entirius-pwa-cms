<template>
  <div class="json-diff">
    <div class="json-diff__col">
      <div class="json-diff__label t-muted">{{ $t("pim.supplier.diff.before") }}</div>
      <pre class="json-diff__value json-diff__value--before">{{ format(before) }}</pre>
    </div>
    <div class="json-diff__col">
      <div class="json-diff__label t-muted">{{ $t("pim.supplier.diff.after") }}</div>
      <pre class="json-diff__value json-diff__value--after">{{ format(after) }}</pre>
    </div>
  </div>
</template>

<script>
export default {
  name: "JsonDiff",
  props: {
    before: { default: null },
    after: { default: null },
  },
  methods: {
    format(v) {
      if (v == null) return "—";
      try {
        return JSON.stringify(v, null, 2);
      } catch {
        return String(v);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
// Before and after sit side by side while each gets 16 rem, else they stack; a longer JSON line scrolls inside
// its pane instead of breaking keys mid-word or widening a table cell.
.json-diff {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  width: 100%;
  contain: inline-size;
}
.json-diff__col {
  flex: 1 1 16rem;
  min-width: 0;
}
.json-diff__label {
  font-size: var(--fs-200);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-2);
}
.json-diff__value {
  padding: var(--space-5);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-200);
  white-space: pre;
  max-height: 240px;
  overflow: auto;
  scrollbar-width: thin;
  margin: 0;
}
.json-diff__value--before {
  border-left: 2px solid var(--negative);
}
.json-diff__value--after {
  border-left: 2px solid var(--positive);
}
</style>
