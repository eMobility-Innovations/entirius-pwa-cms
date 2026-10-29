<template>
  <div class="empty-state" :class="`empty-state--${size}`">
    <FontAwesomeIcon v-if="icon" :icon="ICONS[icon]" class="empty-state__icon" />
    <p v-if="title" class="empty-state__title">{{ title }}</p>
    <p v-if="message" class="empty-state__message">{{ message }}</p>
    <slot />
  </div>
</template>

<script setup>
// `icon` is a meaning of icons.js.
import { ICONS } from "@/boots/Icons/icons";

defineProps({
  title: {
    type: String,
    default: "",
  },
  message: {
    type: String,
    default: "",
  },
  icon: {
    type: String,
    default: "",
    validator: (value) => !value || Object.hasOwn(ICONS, value),
  },
  // "md": the full block of a list screen whose only content is the list; "sm": one line inside a detail screen.
  size: {
    type: String,
    default: "md",
    validator: (value) => ["sm", "md"].includes(value),
  },
})
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
  padding: var(--space-12);
  min-height: 14rem;
  text-align: center;
}

.empty-state--sm {
  flex-direction: row;
  gap: var(--space-2);
  padding: var(--space-4);
  min-height: 0;

  .empty-state__icon {
    font-size: var(--fs-400);
  }

  .empty-state__title {
    font-size: var(--fs-250);
    font-weight: 400;
    color: var(--text-muted);
  }
}

.empty-state__icon {
  font-size: var(--fs-700);
  color: var(--text-muted);
}

.empty-state__title {
  font-size: var(--fs-400);
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.empty-state__message {
  font-size: var(--fs-200);
  color: var(--text-muted);
  max-width: 30rem;
  margin: 0;
}
</style>
