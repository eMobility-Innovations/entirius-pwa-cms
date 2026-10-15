<template>
  <Teleport to="body" :disabled="inline">
    <Transition name="basic-modal">
      <div
        v-if="open"
        ref="root"
        class="basic-modal"
        :class="{ 'basic-modal--inline': inline }"
        @mousedown.self="pressedOnBackdrop = true"
        @click.self="onBackdrop"
      >
        <div
          class="basic-modal__panel flex-column"
          :class="`basic-modal__panel--${size}`"
          v-bind="$attrs"
          role="dialog"
          :aria-modal="inline ? undefined : 'true'"
          :aria-labelledby="title || $slots.title ? titleId : undefined"
          :aria-label="title || $slots.title ? undefined : ariaLabel || undefined"
          tabindex="-1"
        >
          <header class="basic-modal__header flex ai-ct jc-sb gap-3">
            <div :id="titleId" class="basic-modal__title">
              <slot name="title">
                <h2 class="fs-400 fw-600 t-body">{{ title }}</h2>
              </slot>
            </div>
            <IconButton
              icon="close"
              :label="$t('common.close')"
              :disabled="persistent"
              data-testid="basic-modal-close"
              @click="close"
            />
          </header>
          <div class="basic-modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer || actions.length" class="basic-modal__footer">
            <slot name="footer">
              <ActionBar :actions="actions" :labelled="false" />
            </slot>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
let nextId = 0;
</script>

<script setup>
// The one centred dialog (docs/ui-rules.md § Dialogs): `v-model:open`, `title` (the dialog's <h2> and its name; the
// `title` slot takes richer markup), `ariaLabel` (the name of a dialog without a title: the root is a Teleport, so a
// fallthrough `aria-label` never reaches the dialog),
// `size` sm · md · lg, `persistent` (busy: Esc and the backdrop do not close it, the close button is disabled),
// default slot = body, `footer` slot or `actions` (→ ActionBar, R5). Focus is trapped while open and goes back to the
// opener on close. Below the tablet breakpoint it is a full-width sheet at the bottom. `inline` renders the open state in the
// page flow (catalogue): no Teleport, no backdrop, no trap. Other attributes (`data-testid`, `class`, listeners) land on
// the dialog element; `role`, `aria-*` and `tabindex` are bound after `$attrs`, so the dialog's own values always win.
import { computed, ref } from "vue";
import IconButton from "@/boots/IconButton/index.vue";
import ActionBar from "@/boots/ActionBar/index.vue";
import { useFocusTrap } from "@/composables/useFocusTrap";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  ariaLabel: { type: String, default: "" },
  size: { type: String, default: "md", validator: (value) => ["sm", "md", "lg"].includes(value) },
  persistent: { type: Boolean, default: false },
  actions: { type: Array, default: () => [] },
  inline: { type: Boolean, default: false },
});
const emit = defineEmits(["update:open", "close"]);

nextId += 1;
const titleId = `basic-modal-title-${nextId}`;
const root = ref(null);

function close() {
  emit("update:open", false);
  emit("close");
}

function dismiss() {
  if (!props.persistent) close();
}

// Only a click that also started on the backdrop closes: a text selection dragged out of a field does not.
const pressedOnBackdrop = ref(false);

function onBackdrop() {
  const pressed = pressedOnBackdrop.value;
  pressedOnBackdrop.value = false;
  if (pressed && !props.inline) dismiss();
}

useFocusTrap(root, { active: computed(() => props.open && !props.inline), onEscape: dismiss });

defineExpose({ close });
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.basic-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--overlay-backdrop);
}

.basic-modal--inline {
  position: static;
  z-index: auto;
  display: block;
  padding: 0;
  background: none;
}

.basic-modal__panel {
  width: 100%;
  max-height: calc(100vh - var(--space-8));
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  color: var(--text-body);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.basic-modal__panel--sm {
  max-width: 25rem;
}

.basic-modal__panel--md {
  max-width: 35rem;
}

.basic-modal__panel--lg {
  max-width: 50rem;
}

.basic-modal__title {
  min-width: 0;

  :slotted(h2),
  :slotted(h3) {
    margin: 0;
    color: var(--text-body);
    font-size: var(--fs-400);
    font-weight: 600;
  }

  h2 {
    margin: 0;
  }
}

.basic-modal__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: var(--fs-300);
}

// A footer of the slot's own controls (legacy call sites) lines up as an ActionBar does: right-aligned, wrapping.
.basic-modal__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.basic-modal-enter-active,
.basic-modal-leave-active {
  transition: opacity 0.15s ease;
}

.basic-modal-enter-from,
.basic-modal-leave-to {
  opacity: 0;
}

@include max-tablet {
  .basic-modal:not(.basic-modal--inline) {
    align-items: flex-end;
    padding: 0;

    .basic-modal__panel {
      max-width: none;
      max-height: 90vh;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
    }
  }
}
</style>
