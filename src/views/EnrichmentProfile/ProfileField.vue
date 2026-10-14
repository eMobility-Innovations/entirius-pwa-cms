<template>
  <MarkdownField v-if="field.kind === 'markdown'" :model-value="modelValue || ''" :testid="testid" @update:model-value="emitValue" />
  <ChipList v-else-if="field.kind === 'chips'" :model-value="modelValue || []" :testid="testid" @update:model-value="emitValue" />
  <RowsTable
    v-else-if="field.kind === 'table'"
    :model-value="modelValue || []"
    :columns="field.columns"
    :section="section"
    :errors="errors"
    :testid="testid"
    @update:model-value="emitValue"
  />
  <BasicInput v-else-if="field.kind === 'line'" :model-value="modelValue || ''" :maxlength="500" :data-testid="testid" @update:model-value="emitValue" />
  <div v-else class="flex-column gap-2" :data-testid="`${testid}-json`">
    <dl v-if="entries.length" class="m-0 flex-column gap-1 fs-300">
      <div v-for="[key, item] in entries" :key="key" class="flex flex-wrap gap-2">
        <dt class="fw-600">{{ key }}</dt>
        <dd class="m-0 t-secondary">{{ Array.isArray(item) ? item.join(", ") : item }}</dd>
      </div>
    </dl>
    <p class="m-0 fs-300 t-secondary">{{ $t("enrichment.profile.json_only") }}</p>
  </div>
</template>

<script>
import ChipList from "./ChipList.vue";
import MarkdownField from "./MarkdownField.vue";
import RowsTable from "./RowsTable.vue";

// One profile value edited the way its schema kind says (profileLogic.fieldKind): markdown text, a line, chips, a
// table of records; anything else (the routing map) is shown and edited in "Edit JSON".
export default {
  name: "ProfileField",
  components: { ChipList, MarkdownField, RowsTable },
  props: {
    field: { type: Object, required: true },
    section: { type: String, default: "" },
    modelValue: { type: [String, Array, Object], default: null },
    errors: { type: Object, default: () => ({}) },
    testid: { type: String, default: "profile-field" },
  },
  emits: ["update:modelValue"],
  computed: {
    entries() {
      const value = this.modelValue;
      return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : [];
    },
  },
  methods: {
    emitValue(value) {
      this.$emit("update:modelValue", value);
    },
  },
};
</script>
