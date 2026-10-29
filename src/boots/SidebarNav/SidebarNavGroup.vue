<template>
  <div class="sidebar-nav-group" :class="{ 'sidebar-nav-group--open': isGroup && expanded }">
    <SidebarNavItem
      v-if="!isGroup"
      :label="label"
      :icon="panel.icon"
      :to="leafTarget"
      :active="active"
      :locked="!panel.isEnabled"
      :collapsed="collapsed"
    />
    <template v-else>
      <SidebarNavItem
        :label="label"
        :icon="panel.icon"
        :active="active"
        :expanded="expanded"
        :controls="listId"
        @toggle="$emit('toggle')"
      />
      <ul v-if="expanded" :id="listId" class="sidebar-nav-group__list flex-column gap-1">
        <li v-for="entry in entries" :key="entry.route">
          <SidebarNavItem
            :level="2"
            :label="$t(entry.labelKey)"
            :icon="entry.icon"
            :to="{ path: entry.route, query: entry.query }"
            :active="entry.route === activeEntry"
            :count="entry.count || 0"
          />
        </li>
      </ul>
    </template>
  </div>
</template>

<script>
let nextId = 0;
</script>

<script setup>
// One panel of the sidebar (decision 2): more than one entry = a disclosure group with its sub-pages below while
// `expanded`; one entry = a leaf link to it, no chevron; a locked panel = a locked row. `flat` (MobileMenu) and
// `collapsed` (the rail) render every panel as one link to its root. `activeEntry` is the route of the lit entry.
import { computed } from "vue";
import { t } from "@/i18n";
import SidebarNavItem from "./SidebarNavItem.vue";

const props = defineProps({
  panel: { type: Object, required: true },
  entries: { type: Array, default: () => [] },
  expanded: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  activeEntry: { type: String, default: "" },
  flat: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
});
defineEmits(["toggle"]);

nextId += 1;
const listId = `sidebar-nav-group-${nextId}`;
const label = computed(() => t(props.panel.labelKey));
const isGroup = computed(() => props.panel.isEnabled && !props.flat && !props.collapsed && props.entries.length > 1);
const leafTarget = computed(() => {
  const [only] = props.entries;
  if (props.entries.length === 1 && !props.flat && !props.collapsed) return { path: only.route, query: only.query };
  return props.panel.root;
});
</script>

<style lang="scss" scoped>
.sidebar-nav-group--open {
  padding-bottom: var(--space-8);
  border-bottom: 1px solid var(--border-hairline);
}

.sidebar-nav-group__list {
  margin-top: var(--space-1);
  list-style: none;
}
</style>
