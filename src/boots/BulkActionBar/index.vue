<template>
  <div
    v-if="!readonly"
    class="bulk-bar bg-accent-subtle flex ai-ct flex-wrap gap-4 rg-3"
  >
    <span class="bulk-bar__count fs-300 fw-600 t-accent">
      {{ count }} {{ $t(selectedLabelKey) }}
    </span>
    <div class="bulk-bar__actions">
      <template v-for="action in actions" :key="action.key">
        <BasicSelect
          v-if="action.options"
          :model-value="null"
          :options="action.options"
          :placeholder="$t(action.labelKey)"
          :aria-label="$t(action.labelKey)"
          class="bulk-bar__dropdown"
          @update:model-value="(val) => $emit('action', action.key, val)"
        />
        <BasicButton v-else :variant="action.variant ?? 'secondary'" @click="$emit('action', action.key)">
          {{ $t(action.labelKey) }}
        </BasicButton>
      </template>
    </div>
    <BasicButton class="bulk-bar__clear" variant="ghost" @click="$emit('clear')">
      {{ $t(clearLabelKey) }}
    </BasicButton>
  </div>
</template>

<script setup>
// actions = [{ key, labelKey, variant?, options? }]: `variant` is a BasicButton variant (default secondary); an action
// with `options` is an action picker (BasicSelect without a value of its own, `options` = [{ label, value }]). Not
// rendered on a read-only page (useReadonly, plan 19). The row wraps: the count, the actions and "Clear selection"
// stay reachable at any width (the count on one line, the clear action at the row's end).
import { useReadonly } from "@/composables/useReadonly";

const readonly = useReadonly();

defineProps({
  count: {
    type: Number,
    required: true,
  },
  selectedLabelKey: {
    type: String,
    default: "common.bulk.items_selected",
  },
  clearLabelKey: {
    type: String,
    default: "common.bulk.clear_selection",
  },
  actions: {
    type: Array,
    required: true,
    validator: (value) =>
      value.every((a) => typeof a === "object" && typeof a.key === "string" && typeof a.labelKey === "string"),
  },
});

defineEmits(["action", "clear"]);
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.bulk-bar {
  padding: var(--space-5) var(--space-10);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-4);

  @include max-tablet {
    padding: var(--space-4) var(--space-5);
  }
}
.bulk-bar__count {
  margin-right: var(--space-4);
  white-space: nowrap;
}
// The actions flow in the bar's own wrapping row, next to the count.
.bulk-bar__actions {
  display: contents;
}
.bulk-bar__clear {
  margin-left: auto;
}
.bulk-bar__dropdown {
  min-width: 180px;
}
</style>
