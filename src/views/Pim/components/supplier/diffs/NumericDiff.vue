<template>
  <span class="numeric-diff">
    <span class="t-muted">{{ formatVal(before) }}</span>
    <span class="numeric-diff__arrow t-muted">→</span>
    <strong class="t-body">{{ formatVal(after) }}</strong>
  </span>
</template>

<script>
export default {
  name: "NumericDiff",
  props: {
    before: { type: [Number, String, null], default: null },
    after: { type: [Number, String, null], default: null },
  },
  methods: {
    formatVal(v) {
      if (v == null) return "—";
      const n = Number(v);
      return Number.isFinite(n) ? n.toString() : String(v);
    },
  },
};
</script>

<style lang="scss" scoped>
.numeric-diff {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-200);
}
.numeric-diff__arrow {
  font-size: var(--fs-300);
}
</style>
