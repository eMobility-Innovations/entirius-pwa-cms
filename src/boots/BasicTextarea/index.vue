<template>
  <div class="basic-textarea flex-column gap-1">
    <textarea
      ref="field"
      v-bind="attrs"
      class="basic-textarea__field"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :readonly="readonly"
      :value="modelValue ?? ''"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <span v-if="maxlength" class="basic-textarea__counter fs-200 t-muted" aria-live="polite">
      {{ length }} / {{ maxlength }}
    </span>
  </div>
</template>

<script setup>
// Multi-line text (docs/ui-components.md § P3 inputs), replaces TextAreaBasic: `v-model`, `rows`, `maxlength` (with a
// counter), `placeholder`, `disabled`, `readonly`, `autogrow` (the box grows with its text from `rows` up to the
// max height, then scrolls). Inside a FormField it takes id, aria-describedby, aria-invalid, required and disabled
// from the contract.
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  modelValue: { type: [String, Number], default: "" },
  rows: { type: [Number, String], default: 4 },
  maxlength: { type: Number, default: null },
  placeholder: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  autogrow: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);
const field = ref(null);

// Height from the content: reset first so the box can shrink; the border is outside scrollHeight.
function grow() {
  const el = field.value;
  if (!props.autogrow || !el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}

onMounted(grow);
watch(() => props.modelValue, () => nextTick(grow));

const { attrs } = useControlAttrs({ disabled: () => props.disabled });
const length = computed(() => String(props.modelValue ?? "").length);
</script>

<style lang="scss" scoped>
.basic-textarea__field {
  display: block;
  width: 100%;
  min-height: var(--elem-height);
  max-height: 400px;
  padding: var(--space-1) var(--space-2);
  resize: vertical;
  overflow: auto;
  font: inherit;
  color: var(--text-body);
  background-color: var(--surface-sunken);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  outline: 0;
  transition: border-color 0.2s;

  &::placeholder {
    color: var(--text-muted);
  }


  &:read-only:not(:disabled) {
    background-color: var(--surface-raised);
    border-color: var(--border-subtle);
    color: var(--text-muted);
  }

  // After read-only: a readonly value in error still shows it.
  &[aria-invalid="true"] {
    border-color: var(--negative);
  }

  // The disabled look of BasicInput and NumberInput.
  &:disabled {
    background-color: var(--surface-disabled);
    border-color: var(--border-subtle);
    color: var(--text-muted);
    cursor: not-allowed;
  }
}

.basic-textarea__counter {
  align-self: flex-end;
}
</style>
