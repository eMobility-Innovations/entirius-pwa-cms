<template>
  <span class="length-counter fs-200" :class="`length-counter--${tone}`" :title="label" data-testid="length-counter">
    {{ compact ? $t("enrichment.review.length_short", { count: length }) : label }}
  </span>
</template>

<script>
import { lengthTone } from "./reviewLogic";

// "142 / 120–155 characters" (compact: "142 chars") in the tone of the target: positive inside it, warning close, negative off it.
export default {
  name: "LengthCounter",
  props: {
    length: { type: Number, required: true },
    rules: { type: Object, required: true },
    // A list row: just the count, the target in the tooltip.
    compact: { type: Boolean, default: false },
  },
  computed: {
    tone() {
      return lengthTone(this.length, this.rules);
    },
    label() {
      const { min, max } = this.rules;
      const target = min == null ? `${max}` : `${min}–${max}`;
      return this.$t("enrichment.review.length", { count: this.length, target });
    },
  },
};
</script>

<style lang="scss" scoped>
.length-counter {
  font-variant-numeric: tabular-nums;
}
.length-counter--positive {
  color: var(--positive);
}
.length-counter--warning {
  color: var(--warning);
}
.length-counter--negative {
  color: var(--negative);
}
</style>
