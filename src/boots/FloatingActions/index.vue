<template>
  <div class="floating-actions" ref="rootRef">
    <div v-if="!readonly" v-show="isOpen" class="floating-actions__menu" role="menu">
      <div
        v-for="(action, index) in actions"
        :key="index"
        class="floating-actions__item"
        :style="{ animationDelay: `${index * 50}ms` }"
      >
        <span class="floating-actions__label">{{ action.label }}</span>
        <button
          class="floating-actions__action"
          :class="[`floating-actions__action--${action.variant || 'primary'}`]"
          role="menuitem"
          tabindex="0"
          :aria-label="action.label"
          :disabled="action.disabled"
          @click="handleActionClick(action)"
          @keydown.enter="handleActionClick(action)"
        >
          <FontAwesomeIcon :icon="ICONS[action.icon]" />
        </button>
      </div>
    </div>

    <button
      v-if="backHandler"
      class="floating-actions__back"
      aria-label="Back"
      @click="backHandler"
    >
      <FontAwesomeIcon :icon="$icons.back" />
    </button>

    <div v-if="!readonly" class="floating-actions__row">
      <button
        v-if="pill"
        type="button"
        class="floating-actions__pill"
        :data-testid="pill.testid"
        :disabled="pill.disabled"
        @click="pill.handler"
      >
        <FontAwesomeIcon :icon="ICONS[pill.icon]" aria-hidden="true" />
        <span>{{ pill.label }}</span>
      </button>
      <button
        class="floating-actions__trigger"
        data-fid="fab"
        aria-label="Toggle menu"
        :aria-expanded="isOpen"
        aria-haspopup="menu"
        @click="handleToggle"
      >
        <FontAwesomeIcon
          :icon="$icons.add"
          class="floating-actions__trigger-icon"
          :class="{ 'floating-actions__trigger-icon--open': isOpen }"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { ICONS } from "@/boots/Icons/icons";
import { useReadonly } from "@/composables/useReadonly";

/**
 * @typedef {Object} FloatingAction
 * @property {string} icon - a meaning of icons.js (a raw FontAwesome name is never looked up)
 * @property {string} label - Tooltip text
 * @property {Function} handler - Click callback
 * @property {'primary'|'secondary'|'danger'} [variant='primary']
 * @property {boolean} [disabled]
 */

// `pill` = { icon, label, handler, testid?, disabled? }: an important action with a visible label next to the FAB
// (R7, Figma S6–S8 "Zarządzaj kolejnością"). `open` starts with the speed-dial open (catalogue state). A read-only
// page (useReadonly, plan 19) shows no FAB and no pill — every action of them creates or changes something; only the
// back button (navigation) stays.
const props = defineProps({
  actions: {
    type: Array,
    required: true,
  },
  backHandler: {
    type: Function,
    default: null,
  },
  pill: {
    type: Object,
    default: null,
  },
  open: {
    type: Boolean,
    default: false,
  },
});

const readonly = useReadonly();
const isOpen = ref(props.open);
const rootRef = ref(null);

function handleToggle() {
  isOpen.value = !isOpen.value;
}

function handleActionClick(action) {
  if (action.disabled) return;
  isOpen.value = false;
  action.handler();
}

function handleOutsideClick(event) {
  if (!rootRef.value?.contains(event.target)) {
    isOpen.value = false;
  }
}

function handleEscape(event) {
  if (event.key === "Escape" && isOpen.value) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
  document.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick);
  document.removeEventListener("keydown", handleEscape);
});
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// Figma S4/S9: 24 px from the corner beside the sidebar; 16 px from the edge and above the tab bar wherever the tab
// bar shows (up to 1023 px).
.floating-actions {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-3);
}

@include max-shell {
  .floating-actions {
    right: var(--space-4);
    bottom: calc(var(--bottom-bar-height) + var(--space-4));
  }
}

.floating-actions__back {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background-color: var(--surface-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-300);
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
}

.floating-actions__back:hover {
  background-color: var(--surface-raised);
  color: var(--text-body);
}

.floating-actions__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.floating-actions__pill {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background-color: var(--surface-base);
  color: var(--text-body);
  font-size: var(--fs-200);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.floating-actions__pill:hover:not([disabled]) {
  border-color: var(--border-strong);
}
.floating-actions__pill:focus-visible {
  border-color: var(--accent);
  outline: none;
}
.floating-actions__pill[disabled] {
  color: var(--text-muted);
  cursor: not-allowed;
}

.floating-actions__trigger {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  border: none;
  background-color: var(--accent-fill);
  color: var(--text-on-accent-fill);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-400);
  box-shadow: var(--shadow-md);
  transition: background-color 0.2s ease;
}

.floating-actions__trigger:hover {
  filter: brightness(1.1);
}

.floating-actions__trigger-icon {
  transition: transform 0.25s ease;
}

.floating-actions__trigger-icon--open {
  transform: rotate(45deg);
}

.floating-actions__menu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.floating-actions__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  animation: fab-fly-in 0.2s ease forwards;
  opacity: 0;
  transform: translateY(8px);
}

@keyframes fab-fly-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.floating-actions__label {
  background-color: var(--surface-inverse);
  color: var(--text-inverse);
  font-size: var(--fs-200);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  white-space: nowrap;
  pointer-events: none;
}

.floating-actions__action {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: none;
  color: var(--text-on-accent-fill);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-200);
  box-shadow: var(--shadow-arrow);
  transition: filter 0.2s ease;
  flex-shrink: 0;
}

.floating-actions__action:hover:not(:disabled) {
  filter: brightness(1.1);
}

.floating-actions__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.floating-actions__action--primary {
  background-color: var(--accent-fill);
}

.floating-actions__action--secondary {
  background-color: var(--surface-inverse);
  color: var(--text-inverse);
}

.floating-actions__action--danger {
  background-color: var(--negative-fill);
  color: var(--text-on-status-fill);
}
</style>
