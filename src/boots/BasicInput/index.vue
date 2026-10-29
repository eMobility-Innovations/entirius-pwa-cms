<template>
  <div class="input-basic-wrapper" :class="[`input-basic-wrapper--${size}`, { relative: $slots.trailing }]">
    <div class="input-basic h-100 relative flex br-inherit">
      <input
        ref="inputEl"
        v-bind="attrs"
        :type="type"
        class="input-field w-100 bg-inherit"
        :class="{ 'has-placeholder': placeholder, 'input-field--icon': leadingIcon, 'input-field--trailing': $slots.trailing }"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :min="min"
        :max="max"
        :step="step"
        :name="attrs.id"
        :value="shown"
        :readonly="readonly"
        @input="onInput"
        @focusout="onFocusout"
        @keydown.enter="emit('onKeyDown', $event.target.value)"
      />
      <div
        v-if="leadingIcon"
        class="icon-wrapper absolute flex jc-ct ai-ct"
        aria-hidden="true"
      >
        <FontAwesomeIcon :icon="ICONS[leadingIcon]" />
      </div>
    </div>
    <div v-if="$slots.trailing" class="input-trailing absolute flex jc-ct ai-ct">
      <slot name="trailing" />
    </div>
  </div>
</template>

<script setup>
// Single-line text (docs/ui-components.md § P3 inputs): `v-model`, `type`, `placeholder`, `icon` (a leading meaning
// of icons.js), `readonly` (the value behind a lock, the former LockedField), `disabled`, and the native `maxlength`,
// `autocomplete`, `inputmode`, `min`, `max`, `step` (on the <input>, never the wrapper). Inside a
// FormField it takes id, aria-describedby, aria-invalid, required and disabled from the contract; the label and the
// error text are the FormField's. A caller's `aria-describedby` joins the field's. `null` and `false` show an empty
// field, `0` shows "0". `focusOnCreate` focuses it on mount;
// `onFocusout` / `onKeyDown` (Enter) emit the current text. `size`: md = --elem-height (default), lg = 40 px
// at --radius-xl like its button (the sign-in screens, AuthLayout). Slot `trailing`: a control inside the right edge (the password reveal), the text
// stops before it. `format` (src/utils/formats.js: money, integer, ean, key, …) shows the model in that format, puts
// the parsed value in the model as it is typed ("232,5" → "232.50"), and once the field is left shows what is wrong
// through the FormField error (the red border alone outside one); `min` / `max` / `pattern` are its rules. A save still
// checks the form itself (useFormErrors `validateFormats`).
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { FORMATS, displayFormat, formatError, parseFormat } from "@/utils/formats";
import { ICONS } from "@/boots/Icons/icons";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  // A String: a boolean default would render as the literal "false" placeholder.
  placeholder: { type: String, default: "" },
  modelValue: { type: [String, Number, Boolean], default: "" },
  type: { type: String, default: "text" },
  id: { type: String, default: "" },
  focusOnCreate: { type: Boolean, default: false },
  // A meaning of the icon registry (src/boots/Icons/icons.js), e.g. "search".
  icon: { type: String, default: null },
  readonly: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  // The native length limit (a language code, an address the API caps).
  maxlength: { type: Number, default: null },
  // "off" keeps the browser from offering the operator's own name, email or phone in someone else's record.
  autocomplete: { type: String, default: null },
  inputmode: { type: String, default: null },
  min: { type: [Number, String], default: null },
  max: { type: [Number, String], default: null },
  step: { type: [Number, String], default: null },
  size: { type: String, default: "md", validator: (value) => ["md", "lg"].includes(value) },
  format: { type: String, default: null, validator: (value) => value in FORMATS },
  // The API regex of a `code` / `key` format.
  pattern: { type: String, default: null },
  ariaDescribedby: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue", "onFocusout", "onKeyDown"]);

const inputEl = ref(null);
// The text as typed while the field has focus (a format shows the model its own way once the field is left).
const draft = ref(null);
const left = ref(false);
const shown = computed(() => {
  if (draft.value !== null) return draft.value;
  if (props.modelValue === null || props.modelValue === false) return "";
  return props.format ? displayFormat(props.format, props.modelValue) : props.modelValue;
});
const formatMessage = computed(() => {
  if (!props.format || !left.value) return "";
  return formatError(props.format, props.modelValue, { min: props.min, max: props.max, pattern: props.pattern });
});
const leadingIcon = computed(() => (props.readonly ? "lock" : props.icon));
const { attrs, field } = useControlAttrs({
  id: () => props.id,
  disabled: () => props.disabled,
  invalid: () => Boolean(formatMessage.value),
  describedBy: () => props.ariaDescribedby,
});

function onInput(event) {
  const text = event.target.value;
  if (!props.format) return emit("update:modelValue", text);
  draft.value = text;
  left.value = false;
  emit("update:modelValue", parseFormat(props.format, text));
}

function onFocusout(event) {
  draft.value = null;
  left.value = true;
  emit("onFocusout", event.target.value);
}

// A model the parent changes or resets while the field has focus (a submit on Enter) wins over the typed text; the
// field's own emit parses back to the model and keeps it.
watch(
  () => props.modelValue,
  (value) => {
    if (draft.value !== null && parseFormat(props.format, draft.value) !== value) draft.value = null;
  },
);
watch(formatMessage, (message) => field.reportError?.(message));
onBeforeUnmount(() => formatMessage.value && field.reportError?.(""));

onMounted(() => props.focusOnCreate && inputEl.value.focus());
</script>

<style lang="scss">
.input-basic-wrapper {
  --input-height: var(--elem-height);

  background-color: transparent;
  color: var(--text-body);
  .input-field {
    overflow: hidden;
    border-radius: inherit;
    padding: var(--space-1) var(--space-2);
    height: var(--input-height);
    font-size: inherit;
    font-family: inherit;
    border: 1px solid;
    border-color: var(--border-control);
    border-radius: var(--radius-base);
    transition: border-color 0.2s;
    outline: 0;
    color: inherit;
    background-color: var(--surface-sunken);

    &::placeholder {
      color: transparent;
    }
    &.has-placeholder::placeholder {
      color: var(--text-muted);
    }

    &--icon {
      padding-left: var(--input-height);
    }

    &--trailing {
      padding-right: var(--input-height);
    }

    // The former LockedField: the value stays readable and selectable behind the lock icon.
    &:read-only:not(:disabled) {
      background-color: var(--surface-raised);
      border-color: var(--border-subtle);
      color: var(--text-muted);
    }

    // After read-only: a readonly value in error still shows it.
    &[aria-invalid="true"] {
      border-color: var(--negative);
    }

    // A locked value is readable but plainly not editable.
    &:disabled {
      background-color: var(--surface-disabled);
      border-color: var(--border-subtle);
      color: var(--text-muted);
      cursor: not-allowed;
    }
  }

  // Leading and decorative (no caller acts on it): a click goes through to the input.
  .icon-wrapper {
    pointer-events: none;
    width: var(--input-height);
    height: var(--input-height);
    left: 0;
    top: 50%;
    transform: translate(0, -50%);
  }

  .input-trailing {
    top: 50%;
    right: 0;
    width: var(--input-height);
    height: var(--input-height);
    transform: translateY(-50%);
  }
}

.input-basic-wrapper--lg {
  --input-height: var(--space-10);

  .input-field {
    border-radius: var(--radius-xl);
  }
}
</style>
