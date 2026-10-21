<template>
  <BasicTooltip v-if="!(mutates && readonly)" :text="label" class="icon-button__tip">
    <button
      v-bind="$attrs"
      :type="type"
      class="icon-button inline-flex jc-ct ai-ct pointer"
      :class="[`icon-button--${variant}`, `icon-button--${size}`]"
      :disabled="disabled"
      :aria-label="label"
      :aria-pressed="pressed === undefined ? undefined : String(pressed)"
      @click="onClick"
    >
      <FontAwesomeIcon :icon="ICONS[icon]" aria-hidden="true" />
    </button>
  </BasicTooltip>
</template>

<script setup>
// Every icon-only action (docs/ui-rules.md C5, R7): `icon` is a meaning of icons.js, `label` its accessible name
// (aria-label) and its BasicTooltip; attributes (class, test id) land on the button, not on the tooltip wrapper.
// Sizes: sm 24, md --elem-height (lines up with a text button in an ActionBar), lg 40 (header, mobile menu).
// `danger` is every icon-only delete/remove (C6). `pressed` makes it a toggle (aria-pressed). The click stops at the
// button, as BasicButton's does (rows and cards may act on a click). `mutates`: the action creates, changes or deletes
// something (a DataTable row's delete) — a read-only page (useReadonly, plan 19) hides it; view/open actions stay.
import { ICONS } from "@/boots/Icons/icons";
import BasicTooltip from "@/boots/BasicTooltip/index.vue";
import { useReadonly } from "@/composables/useReadonly";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  icon: { type: String, required: true, validator: (value) => Object.hasOwn(ICONS, value) },
  label: { type: String, required: true },
  variant: {
    type: String,
    default: "ghost",
    validator: (value) => ["ghost", "outline", "primary", "danger"].includes(value),
  },
  size: { type: String, default: "md", validator: (value) => ["sm", "md", "lg"].includes(value) },
  pressed: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: "button" },
  stop: { type: Boolean, default: true },
  mutates: { type: Boolean, default: false },
});
const readonly = useReadonly();
const emit = defineEmits(["click"]);

function onClick(event) {
  if (props.stop) event.stopPropagation();
  emit("click", event);
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";
@import "@/assets/scss/utils/touch-target";

// The tooltip wrapper takes no box: the button lays out as if it were the component's root.
.icon-button__tip {
  display: contents;
}

.icon-button {
  --icon-button-size: var(--elem-height);

  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  width: var(--icon-button-size);
  height: var(--icon-button-size);
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-base);
  color: var(--text-secondary);
  background-color: transparent;
  font-size: var(--fs-400);

  // One disabled glyph for every variant but primary: the disabled text role, clearly weaker than the enabled one.
  &[disabled] {
    color: var(--text-disabled);
    cursor: not-allowed;
  }
}

.icon-button--sm {
  --icon-button-size: var(--space-6);

  font-size: var(--fs-300);
}

.icon-button--lg {
  --icon-button-size: var(--space-10);

  border-radius: var(--radius-xl);
  font-size: var(--fs-500);
}

.icon-button--ghost:hover:not([disabled]),
.icon-button[aria-pressed="true"] {
  color: var(--text-body);
  background-color: var(--surface-hover);
}

.icon-button--outline {
  border-color: var(--border-default);

  &:hover:not([disabled]) {
    color: var(--text-body);
    border-color: var(--border-strong);
  }
}

.icon-button--danger {
  color: var(--negative);

  &:hover:not([disabled]) {
    border-color: var(--negative);
  }
}

.icon-button--primary {
  color: var(--text-on-accent-fill);
  background-color: var(--accent-fill);

  &:hover:not([disabled]) {
    background-color: var(--accent-fill-hover);
  }

  // Its own disabled look: the on-fill glyph stays, the whole button fades (a text-disabled glyph would vanish on
  // the fill).
  &[disabled] {
    color: var(--text-on-accent-fill);
    opacity: 0.5;
  }
}

// A thumb-sized hit area on touch screens without a bigger box (touch-target). `sm` buttons sit in rows 8 px apart:
// their area is the box plus that gap, so two neighbours' areas meet but never overlap.
.icon-button {
  --icon-button-hit: var(--space-10);

  @include touch-target(var(--icon-button-hit));
}

.icon-button--sm {
  --icon-button-hit: calc(var(--space-6) + var(--space-2));
}
</style>
