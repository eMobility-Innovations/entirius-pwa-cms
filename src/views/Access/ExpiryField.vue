<template>
  <FormField :label="$t('access.tokens.expires')" :error="error">
    <BasicRadioGroup v-model="mode" :options="modeOptions" data-testid="expiry-mode" />
  </FormField>
  <FormField v-if="mode === DATE" :label="$t('access.tokens.expiry_date')">
    <BasicDatePicker
      :model-value="modelValue"
      :config="pickerConfig"
      data-testid="expiry-date"
      @update:model-value="(date) => $emit('update:modelValue', date)"
    />
  </FormField>
</template>

<script setup>
// A token's expiry in the token dialogs: "No expiry" (the default, for every token — D31) or a date (the start of that
// local day); past days are never offered. The model is the date string ("" = no expiry); `pending` (v-model:pending)
// is true while "On a date" has no day picked, so the dialog asks for one instead of saving "No expiry".
import { computed, ref, watch, watchEffect } from "vue";
import { t } from "@/i18n";
import { minExpiryDate } from "./tokens";

const NONE = "none";
const DATE = "date";

const props = defineProps({
  modelValue: { type: String, default: "" },
  error: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue", "update:pending"]);

const mode = ref(props.modelValue ? DATE : NONE);
const modeOptions = computed(() => [
  { label: t("access.tokens.no_expiry"), value: NONE, testid: "expiry-none" },
  { label: t("access.tokens.on_date"), value: DATE, testid: "expiry-on-date" },
]);
const pickerConfig = computed(() => ({ mode: "single", wrap: true, inline: true, minDate: minExpiryDate() }));

watch(mode, (next) => next === NONE && emit("update:modelValue", ""));
watchEffect(() => emit("update:pending", mode.value === DATE && !props.modelValue));
</script>
