<template>
  <component :is="collapsed && !locked ? BasicTooltip : Plain" :text="label" placement="right">
    <span
      v-if="locked"
      class="sidebar-nav-item flex ai-ct gap-2"
      :class="classes"
      aria-disabled="true"
      :title="collapsed ? label : undefined"
    >
      <FontAwesomeIcon :icon="icon" class="sidebar-nav-item__icon" aria-hidden="true" />
      <span class="sidebar-nav-item__label" :class="{ 'visually-hidden': collapsed }">{{ label }}</span>
      <span class="visually-hidden">{{ $t("shell.locked") }}</span>
      <FontAwesomeIcon v-if="!collapsed" :icon="ICONS.lock" class="sidebar-nav-item__end" aria-hidden="true" />
    </span>
    <button
      v-else-if="isDisclosure"
      type="button"
      class="sidebar-nav-item flex ai-ct gap-2 pointer"
      :class="classes"
      :aria-expanded="String(expanded)"
      :aria-controls="controls"
      @click="$emit('toggle')"
    >
      <FontAwesomeIcon :icon="icon" class="sidebar-nav-item__icon" aria-hidden="true" />
      <span class="sidebar-nav-item__label">{{ label }}</span>
      <FontAwesomeIcon :icon="expanded ? ICONS.collapse : ICONS.expand" class="sidebar-nav-item__end" aria-hidden="true" />
    </button>
    <router-link
      v-else
      :to="to"
      class="sidebar-nav-item flex ai-ct gap-2"
      :class="classes"
      :aria-current="current"
      :aria-label="collapsed ? label : undefined"
    >
      <FontAwesomeIcon :icon="icon" class="sidebar-nav-item__icon" aria-hidden="true" />
      <span v-if="!collapsed" class="sidebar-nav-item__label">{{ label }}</span>
      <CountBadge v-if="count && !collapsed" :count="count" class="sidebar-nav-item__end" data-testid="sidebar-nav-count" />
    </router-link>
  </component>
</template>

<script setup>
// One row of the sidebar (r05 §4, decision 4). Level 1 = Home or a panel (40 px, Lexend 16/400): a link, or with
// `expanded` set a disclosure button (`aria-expanded`, `aria-controls`, chevron down closed / up open) that emits
// `toggle`. Level 2 = a sub-page (32 px, 14/400, 1 px rail that turns accent when active). `active` lights the row
// and marks a link `aria-current`: "page" on the page it links to, "true" below it. `locked` = a panel Munin keeps
// off: dimmed, a lock, not focusable, a visually hidden "(niedostępny)". `collapsed` = the 64 px rail: the icon
// alone, named by `aria-label`, the label as a BasicTooltip (a locked row keeps its text for screen readers and takes
// no tooltip: it must stay out of the tab order). `icon` is a FontAwesome glyph name (the panel and entry glyphs of
// the nav model, not meanings).
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ICONS } from "@/boots/Icons/icons";
import BasicTooltip from "@/boots/BasicTooltip/index.vue";
import CountBadge from "@/boots/CountBadge/index.vue";

const props = defineProps({
  label: { type: String, required: true },
  icon: { type: String, required: true },
  to: { type: [String, Object], default: null },
  level: { type: Number, default: 1, validator: (value) => [1, 2].includes(value) },
  active: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  // Set (true / false) only on a disclosure row; undefined = a link.
  expanded: { type: Boolean, default: undefined },
  controls: { type: String, default: undefined },
  collapsed: { type: Boolean, default: false },
  // A number waiting on the page (a link only): a CountBadge after the label, nothing at 0 or in the rail.
  count: { type: Number, default: 0 },
});
defineEmits(["toggle"]);

// The expanded row renders bare: no tooltip wrapper, no stray attributes.
const Plain = (_, { slots }) => slots.default();
Plain.inheritAttrs = false;

const route = useRoute();
// The lit link is the page itself ("page") or marks the section the open page belongs to ("true"): a panel row in the
// rail or the mobile menu on another sub-page, an entry on its detail pages.
const current = computed(() => {
  if (!props.active) return undefined;
  const path = typeof props.to === "string" ? props.to : props.to?.path;
  return path === route.path ? "page" : "true";
});

const isDisclosure = computed(() => props.expanded !== undefined && !props.collapsed);
const classes = computed(() => ({
  [`sidebar-nav-item--l${props.level}`]: true,
  "sidebar-nav-item--active": props.active,
  "sidebar-nav-item--locked": props.locked,
  "sidebar-nav-item--collapsed": props.collapsed,
}));
</script>

<style lang="scss" scoped>
.sidebar-nav-item {
  // The containing block of its `.visually-hidden` texts (a locked row's "(niedostępny)", a collapsed label): without
  // it they hang off a far ancestor and stretch the page's scroll height.
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--space-10);
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-base);
  color: var(--text-strong);
  background: none;
  font-family: var(--font-brand);
  font-size: var(--fs-400);
  font-weight: 400;
  letter-spacing: var(--brand-font-tracking-brand);
  line-height: 1.5;
  text-align: left;
  text-decoration: none;
  transition: color 0.15s ease, background-color 0.15s ease;

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }
}

// Group rows get the hover pill; links (Home, a leaf panel, a sub-page) change colour only.
button.sidebar-nav-item:hover {
  background-color: var(--surface-hover);
}

a.sidebar-nav-item:hover {
  color: var(--accent-hover);
}

.sidebar-nav-item--active,
.sidebar-nav-item--active:hover {
  color: var(--text-accent);
}

.sidebar-nav-item--l2 {
  min-height: var(--space-8);
  padding: var(--space-1) var(--space-3);
  border-left: 1px solid var(--border-hairline);
  border-radius: 0;
  color: var(--text-secondary);
  font-size: var(--fs-300);

  &.sidebar-nav-item--active {
    border-left-color: var(--accent);
    color: var(--text-accent);
  }
}

.sidebar-nav-item--locked {
  color: var(--text-disabled);
  cursor: default;
}

.sidebar-nav-item--collapsed {
  justify-content: center;
  width: var(--space-10);
  padding: 0;
}

.sidebar-nav-item__icon {
  flex-shrink: 0;
  width: var(--space-5);
  font-size: var(--fs-400);
  text-align: center;
}

.sidebar-nav-item__label {
  overflow: hidden;
  min-width: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sidebar-nav-item__end {
  flex-shrink: 0;
  margin-left: auto;
  font-size: var(--fs-300);
}

.sidebar-nav-item--locked .sidebar-nav-item__end {
  font-size: var(--fs-200);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-nav-item {
    transition: none;
  }
}
</style>
