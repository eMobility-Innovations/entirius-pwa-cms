<template>
  <div class="basic-switch inline-flex ai-ct gap-2" :class="{ 'basic-switch--disabled': controlDisabled }">
    <label v-if="label" :for="attrs.id" class="basic-switch__label">{{ label }}</label>
    <BasicTooltip v-if="hint" variant="help" :level="hintLevel" :text="hint" />
    <button
      type="button"
      role="switch"
      class="basic-switch__track relative"
      :class="{ 'basic-switch__track--on': modelValue }"
      :id="attrs.id"
      :aria-checked="String(modelValue)"
      :aria-describedby="attrs['aria-describedby']"
      :aria-invalid="attrs['aria-invalid']"
      :disabled="controlDisabled"
      @click="emit('update:modelValue', !modelValue)"
    />
  </div>
</template>

<script setup>
// On/off toggle (docs/ui-components.md § P3 inputs), replaces Switcher: `v-model`, `label`, `hint` + `hintLevel` (the
// field-hint mark next to the label, as FormField's), `disabled`. A `role="switch"` button with `aria-checked`; its
// own `label` names it, inside a FormField the field's label does (`for` = the contract id).
import BasicTooltip from "@/boots/BasicTooltip/index.vue";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: "" },
  hint: { type: String, default: "" },
  hintLevel: { type: String, default: "subtle", validator: (value) => ["subtle", "important"].includes(value) },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const { attrs, disabled: controlDisabled } = useControlAttrs({ disabled: () => props.disabled });
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/touch-target";

$size: 1.25rem;
$transition: 0.25s ease-in-out;

.basic-switch__label {
  cursor: pointer;
}

.basic-switch__track {
  flex-shrink: 0;
  width: 2 * $size;
  height: $size;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--surface-base);
  cursor: pointer;
  transition: background $transition, border-color $transition;

  // The thumb.
  &::before {
    content: "";
    position: absolute;
    top: 50%;
    left: -1px;
    width: $size;
    height: $size;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-full);
    background: var(--surface-base);
    box-shadow: var(--shadow-sm);
    transform: translate(0, -50%);
    transition: transform $transition, border-color $transition;
  }

  &--on {
    background: var(--accent-fill);
    border-color: var(--accent);

    &::before {
      border-color: var(--accent);
      transform: translate(100%, -50%);
    }
  }

  &[aria-invalid="true"] {
    border-color: var(--negative);
  }

  @include touch-target;
}

.basic-switch--disabled {
  opacity: 0.5;

  .basic-switch__label,
  .basic-switch__track {
    cursor: not-allowed;
  }
}
</style>
