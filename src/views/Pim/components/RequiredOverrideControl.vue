<template>
  <SegmentedControl
    :options="options"
    :model-value="state"
    :disabled="disabled"
    :aria-label="$t('pim.required_override_label', { name })"
    @update:model-value="
      (value) => $emit('update:modelValue', stateToOverride(value))
    "
  />
</template>

<script setup>
// Per-set required flag of one feature (PIM >= 3.3.0): Inherit (shows the feature's own flag) / Required / Optional.
// `v-model` is the raw override: true | false | null (inherit). A system feature is fixed by the PIM: disabled.
import { computed } from "vue";
import { t } from "@/i18n";
import { overrideToState, stateToOverride } from "../helpers/requiredFeatures";

const props = defineProps({
  modelValue: { type: Boolean, default: null },
  featureRequired: { type: Boolean, default: false },
  name: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
});

defineEmits(["update:modelValue"]);

const state = computed(() => overrideToState(props.modelValue));
const options = computed(() => [
  {
    label: t("pim.required_inherit", {
      state: t(
        props.featureRequired
          ? "pim.required_state_required"
          : "pim.required_state_optional"
      ),
    }),
    value: "inherit",
    testid: "required-inherit",
  },
  {
    label: t("pim.required_state_required"),
    value: "required",
    testid: "required-required",
  },
  {
    label: t("pim.required_state_optional"),
    value: "optional",
    testid: "required-optional",
  },
]);
</script>
