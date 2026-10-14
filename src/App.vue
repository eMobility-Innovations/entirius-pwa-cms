<template>
  <div
    id="app"
    class="bg-page flex-column"
    :class="{ 'app--no-panel-nav': !showBottomBar }"
  >
    <EnvMissing v-if="!envValid" :status="envStatus" />
    <StaffOnlyWall v-else-if="isAuth && !access.isStaff" />
    <router-view v-else-if="isAuth && isFullscreen" />
    <template v-else-if="isAuth">
      <a href="#main" class="skip-link" @click.prevent="focusMain">
        {{ $t("shell.skip_to_content") }}
      </a>
      <AppHeader v-model:menu-open="menuOpen" :menu-id="MOBILE_MENU_ID" />
      <div class="app-body flex">
        <SidebarNav
          v-if="isDesktop"
          :class="{ 'sidebar-disabled': handyType }"
          :inert="handyType || undefined"
        />
        <main
          id="main"
          ref="main"
          class="app-main flex-column"
          tabindex="-1"
          data-fid="content"
        >
          <ShellPageHeader>
            <div class="app-main__view">
              <router-view class="h-100" />
            </div>
          </ShellPageHeader>
        </main>
      </div>
      <BottomTabBar v-if="showBottomBar" />
      <MobileMenu
        v-if="!isDesktop"
        :id="MOBILE_MENU_ID"
        v-model:open="menuOpen"
      />
      <Transition name="loader-fade"><Loader v-if="loading" overlay /></Transition>
      <handy-kit v-if="handyType" />
    </template>
    <router-view v-else-if="isPublicRoute" />
    <LoginWall v-else />
    <Notifications />
  </div>
</template>

<script>
import { provide } from "vue";
import { useLoaderStore } from "@/stores/loader";
import { useUserStore } from "@/stores/user";
import { useHandyStore } from "@/stores/handy";
import { useMuninStore } from "@/stores/munin";
import { useAccessStore } from "@/stores/access";
import { ACCESS_STORE } from "@/composables/useReadonly";
import { AREAS } from "@/configs/areas";
import { useNotificationsStore } from "@/stores/notifications";
import { useConfigHealthStore } from "@/stores/configHealth";
import { useEnrichmentProfileStore } from "@/stores/enrichmentProfile";
import { useLeadTypesStore } from "@/stores/leadTypes";
import { useIsDesktop } from "@/composables/useIsDesktop";
import { tabBarShown, useActiveNav } from "@/composables/useNav";

import { envStatus } from "@/utils/env-check";
import { clearCompanyNames } from "@/utils/leadsCompanyNames";
import "@/utils/client-config-check";
import EnvMissing from "./components/EnvMissing.vue";
import LoginWall from "./functionals/Login-wall/Login-wall.vue";
import StaffOnlyWall from "./components/Access/StaffOnlyWall.vue";
import Notifications from "./components/Notifications/Notifications.vue";
import ShellPageHeader from "./components/Shell/ShellPageHeader.vue";
import AppHeader from "./boots/AppHeader/index.vue";
import SidebarNav from "./boots/SidebarNav/index.vue";
import BottomTabBar from "./boots/BottomTabBar/index.vue";
import MobileMenu from "./boots/MobileMenu/index.vue";

import HandyKit from "./functionals/Handy-kit/Handy-kit.vue";

// The shell (R1, R2; r05): skip link → AppHeader → SidebarNav (from the shell breakpoint up, every authenticated
// route) + <main> (fallback page header, router view) → BottomTabBar + MobileMenu (below it). `meta.fullscreen`,
// the login wall and public routes stay shell-less. A path change moves focus to <main>; a query change does not.
export default {
  setup() {
    const loader = useLoaderStore();
    const userStore = useUserStore();
    const handy = useHandyStore();
    const munin = useMuninStore();
    const access = useAccessStore();
    // Every PageLayout reads it to decide its read-only mode (src/composables/useReadonly.js).
    provide(ACCESS_STORE, access);
    const notificationBar = useNotificationsStore();
    const configHealth = useConfigHealthStore();
    const leadTypes = useLeadTypesStore();
    const enrichmentProfile = useEnrichmentProfileStore();
    const isDesktop = useIsDesktop();
    const { panelIdx, tree } = useActiveNav();
    return {
      loader, userStore, handy, munin, access, notificationBar, configHealth, leadTypes, enrichmentProfile, isDesktop, panelIdx, tree,
    };
  },
  data() {
    return { envStatus, menuOpen: false, MOBILE_MENU_ID: "app-mobile-menu" };
  },
  computed: {
    envValid() {
      return envStatus.valid;
    },
    loading() {
      return this.loader.loading;
    },
    handyType() {
      return this.handy.handyType;
    },
    isAuth() {
      return this.userStore.isAuth;
    },
    notificationsActive() {
      return this.userStore.isAuth && this.access.isStaff && this.munin.isModuleEnabled("notifications");
    },
    // `health/` is the `munin.config` area: a role without it would collect a 403 every poll. Decided once `me` is in.
    configHealthActive() {
      const allowed = this.access.loaded && this.access.can(AREAS.MUNIN_CONFIG);
      return this.userStore.isAuth && this.access.isStaff && allowed && this.munin.healthAvailable;
    },
    // The company profile's health row and the Memory badge: the enrichment module on, `enrichment.profile` readable.
    enrichmentProfileActive() {
      const allowed = this.access.loaded && this.access.can(AREAS.ENRICHMENT_PROFILE);
      return this.userStore.isAuth && this.access.isStaff && allowed && this.munin.isModuleEnabled("enrichment");
    },
    // A phone shows the tab bar for a panel with two or more entries, never on `meta.noBottomBar` (Leads Review keeps
    // its sticky actions); without it `--bottom-bar-height` is 0 (the FloatingActions offset).
    showBottomBar() {
      const entries = this.tree[this.panelIdx] ?? [];
      return this.isAuth && !this.isDesktop && tabBarShown(entries, this.$route);
    },
    isPublicRoute() {
      return this.$route.meta?.requiresAuth === false;
    },
    isFullscreen() {
      return !!this.$route.meta?.fullscreen;
    },
  },
  watch: {
    // Notification bar polling runs only while logged in and the module is on.
    notificationsActive: {
      handler(active) {
        if (active) this.notificationBar.start();
        else this.notificationBar.stop();
      },
      immediate: true,
    },
    configHealthActive: {
      handler(active) {
        if (active) this.configHealth.start();
        else this.configHealth.stop();
      },
      immediate: true,
    },
    enrichmentProfileActive: {
      handler(active) {
        if (active) this.enrichmentProfile.start();
        else this.enrichmentProfile.stop();
      },
      immediate: true,
    },
    // The mobile menu does not outlive the phone layout.
    isDesktop(desktop) {
      if (desktop) this.menuOpen = false;
    },
    // Logout drops the caches that outlive a view — the next user may work another channel or hold other rights.
    isAuth(auth) {
      if (auth) return;
      this.access.reset();
      this.leadTypes.reset();
      clearCompanyNames();
    },
  },
  methods: {
    focusMain() {
      this.$refs.main?.focus({ preventScroll: true });
    },
  },

  async created() {
    // Not on the first navigation: the page loads with focus at the top, so the skip link comes first.
    this.$router.afterEach((to, from) => {
      if (from.matched.length && to.path !== from.path) this.$nextTick(this.focusMain);
    });
    this.userStore.appInit();
    if (this.userStore.isAuth) {
      this.munin.ensureLoaded();
      this.access.ensureLoaded();
    }
  },
  components: {
    EnvMissing,
    Notifications,
    ShellPageHeader,
    AppHeader,
    SidebarNav,
    BottomTabBar,
    MobileMenu,
    HandyKit,
    LoginWall,
    StaffOnlyWall,
  },
};
</script>

<style lang="scss">
@import "./assets/scss/main.scss";
// The dynamic viewport: the document never scrolls (the scroll body is <main>), so Android's browser toolbar never
// collapses and 100vh stays taller than the visible area — the bottom tab bar would sit under the system bar.
#app {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
// A screen without the tab bar reclaims its height: the var also drives the FloatingActions offset.
.app--no-panel-nav {
  --bottom-bar-height: 0px;
}
.app-body {
  flex: 1;
  min-height: 0;
}
// The content area is the page's scroll and focus region; the view below the page header fills the rest.
.app-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  outline: none;
}
.app-main__view {
  flex: 1;
  min-height: 0;
}
// Handy-kit (the builder's editing tools) keeps the sidebar dimmed and out of reach.
.sidebar-disabled {
  opacity: 0.4;
  pointer-events: none;
}
.skip-link {
  position: fixed;
  z-index: 300;
  top: var(--space-2);
  left: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-base);
  color: var(--text-on-accent-fill);
  background: var(--accent-fill);
  transform: translateY(-200%);

  &:focus-visible {
    transform: none;
  }
}
// Every shell control draws a full focus ring in the focus-ring token; page content keeps the reset's. `:where` keeps
// the rule just above the reset, so a component's own ring (the inset one of a nav row) still wins.
.skip-link:focus-visible,
:where(.app-header, .sidebar-nav, .bottom-tab-bar, .mobile-menu) :is(a, button):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
