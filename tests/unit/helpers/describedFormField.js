import { h, provide, ref, useId } from "vue";
import { FORM_FIELD } from "@/composables/formField";

// A FormField stand-in whose control is already described (an error or a hint id, `FIELD_DESCRIPTION`): a control
// that adds its own `aria-describedby` must keep this id next to its own.
export const FIELD_DESCRIPTION = "field-description";

export const DescribedFormField = {
  name: "FormField",
  setup(_, { slots }) {
    provide(FORM_FIELD, {
      id: ref(useId()),
      describedBy: ref(FIELD_DESCRIPTION),
      invalid: ref(false),
      required: ref(false),
      disabled: ref(false),
      labelId: ref(""),
    });
    return () => h("div", slots.default?.());
  },
};
