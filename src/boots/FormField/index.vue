<template>
  <div class="form-field" :class="[`form-field--${layout}`, { 'form-field--invalid': !!shownError }]">
    <div v-if="labelled || hintShown" class="form-field__head">
      <label
        v-if="$slots.label"
        :id="labelId"
        :for="controlId"
        class="form-field__label form-field__label--custom"
        ><slot name="label"
      /></label>
      <label
        v-else-if="label"
        :id="labelId"
        :for="controlId"
        class="form-field__label field-label"
        :class="{ required }"
        >{{ label }}</label
      >
      <BasicTooltip v-if="hintShown" variant="help" :level="hintLevel" :text="hint" :tip-id="hintId" />
    </div>
    <div class="form-field__body">
      <slot />
      <p v-if="shownError" :id="errorId" class="form-field__error" role="alert">
        <span aria-hidden="true" class="form-field__error-icon">⚠</span>
        <span>{{ shownError }}</span>
      </p>
    </div>
  </div>
</template>

<script setup>
// The only owner of a field's label, required marker, error and `hint` (docs/ui-components.md § P3 inputs). The hint
// is a `?` after the label (BasicTooltip help), `hintLevel` subtle | important (plan 60); the account-menu hints switch
// hides it. It provides FORM_FIELD (src/composables/formField.js) to the control inside: `id` for the label's `for`,
// `describedBy` (the error, else the hint while hints are on), `invalid`, `required`, `disabled`; plus
// `labelId` for a control a `for` cannot name (a radio group, a segmented control), and `reportError` for a control that
// checks its own format (BasicInput `format`, plan 61) — the caller's `error` wins over it. `layout="inline"`: label
// left, control right from 1024 px, stacked below. On a read-only page (useReadonly, plan 19) `disabled` is always on.
// The `label` slot replaces the caps field label with the caller's own markup (a numbered question): it keeps the
// label's `for` and id, and the caller marks a required field itself.
import { computed, provide, ref, useId, useSlots } from "vue";
import { FORM_FIELD } from "@/composables/formField";
import { useReadonly } from "@/composables/useReadonly";
import BasicTooltip from "@/boots/BasicTooltip/index.vue";
import { useHintsOn } from "@/composables/fieldHints";

const props = defineProps({
  label: { type: String, default: "" },
  hint: { type: String, default: "" },
  hintLevel: { type: String, default: "subtle", validator: (value) => ["subtle", "important"].includes(value) },
  required: { type: Boolean, default: false },
  error: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  // The control's id when a caller needs a fixed one (a test id, an e2e selector); generated otherwise.
  id: { type: String, default: "" },
  layout: { type: String, default: "stacked", validator: (value) => ["stacked", "inline"].includes(value) },
});

const slots = useSlots();
const labelled = computed(() => Boolean(props.label || slots.label));
const generatedId = useId();
const controlId = computed(() => props.id || `${generatedId}-control`);
const labelId = `${generatedId}-label`;
const errorId = `${generatedId}-error`;
const hintId = `${generatedId}-hint`;
const hintsOn = useHintsOn();
const readonly = useReadonly();
const hintShown = computed(() => Boolean(props.hint) && hintsOn.value);
const controlError = ref("");
const shownError = computed(() => props.error || controlError.value);

// Several controls in one field (a v-for of rows): the first one mounted takes the field's id, the rest keep their own,
// so no id repeats and the label points at one control.
let owner = null;
const claim = (token) => {
  owner ??= token;
  return owner === token;
};
const release = (token) => {
  if (owner === token) owner = null;
};

provide(FORM_FIELD, {
  claim,
  release,
  id: controlId,
  describedBy: computed(() => (shownError.value ? errorId : hintShown.value ? hintId : "")),
  invalid: computed(() => !!shownError.value),
  required: computed(() => props.required),
  disabled: computed(() => props.disabled || readonly.value),
  labelId: computed(() => (labelled.value ? labelId : "")),
  reportError: (message) => (controlError.value = message),
});
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.form-field,
.form-field__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-field__head {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

// Figma "Język treści": label and control on one row on desktop, the label vertically centred on the control.
@media only screen and (min-width: $breakpoint-shell) {
  .form-field--inline {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--space-3);

    .form-field__head {
      flex-shrink: 0;
      min-height: var(--elem-height);
    }

    .form-field__body {
      flex: 1;
      min-width: 0;
    }
  }
}

.form-field__label--custom {
  flex: 1;
  min-width: 0;
}

.form-field__error {
  font-size: var(--fs-200);
  color: var(--negative);
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.form-field__error-icon {
  font-size: var(--fs-150);
  line-height: 1;
}
</style>
