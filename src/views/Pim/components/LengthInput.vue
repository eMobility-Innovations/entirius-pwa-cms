<template>
  <div class="flex ai-ct gap-3">
    <BasicInput
      :model-value="shown"
      type="number"
      data-testid="length-input"
      @update:model-value="onInput"
    />
    <BasicSelect
      :model-value="unit"
      :options="UNITS"
      data-testid="length-unit"
      @update:model-value="(next) => (unit = next)"
    />
  </div>
</template>

<script setup>
// A LENGTH attribute. PIM stores millimetres (django_pim DEFAULT_LENGTH_UNIT); manufacturers state millimetres or
// inches, so the value can be read and typed in either. The stored value stays millimetres.
import { computed, ref } from "vue";

const MM_PER_INCH = 25.4;
const UNITS = [
  { value: "mm", label: "mm" },
  { value: "inch", label: "in" },
];

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
});
const emit = defineEmits(["update:modelValue"]);

const unit = ref("mm");
const round = (value, places) => Number(Number(value).toFixed(places));
const isEmpty = (value) => value === null || value === undefined || value === "";

const shown = computed(() => {
  if (isEmpty(props.modelValue) || unit.value === "mm") return props.modelValue;
  return round(props.modelValue / MM_PER_INCH, 3);
});

function onInput(value) {
  if (isEmpty(value) || unit.value === "mm") return emit("update:modelValue", value);
  return emit("update:modelValue", round(value * MM_PER_INCH, 2));
}
</script>
