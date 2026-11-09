<template>
  <form class="focus-missing" :data-testid="`enrichment-focus-missing-row-${row.feature_idx}`" @submit.prevent="save">
    <span class="focus-missing__name">{{ row.name }}</span>
    <div class="focus-missing__control">
      <BasicSelect
        v-if="choices"
        v-model="draft"
        :options="choices"
        :multiple="row.kind === 'multiselect'"
        :placeholder="$t(row.kind === 'multiselect' ? 'enrichment.review.focus.missing_choose_many' : 'enrichment.review.focus.missing_choose')"
        :searchable="choices.length > 8"
        :disabled="disabled"
        :data-testid="`enrichment-focus-missing-${row.feature_idx}`"
      />
      <BasicInput
        v-else
        v-model="draft"
        :inputmode="numeric ? 'decimal' : undefined"
        :placeholder="$t(numeric ? 'enrichment.review.focus.missing_number' : 'enrichment.review.focus.missing_text')"
        :disabled="disabled"
        :data-testid="`enrichment-focus-missing-${row.feature_idx}`"
      />
      <BasicSelect
        v-if="row.kind === 'length'"
        v-model="lengthUnit"
        class="focus-missing__unit-select"
        :options="lengthUnits"
        :disabled="disabled"
        :data-testid="`enrichment-focus-missing-unit-${row.feature_idx}`"
      />
      <span v-else-if="row.unit" class="focus-missing__unit" data-testid="enrichment-focus-missing-unit">{{ row.unit }}</span>
    </div>
    <BasicButton
      type="submit"
      size="sm"
      mutates
      :disabled="disabled || empty"
      :data-testid="`enrichment-focus-fill-${row.feature_idx}`"
    >
      {{ $t("common.save") }}
    </BasicButton>
  </form>
</template>

<script>
const LENGTH_UNITS = ["mm", "inch"];

/** One missing attribute on one line; the control follows the feature's kind, so only valid values can be offered. */
export default {
  name: "FocusMissingRow",
  props: {
    row: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ["fill"],
  data() {
    return { draft: this.row.kind === "multiselect" ? [] : null, lengthUnit: LENGTH_UNITS[0] };
  },
  computed: {
    numeric() {
      return ["decimal", "length"].includes(this.row.kind);
    },
    choices() {
      if (this.row.kind === "bool") {
        return [{ value: true, label: this.$t("common.yes") }, { value: false, label: this.$t("common.no") }];
      }
      if (!["select", "multiselect"].includes(this.row.kind)) return null;
      return (this.row.options || []).map(({ idx, label }) => ({ value: idx, label }));
    },
    lengthUnits() {
      return LENGTH_UNITS.map((value) => ({ value, label: value }));
    },
    empty() {
      if (Array.isArray(this.draft)) return !this.draft.length;
      return this.draft === null || String(this.draft).trim() === "";
    },
    value() {
      if (this.choices) return this.draft;
      const text = String(this.draft).trim();
      if (!this.numeric) return text;
      const number = text.replace(",", ".");
      return this.row.kind === "length" ? { value: number, unit: this.lengthUnit } : number;
    },
  },
  methods: {
    save() {
      if (!this.disabled && !this.empty) this.$emit("fill", this.value);
    },
  },
};
</script>

<style lang="scss" scoped>
// The same columns as FocusAttribute, so names and values line up with the rows above.
.focus-missing {
  display: grid;
  grid-template-columns: minmax(120px, 200px) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--border-subtle);

  &:last-child {
    border-bottom: 0;
  }
}
.focus-missing__name {
  font-size: var(--fs-300);
  color: var(--text-secondary);
}
.focus-missing__control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;

  > :first-child {
    flex: 1 1 auto;
    min-width: 0;
  }
}
.focus-missing__unit-select {
  flex: 0 0 6rem;
}
.focus-missing__unit {
  font-size: var(--fs-200);
  color: var(--text-muted);
}
</style>
