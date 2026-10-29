<template>
  <nav v-if="shown" class="bottom-tab-bar flex" :aria-label="navLabel" data-fid="tab-bar">
    <router-link
      v-for="item in items"
      :key="item.route"
      :to="{ path: item.route, query: item.query }"
      class="bottom-tab-bar__item flex-column ai-ct jc-ct gap-1"
      :aria-current="item.route === currentRoute ? 'page' : undefined"
    >
      <span class="bottom-tab-bar__glyph">
        <FontAwesomeIcon :icon="item.icon" class="bottom-tab-bar__icon" aria-hidden="true" />
        <CountBadge v-if="item.count" :count="item.count" class="bottom-tab-bar__badge" />
      </span>
      <span class="bottom-tab-bar__label">{{ $t(item.labelKey) }}</span>
    </router-link>
  </nav>
</template>

<script setup>
// The phone sub-navigation (r05 §6, Figma S5): the current panel's entries (icon + 12 px label, an entry's count as a
// badge on its icon), the lit one
// `aria-current="page"` by the nav resolver. Hidden with one entry or none and on `meta.noBottomBar` (Leads Review
// keeps its sticky actions). 72 px high: `--bottom-bar-height` on `:root` (`utils/_mobile.scss`) names that height, so
// FloatingActions and fixed bottom bars sit above it.
// `entries`, `label` and `current` replace the route's panel with fixed data (catalogue).
import { computed } from "vue";
import CountBadge from "@/boots/CountBadge/index.vue";
import { useRoute } from "vue-router";
import { t } from "@/i18n";
import { panels } from "@/configs/access";
import { tabBarShown, useActiveNav } from "@/composables/useNav";

const props = defineProps({
  entries: { type: Array, default: null },
  label: { type: String, default: "" },
  current: { type: String, default: "" },
});

const route = useRoute();
const { panelIdx, entry, tree } = useActiveNav();

const items = computed(() => props.entries ?? tree.value[panelIdx.value] ?? []);
const currentRoute = computed(() => (props.entries ? props.current : entry.value?.route));
const shown = computed(() => tabBarShown(items.value, route));
const navLabel = computed(() => {
  if (props.label) return props.label;
  const panel = panels.find((p) => p.idx === panelIdx.value);
  return panel ? t(panel.labelKey) : "";
});
</script>

<style lang="scss" scoped>
.bottom-tab-bar {
  box-sizing: border-box;
  width: 100%;
  height: calc(var(--space-16) + var(--space-2));
  padding: var(--space-2);
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-page);
}

.bottom-tab-bar__item {
  flex: 1 1 0;
  min-width: 0;
  min-height: calc(var(--space-10) + var(--space-1));
  border-radius: var(--radius-base);
  color: var(--text-secondary);
  text-decoration: none;

  &:hover {
    color: var(--text-strong);
  }

  &[aria-current="page"] {
    color: var(--text-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }
}

.bottom-tab-bar__glyph {
  position: relative;
  display: inline-flex;
}

.bottom-tab-bar__badge {
  position: absolute;
  top: calc(-1 * var(--space-2));
  left: 60%;
}

.bottom-tab-bar__icon {
  font-size: var(--fs-500);
}

.bottom-tab-bar__label {
  overflow: hidden;
  width: 100%;
  font-size: var(--fs-200);
  line-height: 1.3;
  white-space: nowrap;
  text-align: center;
  text-overflow: ellipsis;
}
</style>
