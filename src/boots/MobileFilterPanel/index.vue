<template>
  <div class="mobile-filter-panel" ref="rootRef">
    <span class="mobile-filter-panel__trigger">
      <IconButton
        icon="filter"
        variant="outline"
        :label="triggerLabel"
        :aria-expanded="String(isOpen)"
        :stop="false"
        @click="isOpen = !isOpen"
      />
      <CountBadge v-if="activeCount > 0" :count="activeCount" class="mobile-filter-panel__badge" />
    </span>
    <div class="mobile-filter-panel__desktop">
      <slot />
    </div>
    <Transition name="mfp-slide">
      <div v-if="isOpen" class="mobile-filter-panel__dropdown">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import IconButton from "@/boots/IconButton/index.vue";
import CountBadge from "@/boots/CountBadge/index.vue";

defineProps({
  activeCount: {
    type: Number,
    default: 0,
  },
  triggerLabel: {
    type: String,
    default: "Filters",
  },
});

const isOpen = ref(false);
const rootRef = ref(null);

function handleOutsideClick(event) {
  if (rootRef.value && !rootRef.value.contains(event.target)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick);
});
</script>

<style lang="scss" scoped>
.mobile-filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
}

.mobile-filter-panel__trigger {
  display: none;
  position: relative;
  flex-shrink: 0;
}

// The count sits on the trigger's top-right corner.
.mobile-filter-panel__badge {
  position: absolute;
  top: calc(-1 * var(--space-2));
  right: calc(-1 * var(--space-2));
  pointer-events: none;
}

.mobile-filter-panel__desktop {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.mobile-filter-panel__dropdown {
  display: none;
}

@media only screen and (max-width: 768px) {
  .mobile-filter-panel {
    gap: var(--space-2);
  }

  .mobile-filter-panel__trigger {
    display: flex;
  }

  .mobile-filter-panel__desktop {
    display: none;
  }

  .mobile-filter-panel__dropdown {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    max-height: 40vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: var(--space-2);
    background-color: var(--surface-raised);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-base);
  }
}

.mfp-slide-enter-active,
.mfp-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.mfp-slide-enter-from,
.mfp-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
