<template>
  <div class="rows-table flex-column gap-3" :data-testid="testid">
    <p
      v-if="!modelValue.length"
      class="m-0 fs-300 t-secondary"
      :data-testid="`${testid}-empty`"
    >
      {{ $t("enrichment.profile.no_rows") }}
    </p>
    <div
      v-for="(row, index) in modelValue"
      :key="row.id || index"
      class="rows-table__row"
      :class="{ 'rows-table__row--off': row.active === false }"
      :data-testid="`${testid}-row-${index}`"
    >
      <div class="rows-table__fields">
        <FormField
          v-for="column in visibleColumns"
          :key="column.key"
          :label="columnLabel(column.key)"
          :required="column.required"
          :error="errorAt(index, column.key)"
          :class="{ 'rows-table__wide': column.kind === 'markdown' }"
        >
          <BasicSwitch
            v-if="column.kind === 'switch'"
            :model-value="row[column.key] !== false"
            :label="$t('enrichment.profile.active')"
            @update:model-value="(value) => set(index, column.key, value)"
          />
          <BasicTextarea
            v-else-if="column.kind === 'markdown'"
            :model-value="row[column.key] || ''"
            :rows="3"
            @update:model-value="(value) => set(index, column.key, value)"
          />
          <BasicInput
            v-else-if="column.kind === 'map'"
            :model-value="mapToText(row[column.key])"
            :placeholder="$t('enrichment.profile.map_placeholder')"
            @on-focusout="(text) => set(index, column.key, textToMap(text))"
          />
          <BasicInput
            v-else
            :model-value="row[column.key] || ''"
            :maxlength="500"
            @update:model-value="(value) => set(index, column.key, value)"
          />
        </FormField>
      </div>
      <IconButton
        class="rows-table__remove"
        icon="delete"
        variant="danger"
        mutates
        :label="$t('enrichment.profile.remove_row')"
        :data-testid="`${testid}-remove-${index}`"
        @click="remove(index)"
      />
    </div>
    <BasicButton
      class="rows-table__add"
      size="sm"
      icon="add"
      mutates
      :data-testid="`${testid}-add`"
      @click="add"
    >
      {{ $t("enrichment.profile.add_row") }}
    </BasicButton>
  </div>
</template>

<script>
import { emptyRow, mapToText, textToMap } from "./profileLogic";

// The schema validator's message for a missing key of a row.
const MISSING = /'([a-z_]+)' is a required property/;

// A list of records (facts, rules, personas, spellings, glossary): one bordered row per record, its fields labelled
// by the profile's column names; ids are generated, never shown. `errors` are the API's, keyed "<index>.<column>".
export default {
  name: "RowsTable",
  props: {
    modelValue: { type: Array, default: () => [] },
    columns: { type: Array, required: true },
    section: { type: String, default: "" },
    errors: { type: Object, default: () => ({}) },
    testid: { type: String, default: "rows-table" },
  },
  emits: ["update:modelValue"],
  computed: {
    visibleColumns() {
      return this.columns.filter((column) => column.key !== "id");
    },
  },
  methods: {
    mapToText,
    textToMap,
    columnLabel(key) {
      const path = `enrichment.profile.columns.${key}`;
      const label = this.$t(path);
      return label === path ? key : label;
    },
    // A cell's own error; a row's error ("'value' is a required property") goes to the cell it names, else to the
    // row's first field — never to every field of the row.
    errorAt(index, key) {
      const own = this.errors[`${index}.${key}`];
      if (own) return own;
      const row = this.errors[`${index}`];
      if (!row) return "";
      const missing = MISSING.exec(row)?.[1];
      if (missing) return missing === key ? this.$t("enrichment.profile.json_error.required") : "";
      return key === this.visibleColumns[0]?.key ? row : "";
    },
    set(index, key, value) {
      this.$emit(
        "update:modelValue",
        this.modelValue.map((row, i) =>
          i === index ? { ...row, [key]: value } : row
        )
      );
    },
    add() {
      this.$emit("update:modelValue", [
        ...this.modelValue,
        emptyRow(this.columns, this.modelValue, this.section),
      ]);
    },
    remove(index) {
      this.$emit(
        "update:modelValue",
        this.modelValue.filter((_, i) => i !== index)
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.rows-table__row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.rows-table__row--off {
  background: var(--surface-raised);
}
.rows-table__fields {
  display: grid;
  flex: 1;
  min-width: 0;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-3);
}
.rows-table__wide {
  grid-column: 1 / -1;
}
.rows-table__add {
  align-self: flex-start;
}
</style>
