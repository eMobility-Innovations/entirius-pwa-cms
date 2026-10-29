<template>
  <div class="qa-check-toggle flex-column gap-1" data-testid="qa-check-toggle">
    <BasicSwitch
      :model-value="effective"
      :label="$t('enrichment.qa.run_toggle')"
      :disabled="disabled || fallback === null"
      data-testid="qa-check-toggle-switch"
      @update:model-value="(value) => $emit('update:modelValue', value)"
    />
    <p v-if="fallback !== null" class="m-0 fs-200 t-secondary" data-testid="qa-check-toggle-note">
      {{ $t(fallback ? "enrichment.qa.run_default_on" : "enrichment.qa.run_default_off") }}
    </p>
  </div>
</template>

<script>
import { loadQaCheckDefault } from "./qaCheck";

// The per-run override of the automatic guidelines check. `modelValue` null = the Settings default (shown, and the
// switch starts there); a flip makes it this run's own choice (true / false). Send it with `qaCheckParams` (qaCheck.js).
export default {
  name: "QaCheckToggle",
  props: {
    modelValue: { type: Boolean, default: null },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  data() {
    return { fallback: null };
  },
  computed: {
    effective() {
      return this.modelValue ?? !!this.fallback;
    },
  },
  async mounted() {
    this.fallback = await loadQaCheckDefault();
  },
};
</script>
