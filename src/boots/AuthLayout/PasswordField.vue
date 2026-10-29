<template>
  <FormField :label="label" :error="error">
    <BasicInput
      :model-value="modelValue"
      size="lg"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :aria-describedby="capsLock ? capsLockId : undefined"
      @update:model-value="emit('update:modelValue', $event)"
      @keydown="readCapsLock"
      @keyup="readCapsLock"
      @focusout="capsLock = false"
    >
      <template #trailing>
        <IconButton
          :icon="visible ? 'hide' : 'preview'"
          :label="$t('login.show_password')"
          :pressed="visible"
          @click="visible = !visible"
        />
      </template>
    </BasicInput>
    <p
      :id="capsLockId"
      class="fs-200 t-muted m-0"
      :class="{ 'visually-hidden': !capsLock }"
      role="status"
      data-testid="caps-lock-hint"
    >
      {{ capsLock ? $t("login.caps_lock") : "" }}
    </p>
  </FormField>
</template>

<script setup>
// A password field of the sign-in screens (AuthLayout): FormField + a `lg` BasicInput with the show/hide toggle in its
// `trailing` slot (an IconButton, `pressed` while shown) and a caps-lock hint under the input, only while caps lock is
// on — its own line, not the field's description, so a password error does not replace it. The line is a live region
// that is always there (empty and out of the flow while caps lock is off), so its text is announced, and the input
// names it in `aria-describedby` while it shows. `autocomplete` is `current-password` or `new-password`.
import { ref, useId } from "vue";

defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: "" },
  error: { type: String, default: "" },
  autocomplete: { type: String, default: "current-password" },
});
const emit = defineEmits(["update:modelValue"]);

const visible = ref(false);
const capsLock = ref(false);
const capsLockId = `${useId()}-caps-lock`;

function readCapsLock(event) {
  capsLock.value = Boolean(event.getModifierState?.("CapsLock"));
}
</script>
