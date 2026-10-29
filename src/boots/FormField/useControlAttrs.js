import { computed, onBeforeUnmount, useId } from "vue";
import { useFormFieldControl } from "@/composables/formField";

// The native attributes a control reads from the FORM_FIELD contract (or sets alone, outside a FormField): `id`,
// `aria-describedby`, `aria-invalid`, `required`, `disabled`. `own` holds getters of the control's own props that win
// over the field: `id()`, `disabled()`, `invalid()`; `describedBy()` adds the caller's ids after the field's. Of several
// controls in one FormField only the first takes the field's id (FormField's `claim`). Call in setup().
export function useControlAttrs(own = {}) {
  const field = useFormFieldControl();
  const token = Symbol("control");
  const ownsFieldId = field.claim ? field.claim(token) : true;
  const ownId = useId();
  onBeforeUnmount(() => field.release?.(token));
  const disabled = computed(() => Boolean(own.disabled?.() || field.disabled.value));
  const invalid = computed(() => Boolean(own.invalid?.() || field.invalid.value));
  const attrs = computed(() => ({
    id: own.id?.() || (ownsFieldId ? field.id.value : ownId),
    "aria-describedby": joinIds(field.describedBy.value, own.describedBy?.()),
    "aria-invalid": invalid.value ? "true" : undefined,
    required: field.required.value || undefined,
    disabled: disabled.value,
  }));
  return { field, disabled, invalid, attrs };
}

// The field's description id and a caller's own ids (a note under the control) in one `aria-describedby`.
export const joinIds = (...ids) => ids.filter(Boolean).join(" ") || undefined;
