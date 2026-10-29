<template>
  <label class="checkbox-item inline-flex ai-ct gap-2" :class="{ 'checkbox-item--disabled': controlDisabled }">
    <span class="checkbox-item__box relative inline-flex">
      <input
        v-bind="attrs"
        type="checkbox"
        class="checkbox-item__input"
        :checked="modelValue"
        @change="emit('update:modelValue', $event.target.checked)"
      />
      <FontAwesomeIcon v-if="modelValue" :icon="ICONS.check" class="checkbox-item__mark" aria-hidden="true" />
    </span>
    <span v-if="$slots.default" class="checkbox-item__label"><slot /></span>
  </label>
</template>

<script setup>
// One checkbox (docs/ui-components.md § P3 inputs): a boolean `v-model`, its label in the default slot, `disabled`.
// Inside a FormField it takes id, aria-describedby, aria-invalid, required and disabled from the contract.
import { ICONS } from "@/boots/Icons/icons";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const { attrs, disabled: controlDisabled } = useControlAttrs({ disabled: () => props.disabled });
</script>

<style lang="scss" scoped>
.checkbox-item {
  cursor: pointer;
  color: var(--text-body);

  &--disabled {
    cursor: not-allowed;
    color: var(--text-muted);
  }
}

.checkbox-item__box {
  flex-shrink: 0;
}

.checkbox-item__input {
  appearance: none;
  width: 20px;
  height: 20px;
  margin: 0;
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  background-color: var(--surface-sunken);
  cursor: inherit;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--border-strong);
  }

  &:checked {
    background-color: var(--accent-fill);
    border-color: var(--accent);
  }

  &[aria-invalid="true"] {
    border-color: var(--negative);
  }

  &:disabled {
    background-color: var(--surface-disabled);
    border-color: var(--border-subtle);
  }
}

.checkbox-item__mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--fs-200);
  color: var(--text-on-accent-fill);
  pointer-events: none;
}

.checkbox-item--disabled .checkbox-item__mark {
  color: var(--text-muted);
}
</style>
