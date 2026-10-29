<template>
  <!-- Focused: teleported overlay + sliding panel, focus trapped -->
  <Teleport v-if="mode === 'focused'" to="body" :disabled="inline">
    <Transition name="side-drawer-focused">
      <div
        v-if="visible"
        ref="overlay"
        class="side-drawer-overlay"
        :class="{ 'side-drawer-overlay--inline': inline }"
        @mousedown.self="pressedOnBackdrop = true"
        @click.self="onBackdrop"
      >
        <div
          class="side-drawer-panel"
          :style="{ width: effectiveWidth }"
          role="dialog"
          :aria-modal="inline ? undefined : 'true'"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
        >
          <header class="side-drawer__header flex ai-ct jc-sb gap-3">
            <h2 :id="titleId" class="side-drawer__title fs-300 fw-600 t-body">{{ title }}</h2>
            <IconButton icon="close" :label="$t('common.close')" data-testid="side-drawer-close" @click="close" />
          </header>
          <div class="side-drawer__body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Sticky: position-sticky sidebar pinned in scroll container -->
  <Transition v-else name="side-drawer-sticky">
    <div
      v-if="visible"
      class="side-drawer-sticky"
      :style="{ width: effectiveWidth, minWidth: effectiveWidth }"
      role="complementary"
      :aria-labelledby="title ? titleId : undefined"
      @keydown.esc="closable && close()"
    >
      <header v-if="title || closable" class="side-drawer__header flex ai-ct jc-sb gap-3">
        <h2 v-if="title" :id="titleId" class="side-drawer__title fs-300 fw-600 t-body">{{ title }}</h2>
        <IconButton
          v-if="closable"
          icon="close"
          :label="$t('common.close')"
          data-testid="side-drawer-close"
          @click="close"
        />
      </header>
      <div class="side-drawer__body">
        <slot />
      </div>
    </div>
  </Transition>
</template>

<script>
let nextId = 0;
</script>

<script setup>
// Side panel (docs/ui-rules.md C4). `focused`: a modal panel from the right over a backdrop, focus trapped while
// visible, Esc and the backdrop close it. `sticky`: a sidebar in the page flow; Esc inside it closes it when
// `closable`. Both emit `close`, the caller hides it. The header (title, close) sticks to the top of the scrolling panel. `inline` renders the focused panel in the page flow (catalogue):
// no Teleport, no backdrop, no trap.
import { computed, ref } from "vue";
import IconButton from "@/boots/IconButton/index.vue";
import { useFocusTrap } from "@/composables/useFocusTrap";

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  mode: {
    type: String,
    default: "focused",
    validator: (v) => ["focused", "sticky"].includes(v),
  },
  title: {
    type: String,
    default: "",
  },
  width: {
    type: String,
    default: "",
  },
  closable: {
    type: Boolean,
    default: true,
  },
  inline: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close"]);

nextId += 1;
const titleId = `side-drawer-title-${nextId}`;
const overlay = ref(null);

const effectiveWidth = computed(() => {
  if (props.width) return props.width;
  return props.mode === "focused" ? "50rem" : "340px";
});

function close() {
  emit("close");
}

// Only a click that also started on the backdrop closes: a text selection dragged out of a field does not.
const pressedOnBackdrop = ref(false);

function onBackdrop() {
  const pressed = pressedOnBackdrop.value;
  pressedOnBackdrop.value = false;
  if (pressed && !props.inline) close();
}

useFocusTrap(overlay, {
  active: computed(() => props.visible && props.mode === "focused" && !props.inline),
  onEscape: close,
});
</script>

<style lang="scss">
/* Focused mode: full-screen overlay */
.side-drawer-overlay {
  position: fixed;
  inset: 0;
  background-color: var(--overlay-handy);
  z-index: 100;
  cursor: pointer;
}

.side-drawer-overlay--inline {
  position: static;
  z-index: auto;
  background: none;
  cursor: auto;

  .side-drawer-panel {
    position: static;
    height: auto;
    max-width: 100%;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
  }
}

.side-drawer-panel {
  height: 100vh;
  position: absolute;
  right: 0;
  top: 0;
  cursor: default;
  background: var(--surface-base);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--space-8);
  @media only screen and (max-width: 768px) {
    width: 100% !important;
  }
}

/* Sticky mode: full-height sidebar */
.side-drawer-sticky {
  padding: var(--space-8);
  border-left: 1px solid var(--border-subtle);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Shared header: it stays on top while the body scrolls (title and close in reach on a full-screen phone drawer),
   bleeding over the panel's padding so the scrolled content passes under it. A sticky box sticks inside the
   panel's padding, so its offset is minus that padding: the header meets the panel's top edge, nothing shows above. */
.side-drawer__header {
  position: sticky;
  top: calc(-1 * var(--space-8));
  z-index: 2;
  flex-shrink: 0;
  margin: calc(-1 * var(--space-8)) calc(-1 * var(--space-8)) var(--space-8);
  padding: var(--space-5) var(--space-8);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-base);
}

.side-drawer__title {
  margin: 0;
  min-width: 0;
}

.side-drawer__body {
  flex: 1;
  min-height: 0;
}

/* Focused transitions */
.side-drawer-focused-enter-active,
.side-drawer-focused-leave-active {
  transition: opacity 0.25s ease;
  .side-drawer-panel {
    transition: transform 0.25s ease;
  }
}
.side-drawer-focused-enter-from,
.side-drawer-focused-leave-to {
  opacity: 0;
  .side-drawer-panel {
    transform: translateX(100%);
  }
}

/* Sticky transitions */
.side-drawer-sticky-enter-active,
.side-drawer-sticky-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.side-drawer-sticky-enter-from,
.side-drawer-sticky-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
