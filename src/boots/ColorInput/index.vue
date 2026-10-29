<template>
  <div class="color-input-wrapper">
    <div
      class="color-input flex ai-ct"
      :class="{ 'color-input--disabled': controlDisabled, 'color-input--invalid': invalid }"
    >
      <div class="color-input__swatch" data-census="data" :style="{ backgroundColor: modelValue || 'transparent' }">
        <input
          type="color"
          class="color-input__native"
          :value="modelValue || '#000000'"
          :disabled="controlDisabled"
          :aria-labelledby="field.labelId?.value || undefined"
          :aria-label="field.labelId?.value ? undefined : $t('common.color_picker')"
          @input="onPickerInput"
        />
      </div>
      <input
        v-bind="attrs"
        type="text"
        class="color-input__text w-100 bg-inherit"
        :value="modelValue"
        :placeholder="placeholder || '#000000'"
        @input="onTextInput"
        @focusout="$emit('onFocusout', modelValue)"
      />
    </div>
  </div>
</template>

<script setup>
// Colour (docs/ui-components.md § P3 inputs): `v-model` (hex), `placeholder`, `disabled`. The swatch is the native
// colour picker itself (transparent over the swatch), so a click or a key on it opens the picker. Inside a FormField
// the text field takes id, aria-describedby, aria-invalid, required and disabled from the contract.
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "#000000",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);
const {
  field,
  attrs,
  disabled: controlDisabled,
  invalid,
} = useControlAttrs({ disabled: () => props.disabled });

function onPickerInput(e) {
  emit("update:modelValue", e.target.value.toUpperCase());
}

function onTextInput(e) {
  emit("update:modelValue", e.target.value);
}
</script>

<style lang="scss">
.color-input-wrapper {
  background-color: transparent;
  color: var(--text-body);
}

.color-input {
  border: 1px solid var(--border-control);
  background-color: var(--surface-sunken);
  border-radius: var(--radius-base);
  height: var(--elem-height);
  padding: 0;
  transition: border-color 0.2s;
  overflow: hidden;

  &:focus-within {
    border-color: var(--border-strong);
  }

  &--invalid,
  &--invalid:focus-within {
    border-color: var(--negative);
  }

  // The disabled look of BasicInput.
  &--disabled {
    background-color: var(--surface-disabled);
    border-color: var(--border-subtle);
    color: var(--text-muted);

    .color-input__native {
      cursor: not-allowed;
    }
  }
}

// Inset swatch with its own edge, so a white colour on a light field still shows where it ends.
.color-input__swatch {
  width: var(--space-6);
  min-width: var(--space-6);
  height: var(--space-6);
  margin: 0 var(--space-1);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  position: relative;
  overflow: hidden;
}

.color-input__native {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.color-input__text {
  border: none;
  outline: none;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  background: transparent;
  height: 100%;
  padding: 0 var(--space-2);
}
</style>
