<template>
  <button
    v-if="!hidden"
    :type="type"
    :disabled="isOff"
    :aria-busy="loading || undefined"
    class="button-basic pointer normal inline-flex jc-sb ai-ct gap-2"
    :class="[
      `button-basic--${size}`,
      `button-basic--${variant}`,
      { 'jc-ct button-basic--icon': isIconOnly(), 'button-basic--labelled': hasSlotLabel() },
    ]"
    :aria-label="label || undefined"
    :title="label || undefined"
    @click="onClick"
  >
    <span v-if="loading" class="inline-flex jc-ct ai-ct btn-icon" aria-hidden="true">
      <span class="button-basic__spinner"></span>
    </span>
    <span v-else-if="meaningIcon" class="inline-flex jc-ct ai-ct btn-icon" aria-hidden="true">
      <FontAwesomeIcon :icon="meaningIcon" />
    </span>
    <span class="btn-text" v-if="hasSlotLabel()"><slot /></span>
  </button>
</template>

<script>
// Sizes: md = --elem-height (inputs share it), sm = row actions, lg = 40 px at --radius-xl (the sign-in screens,
// AuthLayout). `variant` is the role: primary, secondary, ghost,
// danger (every delete/remove/reject), danger-solid (the destructive confirm in a dialog). The label is the default
// slot; `icon` is a meaning of icons.js, drawn before the label; `loading` swaps the icon for a spinner and disables.
// `mutates`: the button creates, changes or deletes something — a read-only page (useReadonly, plan 19) hides it.
import { ICONS } from "@/boots/Icons/icons";
import { useReadonly } from "@/composables/useReadonly";

const VARIANTS = ["primary", "secondary", "ghost", "danger", "danger-solid"];

export default {
  emits: ["click"],
  setup() {
    return { readonly: useReadonly() };
  },
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    variant: {
      type: String,
      default: "secondary",
      validator: (value) => VARIANTS.includes(value),
    },
    type: {
      type: String,
      default: "button",
    },
    icon: {
      type: String,
      default: null,
      validator: (value) => Object.hasOwn(ICONS, value),
    },
    size: {
      type: String,
      default: "md",
      validator: (value) => ["md", "sm", "lg"].includes(value),
    },
    label: {
      type: String,
      default: "",
    },
    // The click stops at the button by default; `:stop="false"` lets it reach a wrapper that acts on it
    // (SubscriberSetter opens its kit on the click of what it wraps).
    stop: {
      type: Boolean,
      default: true,
    },
    mutates: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    hidden() {
      return this.mutates && this.readonly;
    },
    isOff() {
      return this.disabled || this.loading;
    },
    meaningIcon() {
      return this.icon ? ICONS[this.icon] : undefined;
    },
  },
  methods: {
    // $slots is not reactive, so these are methods, not computeds.
    hasSlotLabel() {
      return Boolean(this.$slots.default);
    },
    isIconOnly() {
      return !this.hasSlotLabel();
    },
    onClick(event) {
      if (this.stop) event.stopPropagation();
      this.$emit("click", event);
    },
  },
  mounted() {
    if (process.env.NODE_ENV !== "production" && this.isIconOnly() && !this.label) {
      console.warn("BasicButton: an icon-only button needs `label`, its accessible name (docs/ui-rules.md C6).");
    }
  },
};
</script>
<style lang="scss">
@import "@/assets/scss/utils/media-query";

button.button-basic {
  --btn-height: var(--elem-height);
  --btn-icon-size: var(--fs-400);

  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  min-height: var(--btn-height);
  border: 1px solid transparent;
  border-radius: var(--radius-base);
  color: inherit;
  padding: 0 var(--space-4);
  background-color: transparent;
  font-size: var(--fs-200);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;

  &.button-basic--sm {
    --btn-height: var(--space-6);
    --btn-icon-size: var(--fs-300);

    padding: 0 var(--space-3);
  }

  &.button-basic--lg {
    --btn-height: var(--space-10);

    border-radius: var(--radius-xl);
    padding: 0 var(--space-5);
    font-size: var(--fs-300);
  }

  &.button-basic--labelled {
    gap: calc(var(--space-1) * 1.5);
  }

  &.button-basic--icon {
    width: var(--btn-height);
    padding: 0;
    font-size: var(--btn-icon-size);
  }

  &.reverse-order {
    .btn-icon {
      order: 2;
    }
    .btn-text {
      order: 1;
    }
  }

  &.lh-0 {
    line-height: 0;
  }
  &.lh-init {
    line-height: initial;
  }

  span {
    color: inherit;

    i {
      color: inherit;
    }
  }
  .btn-text {
    color: inherit;
  }

  .button-basic__spinner {
    width: 1em;
    height: 1em;
    border: 2px solid currentcolor;
    border-right-color: transparent;
    border-radius: var(--radius-full);
    animation: button-basic-spin 0.8s linear infinite;
  }
  // -------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------

  &.button-basic--primary {
    color: var(--text-on-accent-fill);
    background-color: var(--accent-fill);

    &:hover:not([disabled]) {
      background-color: var(--accent-fill-hover);
    }

    &[disabled] {
      background-color: var(--accent-fill-hover);
    }

    // The sign-in button: a soft light from the top edge on hover.
    &.button-basic--lg:hover:not([disabled]) {
      background-image: linear-gradient(color-mix(in srgb, var(--text-on-accent-fill) 16%, transparent), transparent 60%);
    }
  }

  &.button-basic--secondary {
    color: var(--text-body);
    border-color: var(--border-default);

    &:hover:not([disabled]) {
      border-color: var(--border-strong);
    }
    &[disabled] {
      color: var(--text-muted);
    }
    &.selected {
      border-bottom: 2px solid var(--border-strong);
    }
  }

  &.button-basic--ghost {
    color: var(--text-secondary);

    &:hover:not([disabled]) {
      color: var(--text-body);
      background-color: var(--surface-hover);
    }
    &[disabled] {
      color: var(--text-muted);
    }
  }

  &.button-basic--danger {
    color: var(--negative);

    &:hover:not([disabled]) {
      border-color: var(--negative);
    }
    &[disabled] {
      color: var(--text-muted);
    }
  }

  &.button-basic--danger-solid {
    color: var(--text-on-status-fill);
    background-color: var(--negative-fill);

    &:hover:not([disabled]) {
      filter: brightness(0.9);
    }
    &[disabled] {
      color: var(--text-muted);
      background-color: var(--negative-subtle);
    }
  }
}

@keyframes button-basic-spin {
  to {
    transform: rotate(360deg);
  }
}

// Toolbar icon-only actions get a thumb-sized box on mobile; everything else keeps its size.
@include max-tablet {
  [id$="-toolbar-left"],
  [id$="-toolbar-right"] {
    button.button-basic.button-basic--icon {
      --btn-height: var(--space-10);
    }
  }
}
</style>
