<template>
  <CatalogueSection id="shell" :title="$t('ui_catalogue.sections.shell')">
    <h3 id="app-header" class="fs-500 mb-4">AppHeader</h3>
    <div class="flex-column gap-3 mb-10">
      <CatalogueCell id="app-header-desktop-default" label="desktop, 88 px: wordmark · health · bell · user" interact="focus">
        <AppHeader :mobile="false" menu-id="cat-shell-menu" />
      </CatalogueCell>
      <CatalogueCell id="app-header-mobile-default" label="mobile, 81 px: wordmark · user | menu" mobile>
        <AppHeader mobile menu-id="cat-shell-menu" />
      </CatalogueCell>
      <CatalogueCell id="app-header-mobile-open" label="mobile, menu open: pressed close" mobile>
        <AppHeader mobile menu-open menu-id="cat-shell-menu" />
      </CatalogueCell>
    </div>

    <h3 id="sidebar-nav" class="fs-500 mb-4">SidebarNav</h3>
    <div class="flex gap-3 mb-10 flex-wrap ai-st">
      <CatalogueCell id="sidebar-nav-expanded-default" label="expanded, 300 px (the stack's panels)">
        <div class="nav-frame"><SidebarNav :collapsed="false" /></div>
      </CatalogueCell>
      <CatalogueCell id="sidebar-nav-collapsed-default" label="collapsed rail, 64 px">
        <div class="nav-frame"><SidebarNav collapsed /></div>
      </CatalogueCell>
      <CatalogueCell id="sidebar-nav-flat-default" label="flat (mobile menu)" mobile>
        <SidebarNav flat />
      </CatalogueCell>
    </div>

    <h3 id="sidebar-nav-group" class="fs-500 mb-4">SidebarNavGroup</h3>
    <div class="nav-grid grid gap-3 mb-10">
      <CatalogueCell id="sidebar-nav-group-open-active" label="group, open, one entry active" interact="hover,focus">
        <SidebarNavGroup :panel="PAGES" :entries="PAGES_ENTRIES" expanded active active-entry="/pages/content" />
      </CatalogueCell>
      <CatalogueCell id="sidebar-nav-group-closed-default" label="group, closed" interact="hover,focus">
        <SidebarNavGroup :panel="PAGES" :entries="PAGES_ENTRIES" />
      </CatalogueCell>
      <CatalogueCell id="sidebar-nav-group-leaf-default" label="single entry: leaf link, no chevron">
        <SidebarNavGroup :panel="ORDERS" :entries="ORDERS_ENTRIES" />
      </CatalogueCell>
      <CatalogueCell id="sidebar-nav-group-locked-default" label="locked panel">
        <SidebarNavGroup :panel="{ ...ORDERS, isEnabled: false }" :entries="ORDERS_ENTRIES" />
      </CatalogueCell>
    </div>

    <h3 id="sidebar-nav-item" class="fs-500 mb-4">SidebarNavItem</h3>
    <div class="nav-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in ITEM_CELLS"
        :id="`sidebar-nav-item-${cell.id}`"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <SidebarNavItem v-bind="cell.props" />
      </CatalogueCell>
    </div>

    <h3 id="mobile-menu" class="fs-500 mb-4">MobileMenu</h3>
    <div class="flex gap-3 mb-10">
      <CatalogueCell id="mobile-menu-open-inline" label="open (inline: no trap, no teleport)" mobile>
        <MobileMenu id="cat-shell-menu" open inline />
      </CatalogueCell>
    </div>

    <h3 id="bottom-tab-bar" class="fs-500 mb-4">BottomTabBar</h3>
    <div class="flex-column gap-3 mb-10">
      <CatalogueCell id="bottom-tab-bar-2-items" label="2 entries, the first active" mobile interact="focus">
        <BottomTabBar :entries="LEADS_ENTRIES" label="Leads" current="/leads/inbox" />
      </CatalogueCell>
      <CatalogueCell id="bottom-tab-bar-5-items" label="5 entries (the most any panel has), long labels truncate" mobile>
        <BottomTabBar :entries="PAGES_ENTRIES" label="Pages" current="/pages/gallery" />
      </CatalogueCell>
    </div>

    <h3 id="user-menu" class="fs-500 mb-4">UserMenu</h3>
    <div class="flex gap-3 mb-10">
      <CatalogueCell id="user-menu-open-inline" label="open: name · theme · field hints · languages · health · password · logout">
        <UserMenu inline />
      </CatalogueCell>
    </div>

    <h3 id="basic-logo" class="fs-500 mb-4">BasicLogo</h3>
    <div class="nav-grid grid gap-3 mb-10">
      <CatalogueCell id="basic-logo-desktop-default" label="desktop header, 206 × 32">
        <div class="flex"><BasicLogo variant="full" :size="32" /></div>
      </CatalogueCell>
      <CatalogueCell id="basic-logo-mobile-default" label="mobile header, 154 × 24">
        <div class="flex"><BasicLogo variant="full" :size="24" /></div>
      </CatalogueCell>
      <CatalogueCell id="basic-logo-on-dark-default" label="onDark: the always-dark sign-in stage, in both themes">
        <div class="flex p-4 bg-page" data-theme="dark"><BasicLogo variant="full" :size="32" on-dark /></div>
      </CatalogueCell>
    </div>
  </CatalogueSection>
</template>

<script setup>
// Plan 21 cells (r02 §6, r05 §10): AppHeader desktop / mobile / menu open; SidebarNav expanded, collapsed rail and
// flat (the stack's own panels, nothing lit on /ui); groups and items per state from fixtures; MobileMenu and
// UserMenu open inline; BottomTabBar with 2 and 5 entries; BasicLogo two sizes. Nothing here clicks the theme or
// language items (they PATCH the shared profile).
import { ICONS } from "@/boots/Icons/icons";
import CatalogueSection from "../CatalogueSection.vue";
import CatalogueCell from "../CatalogueCell.vue";

const entry = (route, labelKey, icon) => ({ route, labelKey, icon, query: {}, app: [] });
const PAGES = { idx: "pages", icon: "file-code", root: "/pages/content", labelKey: "panels.pages", isEnabled: true };
const ORDERS = { idx: "checkout", icon: "shopping-cart", root: "/checkout-orders/orders", labelKey: "panels.checkout_orders", isEnabled: true };
const PAGES_ENTRIES = [
  entry("/pages/content", "nav.content_list", "file-code"),
  entry("/pages/layout-extender", "nav.layout_extender", "diagram-next"),
  entry("/pages/gallery", "nav.gallery", "image"),
  entry("/pages/content-sets", "nav.content_sets", "object-group"),
  entry("/pages/authors", "authors.title", "user-pen"),
];
const ORDERS_ENTRIES = [entry("/checkout-orders/orders", "nav.checkout_orders", "shopping-cart")];
const LEADS_ENTRIES = [entry("/leads/inbox", "nav.leads_inbox", "inbox"), entry("/leads/settings", "nav.leads_settings", "gear")];

const L1 = { label: "Pages", icon: "file-code", to: "/pages/content" };
const L2 = { label: "Content list", icon: "file-code", to: "/pages/content", level: 2 };
const LONG = "Seasonal content sets for every sales channel of the store";
const ITEM_CELLS = [
  { id: "l1-default", label: "L1 link (Home, a leaf panel)", props: { ...L1, label: "Home", icon: ICONS.home, to: "/" }, interact: "hover,focus" },
  { id: "l1-active", label: "L1 active (aria-current)", props: { ...L1, label: "Home", icon: ICONS.home, to: "/", active: true } },
  { id: "l1-locked", label: "L1 locked", props: { ...L1, label: "Stock", icon: "warehouse", locked: true } },
  { id: "l1-expanded", label: "L1 group open (chevron up)", props: { ...L1, expanded: true }, interact: "hover,focus" },
  { id: "l1-closed", label: "L1 group closed (chevron down)", props: { ...L1, expanded: false } },
  { id: "l1-group-active", label: "L1 group of the active panel", props: { ...L1, expanded: true, active: true } },
  { id: "l1-collapsed", label: "L1 in the collapsed rail (tooltip)", props: { ...L1, collapsed: true }, interact: "hover,focus" },
  { id: "l2-default", label: "L2 default", props: L2, interact: "hover,focus" },
  { id: "l2-active", label: "L2 active (accent rail)", props: { ...L2, active: true } },
  { id: "l2-overflow", label: "L2 long label truncates", props: { ...L2, label: LONG } },
];
</script>

<style lang="scss" scoped>
.nav-grid {
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
}

// The sidebar fills its parent's height and scrolls: the cell gives it a fixed box.
.nav-frame {
  height: 40rem;
}
</style>
