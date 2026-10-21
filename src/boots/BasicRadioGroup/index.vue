<template>
  <div
    :id="attrs.id"
    role="radiogroup"
    class="radio-group gap-2"
    :class="layout === 'list' ? 'flex-column' : `radio-group--${layout}`"
    :aria-labelledby="field.labelId?.value || undefined"
    :aria-describedby="attrs['aria-describedby']"
    :aria-invalid="attrs['aria-invalid']"
    :aria-required="attrs.required ? 'true' : undefined"
    :aria-disabled="controlDisabled ? 'true' : undefined"
  >
    <label
      v-for="option in options"
      :key="option.value"
      class="radio-group__option ai-ct gap-2"
      :class="{
        'inline-flex': layout === 'list',
        'radio-group__option--disabled': controlDisabled || option.disabled,
      }"
    >
      <input
        type="radio"
        class="radio-group__input"
        :name="groupName"
        :value="option.value"
        :checked="modelValue === option.value"
        :disabled="controlDisabled || option.disabled"
        :aria-invalid="attrs['aria-invalid']"
        :data-testid="option.testid || null"
        @change="emit('update:modelValue', option.value)"
      />
      <slot name="option" :option="option" :checked="modelValue === option.value">
        <span>{{ option.label }}</span>
      </slot>
    </label>
  </div>
</template>

<script setup>
// Single choice (docs/ui-components.md § P3 inputs): `options` [{ label, value, disabled?, testid? }], `v-model`, `name`,
// `disabled`. Native radios sharing one `name`: Tab enters the group on the checked option, the arrow keys move and
// select inside it (role="radiogroup"). Inside a FormField the group is named by the field's label and takes
// aria-describedby, aria-invalid, required and disabled from the contract. `layout="tiles"`: the options as a grid of
// square tiles drawn by the `option` slot (`{ option, checked }`, e.g. a thumbnail), the radio itself hidden, the picked
// tile in the accent border; the option's `label` stays its accessible name (put it in the slot, e.g. as an img alt).
// `layout="cards"`: the same, as wider cards of any height (a 16:9 image and a caption), one per row on a phone.
import { computed, useId } from "vue";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: [String, Number, Boolean], default: null },
  name: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  layout: { type: String, default: "list", validator: (value) => ["list", "tiles", "cards"].includes(value) },
});
const emit = defineEmits(["update:modelValue"]);

const { field, attrs, disabled: controlDisabled } = useControlAttrs({ disabled: () => props.disabled });
const generatedName = useId();
const groupName = computed(() => props.name || generatedName);
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.radio-group--tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: var(--space-3);

  .radio-group__option {
    position: relative;
    display: block;
    aspect-ratio: 1;
    border: 2px solid var(--border-subtle);
    border-radius: var(--radius-base);
    background: var(--surface-sunken);
    overflow: hidden;

    &:hover:not(.radio-group__option--disabled) {
      border-color: var(--border-strong);
    }

    &:has(:checked),
    &:has(:checked):hover {
      border-color: var(--accent);
    }

    &:has(:focus-visible) {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }

  .radio-group__input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
}

.radio-group--cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-4);

  .radio-group__option {
    position: relative;
    display: block;
    padding: var(--space-3);
    border: 2px solid var(--border-subtle);
    border-radius: var(--radius-lg);

    &:hover:not(.radio-group__option--disabled) {
      border-color: var(--border-strong);
    }

    &:has(:checked),
    &:has(:checked):hover {
      border-color: var(--accent);
    }

    &:has(:focus-visible) {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }

  .radio-group__input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
}

@include max-tablet {
  .radio-group--cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.radio-group__option {
  cursor: pointer;
  color: var(--text-body);

  &--disabled {
    cursor: not-allowed;
    color: var(--text-muted);
  }
}

.radio-group__input {
  appearance: none;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin: 0;
  border: 1px solid var(--border-control);
  border-radius: var(--radius-full);
  background-color: var(--surface-sunken);
  cursor: inherit;
  transition: border-color 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--border-strong);
  }

  // The dot: a radial fill, since an input draws no pseudo-element everywhere.
  &:checked {
    border-color: var(--accent);
    background: radial-gradient(circle, var(--accent) 0 5px, var(--surface-sunken) 5.5px);
  }

  &[aria-invalid="true"] {
    border-color: var(--negative);
  }

  &:disabled {
    border-color: var(--border-subtle);
    background-color: var(--surface-disabled);
  }

  &:disabled:checked {
    background: radial-gradient(circle, var(--text-muted) 0 5px, var(--surface-disabled) 5.5px);
  }
}
</style>
