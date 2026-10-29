<template>
  <span class="count-badge type-count">{{ shown }}</span>
</template>

<script setup>
// A number in a pill (Figma S4 group count, KD03): tab, filter chip and filter-trigger counts. Above 999 it reads
// "999+"; the exact number is the caller's to show elsewhere.
import { computed } from "vue";

const MAX = 999;
const props = defineProps({
  count: { type: Number, required: true },
});

const shown = computed(() => (props.count > MAX ? `${MAX}+` : String(props.count)));
</script>

<style lang="scss">
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--surface-hover);
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
