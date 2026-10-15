<template>
  <nav
    :id="navId"
    class="sidebar-nav flex-column"
    :class="{ 'sidebar-nav--collapsed': isCollapsed && !flat, 'sidebar-nav--flat': flat }"
    :aria-label="$t('shell.panels')"
    v-bind="flat ? {} : { 'data-testid': 'app-sidebar', 'data-fid': 'sidebar' }"
  >
    <div ref="scroller" class="sidebar-nav__scroll flex-column gap-3 fg-1">
      <p v-if="!flat && !isCollapsed" class="sidebar-nav__title">{{ $t("shell.panels") }}</p>
      <ul class="sidebar-nav__list flex-column gap-3">
        <li>
          <SidebarNavItem
            :label="$t('nav.home')"
            :icon="ICONS.home"
            :to="HOME_ROUTE"
            :active="panelIdx === HOME"
            :collapsed="railed"
          />
        </li>
        <li v-for="panel in panels" :key="panel.idx">
          <SidebarNavGroup
            :panel="panel"
            :entries="tree[panel.idx]"
            :expanded="open.has(panel.idx)"
            :active="panel.idx === panelIdx"
            :active-entry="panel.idx === panelIdx ? entry?.route : ''"
            :flat="flat"
            :collapsed="railed"
            @toggle="toggleGroup(panel.idx)"
          />
        </li>
      </ul>
    </div>
    <div v-if="!flat" class="sidebar-nav__footer flex">
      <IconButton
        :icon="isCollapsed ? 'next' : 'prev'"
        :label="isCollapsed ? $t('app.expand_sidebar') : $t('app.collapse_sidebar')"
        :aria-expanded="String(!isCollapsed)"
        :aria-controls="navId"
        @click="toggle"
      />
    </div>
  </nav>
</template>

<script>
let nextId = 0;
</script>

<script setup>
// The persistent left navigation (R1, r05 §4): "Panele", Home, then every panel of the registry in order, each a
// SidebarNavGroup. The active panel's group opens when the panel becomes active; the others open and close on click
// (session state of this nav, not persisted). 300 px, scrolls on its own; `collapsed` (default: the user store's
// `isSidebarCollapsed`, persisted as `cms_sidebar_collapsed`) is the 64 px icon rail, toggled from the footer button
// (`v-model:collapsed` when the prop is set). `flat` is the MobileMenu list: no title, no footer, every panel one
// link to its root. The current entry is scrolled into view when it changes.
import { computed, nextTick, reactive, ref, watch } from "vue";
import { ICONS } from "@/boots/Icons/icons";
import IconButton from "@/boots/IconButton/index.vue";
import { useUserStore } from "@/stores/user";
import { HOME, HOME_ROUTE, useActiveNav, usePanels } from "@/composables/useNav";
import SidebarNavGroup from "./SidebarNavGroup.vue";
import SidebarNavItem from "./SidebarNavItem.vue";

const props = defineProps({
  flat: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: undefined },
});
const emit = defineEmits(["update:collapsed"]);

nextId += 1;
const navId = `sidebar-nav-${nextId}`;
const userStore = useUserStore();
const panels = usePanels();
const { panelIdx, entry, tree } = useActiveNav();
const open = reactive(new Set());

const isCollapsed = computed(() => props.collapsed ?? userStore.isSidebarCollapsed);
const railed = computed(() => isCollapsed.value && !props.flat);

// A `collapsed` prop owns the rail (catalogue): the toggle reports it and writes no preference.
function toggle() {
  if (props.collapsed === undefined) userStore.toggleSidebar();
  else emit("update:collapsed", !props.collapsed);
}

function toggleGroup(idx) {
  if (open.has(idx)) open.delete(idx);
  else open.add(idx);
}

watch(panelIdx, (idx) => idx && open.add(idx), { immediate: true });

// A deep link or a reload lands with the sidebar at its top: the current entry scrolls into view (a panel low in the
// list would leave the operator's place and its sibling pages off-screen).
const scroller = ref(null);
watch(
  () => entry.value?.route,
  async () => {
    await nextTick();
    const box = scroller.value;
    const item = box?.querySelector("[aria-current]");
    if (!item) return;
    // Centred in the sidebar's own scroll box (scrollIntoView would move the page too): its siblings show around it.
    const offset = item.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTop += offset - (box.clientHeight - item.offsetHeight) / 2;
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.sidebar-nav {
  box-sizing: border-box;
  width: 300px;
  height: 100%;
  border-right: 1px solid var(--border-hairline);
  background: var(--surface-page);
  transition: width 0.2s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.sidebar-nav__scroll {
  overflow-y: auto;
  min-height: 0;
  padding: var(--space-10) var(--space-5) var(--space-10) var(--space-10);
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, var(--accent), var(--border-strong));
  }
}

.sidebar-nav__title {
  padding: var(--space-2);
  color: var(--text-strong);
  font-family: var(--font-brand);
  font-size: var(--fs-400);
  line-height: 1.5;
}

.sidebar-nav__list {
  list-style: none;
}

.sidebar-nav__footer {
  padding: var(--space-3) var(--space-5) var(--space-5) var(--space-10);
}

.sidebar-nav--collapsed {
  width: var(--space-16);

  .sidebar-nav__scroll {
    align-items: center;
    padding: var(--space-10) var(--space-3);
  }

  .sidebar-nav__footer {
    justify-content: center;
    padding: var(--space-3);
  }
}

.sidebar-nav--flat {
  width: 100%;
  height: auto;
  border-right: none;

  .sidebar-nav__scroll {
    padding: var(--space-5);
  }
}
</style>
