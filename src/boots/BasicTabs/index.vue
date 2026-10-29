<template>
  <div v-if="options.length" ref="listRef" class="basic-tabs" role="tablist" @keydown="onKeydown">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="tab"
      :id="`${prefix}-tab-${option.value}`"
      :aria-controls="`${prefix}-panel-${option.value}`"
      class="basic-tabs__tab"
      :class="{ 'basic-tabs__tab--active': modelValue === option.value }"
      :aria-selected="String(modelValue === option.value)"
      :data-testid="option.testid || null"
      :tabindex="isFocusTarget(option) ? 0 : -1"
      :disabled="option.disabled || undefined"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
      <CountBadge v-if="option.count != null" :count="option.count" />
    </button>
  </div>
</template>

<script setup>
// Tabs of one screen (docs/ui-components.md § P3 display): `options` [{ label, value, count?, testid?, disabled? }], a `tablist` with one Tab stop (the active tab); arrow
// keys, Home and End move to a tab and select it, skipping disabled ones. Counts are CountBadges. Tab ids are `<idPrefix>-tab-<value>`; each
// tab controls `<idPrefix>-panel-<value>`, the call site's `role="tabpanel"` element. No options, no tablist.
import { computed, ref, useId } from "vue";
import CountBadge from "@/boots/CountBadge/index.vue";

const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: [String, Number], default: null },
  idPrefix: { type: String, default: null },
});
const autoId = useId();
const prefix = computed(() => props.idPrefix ?? autoId);
const emit = defineEmits(["update:modelValue"]);
const listRef = ref(null);

const STEP = { ArrowRight: 1, ArrowLeft: -1 };

// The one Tab stop: the selected tab, else (none selected, or the selected one disabled) the first enabled one.
const focusTarget = computed(() => {
  const enabled = props.options.filter((o) => !o.disabled);
  return enabled.find((o) => o.value === props.modelValue) ?? enabled[0];
});
const isFocusTarget = (option) => option === focusTarget.value;

function targetIndex(key, current, last) {
  if (key === "Home") return 0;
  if (key === "End") return last;
  if (!STEP[key]) return null;
  return (current + STEP[key] + last + 1) % (last + 1);
}

function onKeydown(event) {
  const enabled = props.options.flatMap((o, index) => (o.disabled ? [] : [index]));
  const current = enabled.indexOf(props.options.findIndex((o) => o.value === props.modelValue));
  const step = targetIndex(event.key, Math.max(current, 0), enabled.length - 1);
  const next = step === null ? undefined : enabled[step];
  if (next === undefined) return;
  event.preventDefault();
  emit("update:modelValue", props.options[next].value);
  listRef.value?.querySelectorAll('[role="tab"]')[next]?.focus();
}
</script>

<style lang="scss">
// Wider than its box (a phone), the tab row scrolls inside itself instead of pushing the page sideways.
.basic-tabs {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
  border-bottom: 1px solid var(--border-subtle);

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
    white-space: nowrap;
    padding: var(--space-2) var(--space-4);
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--fs-300);
    font-weight: 500;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;

    &:hover:not(&--active):not(:disabled) {
      color: var(--text-body);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &--active {
      color: var(--text-accent);
      border-bottom-color: var(--accent);
    }

    // The row scrolls, so it clips an outside ring: the focus ring sits inside the tab.
    &:focus-visible {
      outline-offset: -2px;
    }
  }
}
</style>
