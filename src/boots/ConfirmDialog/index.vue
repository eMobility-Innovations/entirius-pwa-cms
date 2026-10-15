<template>
  <BasicModal
    :open="open"
    :title="title"
    :aria-label="ariaLabel || message"
    size="sm"
    :persistent="loading"
    :inline="inline"
    @update:open="onClose"
  >
    <template v-if="$slots.title" #title><slot name="title" /></template>
    <slot>
      <p class="confirm-dialog__message t-secondary">{{ message }}</p>
    </slot>
    <template #footer>
      <ActionBar :labelled="false">
        <BasicButton variant="secondary" :disabled="loading" data-testid="confirm-dialog-cancel" @click="cancel">
          {{ cancelLabel || $t("common.cancel") }}
        </BasicButton>
        <BasicButton
          v-if="discardLabel"
          variant="danger"
          :disabled="loading"
          data-testid="confirm-dialog-discard"
          @click="emit('discard')"
        >
          {{ discardLabel }}
        </BasicButton>
        <BasicButton
          :variant="tone === 'danger' ? 'danger-solid' : 'primary'"
          :loading="loading"
          :data-testid="confirmTestid"
          @click="emit('confirm')"
        >
          {{ confirmLabel || $t("common.accept") }}
        </BasicButton>
      </ActionBar>
    </template>
  </BasicModal>
</template>

<script setup>
// Yes/no confirmation on BasicModal (sm): `v-model:open`, `title` (or the `title` slot), `message` (or the default
// slot), `ariaLabel` (the name without a title; defaults to `message`), `confirmLabel`, `cancelLabel`, `tone`
// default (primary confirm) · danger (`danger-solid` confirm: every delete, remove, flush), `loading` (spinner on confirm; Esc, backdrop and close blocked). Emits `confirm` and
// `cancel` (Cancel, close, Esc, backdrop); the caller closes it. `discardLabel` adds a third action, `discard` (unsaved changes: stay · discard ·
// save). The confirm button's test id is `confirmTestid` (`confirm-dialog-confirm`; a page-object contract may name
// another); other attributes (`data-testid`) land on the dialog element.
import BasicModal from "@/boots/BasicModal/index.vue";
import ActionBar from "@/boots/ActionBar/index.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  message: { type: String, default: "" },
  ariaLabel: { type: String, default: "" },
  confirmLabel: { type: String, default: "" },
  cancelLabel: { type: String, default: "" },
  discardLabel: { type: String, default: "" },
  tone: { type: String, default: "default", validator: (value) => ["default", "danger"].includes(value) },
  loading: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
  confirmTestid: { type: String, default: "confirm-dialog-confirm" },
});
const emit = defineEmits(["update:open", "confirm", "cancel", "discard"]);

function cancel() {
  emit("update:open", false);
  emit("cancel");
}

// While `loading` nothing dismisses it, the header close button included.
function onClose(value) {
  if (!value && !props.loading) cancel();
}
</script>

<style lang="scss" scoped>
.confirm-dialog__message {
  margin: 0;
  line-height: 1.5;
}
</style>
