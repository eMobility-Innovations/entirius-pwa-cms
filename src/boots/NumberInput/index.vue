<template>
  <div class="number-input-wrapper">
    <div
      class="number-input flex ai-ct"
      :class="{ 'number-input--disabled': controlDisabled, 'number-input--invalid': invalid }"
    >
      <button
        type="button"
        class="number-input__btn"
        :disabled="controlDisabled || isAtMin"
        @click="decrement"
      >
        <span class="number-input__icon">&minus;</span>
      </button>
      <input
        ref="inputEl"
        v-bind="attrs"
        type="text"
        :inputmode="decimals ? 'decimal' : 'numeric'"
        class="number-input__value"
        :value="displayValue"
        :placeholder="placeholder"
        @input="onTextInput"
        @keydown.up.prevent="increment"
        @keydown.down.prevent="decrement"
        @focusout="onFocusout"
      />
      <button
        type="button"
        class="number-input__btn"
        :disabled="controlDisabled || isAtMax"
        @click="increment"
      >
        <span class="number-input__icon">+</span>
      </button>
      <span v-if="suffix" class="number-input__suffix">{{ suffix }}</span>
    </div>
  </div>
</template>

<script setup>
// Stepper number (docs/ui-components.md § P3 inputs): `v-model`, `min` / `max` / `step`, `suffix`, `disabled`. Inside a
// FormField the value field takes id, aria-describedby, aria-invalid, required and disabled from the contract.
import { computed } from "vue";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: "",
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 9999,
  },
  step: {
    type: Number,
    default: 1,
  },
  suffix: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "0",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);
const { attrs, disabled: controlDisabled, invalid } = useControlAttrs({ disabled: () => props.disabled });

// A fractional step (0.01) turns on decimal entry: "," reads as ".", values round to the step's places.
const decimals = computed(() => (String(props.step).split(".")[1] || "").length);

const numericValue = computed(() => {
  const n = decimals.value
    ? parseFloat(String(props.modelValue).replace(",", "."))
    : parseInt(props.modelValue, 10);
  return isNaN(n) ? null : n;
});

// Decimal mode shows the text as typed, so "8." survives until the next digit.
const displayValue = computed(() => {
  if (decimals.value) return String(props.modelValue ?? "");
  return numericValue.value !== null ? String(numericValue.value) : "";
});

const isAtMin = computed(
  () => numericValue.value !== null && numericValue.value <= props.min
);
const isAtMax = computed(
  () => numericValue.value !== null && numericValue.value >= props.max
);

function clamp(val) {
  const rounded = Number(val.toFixed(decimals.value));
  return Math.min(props.max, Math.max(props.min, rounded));
}

function increment() {
  const base = numericValue.value !== null ? numericValue.value : props.min;
  emit("update:modelValue", String(clamp(base + props.step)));
}

function decrement() {
  const base = numericValue.value !== null ? numericValue.value : props.min;
  emit("update:modelValue", String(clamp(base - props.step)));
}

// One rule for typed text: a leading "-" only when min < 0, one decimal separator ("," reads as "."; a second one is
// dropped), digits otherwise.
function normalise(text) {
  const negative = props.min < 0 && text.trimStart().startsWith("-");
  const kept = text.replace(/,/g, ".").replace(decimals.value ? /[^0-9.]/g : /[^0-9]/g, "");
  const [whole, ...fraction] = kept.split(".");
  const number = kept.includes(".") ? `${whole}.${fraction.join("")}` : whole;
  return negative ? `-${number}` : number;
}

// The field shows the normalised text even when the model does not change (a rejected "-" on an empty field).
function onTextInput(e) {
  const value = normalise(e.target.value);
  e.target.value = value;
  emit("update:modelValue", value);
}

function onFocusout() {
  if (numericValue.value === null) return;
  emit("update:modelValue", String(clamp(numericValue.value)));
}
</script>

<style lang="scss">
@import "@/assets/scss/utils/touch-target";

.number-input-wrapper {
  background-color: transparent;
  color: var(--text-body);
}

.number-input {
  border: 1px solid var(--border-control);
  background-color: var(--surface-sunken);
  border-radius: var(--radius-base);
  height: var(--elem-height);
  padding: 0;
  transition: border-color 0.2s;
  overflow: hidden;

  // The steppers' hit areas reach past the border on a phone; the buttons round their own outer corners instead.
  @include max-tablet {
    overflow: visible;
  }

  &:focus-within {
    border-color: var(--border-strong);
  }

  &--invalid,
  &--invalid:focus-within {
    border-color: var(--negative);
  }

  // Same disabled look as BasicInput: a locked value is readable but plainly not editable.
  &--disabled,
  &--disabled:focus-within {
    background-color: var(--surface-disabled);
    border-color: var(--border-subtle);
    color: var(--text-muted);
    cursor: not-allowed;
  }

  &--disabled .number-input__value {
    cursor: not-allowed;
  }
}

.number-input__btn {
  width: 32px;
  min-width: 32px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, color 0.15s;
  padding: 0;

  &:hover:not(:disabled) {
    background-color: var(--surface-raised);
    color: var(--text-body);
  }

  &:active:not(:disabled) {
    background-color: var(--surface-hover);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  // Flush with the value field: the hit area grows to 40 px in height only, never over the field.
  @include touch-target(100%, var(--space-10));

  &:first-child {
    border-right: 1px solid var(--border-default);
    border-radius: var(--radius-base) 0 0 var(--radius-base);
  }

  &:last-of-type {
    border-left: 1px solid var(--border-default);
  }

  &:last-child {
    border-radius: 0 var(--radius-base) var(--radius-base) 0;
  }
}

.number-input__icon {
  font-size: var(--fs-300);
  font-weight: 600;
  line-height: 1;
  user-select: none;
}

// width: 100% drops the input's ~170 px intrinsic minimum, so the stepper fits a narrow cell or phone row; the value
// keeps room for a few digits.
.number-input__value {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  text-align: center;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  background: transparent;
  height: 100%;
  min-width: 3em;
  padding: 0 var(--space-1);
}

.number-input__suffix {
  padding-right: var(--space-2);
  font-size: var(--fs-200);
  color: var(--text-muted);
  user-select: none;
  white-space: nowrap;
}
</style>
