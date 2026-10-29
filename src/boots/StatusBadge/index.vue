<template>
  <span
    class="status-badge type-badge"
    :class="[`status-badge--${resolvedTone}`, `status-badge--${size}`, { 'status-badge--dot': dot }]"
    :title="label"
  >
    <span class="status-badge__label">{{ label }}</span>
  </span>
</template>

<script>
// One state pill (docs/ui-components.md § P3 display): hollow, a tone-coloured border and text, a leading dot.
const TONES = ["positive", "negative", "warning", "info", "neutral", "accent"];
</script>

<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: [String, Number], required: true },
  tone: { type: String, default: "neutral", validator: (value) => TONES.includes(value) },
  dot: { type: Boolean, default: true },
  size: { type: String, default: "md", validator: (value) => ["sm", "md"].includes(value) },
});

const resolvedTone = computed(() => props.tone ?? "neutral");
</script>

<style lang="scss">
.status-badge {
  --status-badge-tone: var(--text-secondary);
  --status-badge-border: var(--border-subtle);

  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  white-space: nowrap;
  // Never wider than its cell: a label that does not fit ends in an ellipsis (full label in `title`).
  max-width: 100%;
  min-width: 0;
  background: transparent;
  border: 1px solid var(--status-badge-border);
  color: var(--status-badge-tone);

  &__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.status-badge--dot::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  background: var(--status-badge-tone);
}

.status-badge--sm {
  padding: 0 var(--space-1);
}

.status-badge--positive {
  --status-badge-tone: var(--positive);
  --status-badge-border: color-mix(in srgb, var(--positive) 32%, transparent);
}

.status-badge--negative {
  --status-badge-tone: var(--negative);
  --status-badge-border: color-mix(in srgb, var(--negative) 32%, transparent);
}

.status-badge--warning {
  --status-badge-tone: var(--warning);
  --status-badge-border: color-mix(in srgb, var(--warning) 38%, transparent);
}

.status-badge--info {
  --status-badge-tone: var(--info);
  --status-badge-border: color-mix(in srgb, var(--info) 32%, transparent);
}

.status-badge--accent {
  --status-badge-tone: var(--text-accent);
  --status-badge-border: color-mix(in srgb, var(--accent) 32%, transparent);
}

// Neutral keeps its grey dot: the text colour would read as a live state.
.status-badge--neutral.status-badge--dot::before {
  background: var(--surface-disabled);
}
</style>
