<template>
  <BasicModal
    :open="visible"
    :title="title"
    size="md"
    :persistent="!stored"
    :inline="inline"
    :actions="actions"
    data-testid="secret-reveal"
    @update:open="(next) => !next && close()"
  >
    <p :id="warningId" class="secret-reveal__warning fs-300 mb-4" role="alert">{{ $t("secret_reveal.warning") }}</p>
    <label class="field-label" :for="fieldId">{{ $t("secret_reveal.label") }}</label>
    <input
      :id="fieldId"
      ref="field"
      class="secret-reveal__value"
      type="text"
      readonly
      autocomplete="off"
      spellcheck="false"
      :value="value"
      :aria-describedby="warningId"
      data-testid="secret-reveal-value"
      @focus="selectAll"
    />
    <p class="fs-200 t-muted mt-2 mb-4" role="status" data-testid="secret-reveal-status">{{ status }}</p>
    <BasicCheckbox v-model="stored" data-testid="secret-reveal-stored">{{ $t("secret_reveal.stored") }}</BasicCheckbox>
  </BasicModal>
</template>

<script>
let nextId = 0;
</script>

<script setup>
// The shown-once secret (access plan 22): a token's raw value in a read-only monospace field with Copy
// (`navigator.clipboard`, else the text is selected for the user's own copy), the warning that it is never shown again,
// and Close only after "I have stored it" is ticked (until then Esc, the backdrop and the close button do nothing).
// The value lives only here. A page hands it over with `show(secret)` (a ref call, before it sets `open`): the value
// goes from the API response straight into this boot's state and never into the page's reactive data. The `secret`
// prop (the /ui cell's static fake) is copied into local state on open and `update:secret` hands the caller an empty
// string back at once; close and unmount clear it, and the field is empty before the dialog leaves. No store, no log,
// no URL.
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { t } from "@/i18n";
import BasicModal from "@/boots/BasicModal/index.vue";
import BasicCheckbox from "@/boots/BasicCheckbox/index.vue";

const props = defineProps({
  secret: { type: String, default: "" },
  title: { type: String, default: "" },
  open: { type: Boolean, default: false },
  // The catalogue's open state in the page flow (BasicModal `inline`).
  inline: { type: Boolean, default: false },
});
const emit = defineEmits(["update:open", "update:secret", "close"]);

nextId += 1;
const fieldId = `secret-reveal-${nextId}`;
const warningId = `secret-reveal-warning-${nextId}`;
const field = ref(null);
const value = ref("");
const visible = ref(false);
const stored = ref(false);
const status = ref("");

function clear() {
  value.value = "";
  stored.value = false;
  status.value = "";
}

// Closing empties the field first and hides the dialog a tick later: the leave transition never shows the value.
async function hideEmptied() {
  clear();
  await nextTick();
  if (!props.open) visible.value = false;
}

watch(
  () => [props.open, props.secret],
  ([open, secret]) => {
    if (!open) return hideEmptied();
    visible.value = true;
    if (!secret) return;
    value.value = secret;
    emit("update:secret", "");
  },
  { immediate: true }
);
onBeforeUnmount(clear);

// The non-reactive handoff: the caller opens the dialog right after.
function show(secret) {
  value.value = secret;
}
defineExpose({ show });

function selectAll() {
  field.value?.select();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(value.value);
    status.value = t("secret_reveal.copied");
  } catch {
    selectAll();
    status.value = t("secret_reveal.copy_manually");
  }
}

function close() {
  if (!stored.value) return;
  clear();
  emit("update:open", false);
  emit("close");
}

// Neither writes: a read-only page keeps both.
const actions = computed(() => [
  { key: "copy", role: "secondary", label: t("common.copy"), onClick: copy, mutates: false, testid: "secret-reveal-copy" },
  {
    key: "close",
    role: "primary",
    label: t("common.close"),
    onClick: close,
    disabled: !stored.value,
    mutates: false,
    testid: "secret-reveal-close",
  },
]);
</script>

<style lang="scss">
.secret-reveal__warning {
  color: var(--text-strong);
  background: var(--warning-subtle);
  border-radius: var(--radius-base);
  padding: var(--space-2) var(--space-4);
}

// A read-only field with the BasicInput look, in the mono font: the value is copied, never typed.
.secret-reveal__value {
  box-sizing: border-box;
  width: 100%;
  height: var(--elem-height);
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--fs-300);
  color: var(--text-body);
  background-color: var(--surface-sunken);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
}
</style>
