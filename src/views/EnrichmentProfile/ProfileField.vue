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
  <RoutingMap v-else :model-value="mapValue" :testid="`${testid}-json`" />
</template>

<script>
import ChipList from "./ChipList.vue";
import MarkdownField from "./MarkdownField.vue";
import RowsTable from "./RowsTable.vue";
import RoutingMap from "./RoutingMap.vue";

// One profile value edited the way its schema kind says (profileLogic.fieldKind): markdown text, a line, chips, a
// table of records; anything else (the routing map) is shown in plain words and edited in "Edit JSON".
export default {
  name: "ProfileField",
  components: { ChipList, MarkdownField, RoutingMap, RowsTable },
  props: {
    field: { type: Object, required: true },
    section: { type: String, default: "" },
    modelValue: { type: [String, Array, Object], default: null },
    errors: { type: Object, default: () => ({}) },
    testid: { type: String, default: "profile-field" },
  },
  emits: ["update:modelValue"],
  computed: {
    mapValue() {
      const value = this.modelValue;
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    },
  },
  methods: {
    emitValue(value) {
      this.$emit("update:modelValue", value);
    },
  },
};
</script>
