import BasicButton from "@/boots/BasicButton/index.vue";
import BasicInput from "@/boots/BasicInput/index.vue";
import BasicTextarea from "@/boots/BasicTextarea/index.vue";
import FormField from "@/boots/FormField/index.vue";
import StatusBadge from "@/boots/StatusBadge/index.vue";
import { leadsFrame } from "../Leads/leadsFrame";

// Plan 55: the Communicator settings on the Leads frame (plan 53), with the fields, text controls and buttons real,
// so a spec types into the field, clicks the button and reads the badge a user does. The confirmation renders its
// two actions while open.
export const communicatorFrame = {
  components: { ...leadsFrame.components, BasicTextarea },
  stubs: {
    ...leadsFrame.stubs,
    // The real components in place of the global stubs (a `false` entry loses them below a nested component).
    BasicButton,
    BasicInput,
    FormField,
    StatusBadge,
    NumberInput: { name: "NumberInput", props: ["modelValue", "min", "max"], template: "<div />" },
    ConfirmDialog: {
      name: "ConfirmDialog",
      props: ["open", "title", "message", "confirmLabel", "cancelLabel", "tone"],
      emits: ["confirm", "cancel"],
      template: `<div v-if="open">
        <button data-testid="confirm-dialog-cancel" @click="$emit('cancel')" />
        <button data-testid="confirm-dialog-confirm" @click="$emit('confirm')" />
      </div>`,
    },
  },
};

export const mountOptions = (extra = {}) => ({
  global: { components: communicatorFrame.components, stubs: { ...communicatorFrame.stubs, ...extra } },
});
