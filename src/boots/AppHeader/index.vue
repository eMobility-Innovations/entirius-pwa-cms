<template>
  <header class="app-header flex ai-ct" :class="{ 'app-header--mobile': isMobile }" data-fid="header">
    <router-link to="/" class="app-header__logo flex ai-ct" data-fid="logo">
      <BasicLogo variant="full" :size="isMobile ? 24 : 32" />
    </router-link>
    <div class="app-header__tools flex ai-ct gap-3">
      <AiUsageButton v-if="showAiUsage && !isMobile" />
      <ConfigHealthButton v-if="munin.healthAvailable" :show-icon="!isMobile" />
      <NotificationBell v-if="munin.isModuleEnabled('notifications')" />
      <UserMenu />
      <template v-if="isMobile">
        <span class="app-header__separator" aria-hidden="true" />
        <IconButton
          size="lg"
          :icon="menuOpen ? 'close' : 'menu'"
          :label="menuOpen ? $t('shell.close_menu') : $t('shell.menu')"
          :class="{ 'app-header__menu--open': menuOpen }"
          :aria-expanded="String(menuOpen)"
          :aria-controls="menuId"
          @click="$emit('update:menuOpen', !menuOpen)"
        />
      </template>
    </div>
  </header>
</template>

<script setup>
// The app bar (R1, R2; r05 §5, Figma S1/S2): the wordmark (home link) and, on the right, the AI-usage counter (desktop;
// a phone shows it in the MobileMenu), configuration health and the notification bell (both conditional, as
// before) and the user menu, 12 px apart. A phone keeps the bell and reaches
// configuration health through the user menu (no room for the icon). No page title, no panel switcher. Desktop 88 px
// (wordmark 206 × 32 at x 40); below the shell breakpoint 81 px (wordmark 154 × 24) with the menu button after a
// hairline separator: it toggles `menuOpen` (v-model) and controls the MobileMenu `menuId`. `mobile` forces a layout
// (catalogue); by default the breakpoint decides.
import { computed } from "vue";
import BasicLogo from "@/boots/BasicLogo/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import UserMenu from "@/boots/UserMenu/index.vue";
import AiUsageButton from "@/components/AiUsage/AiUsageButton.vue";
import { useAiUsageVisible } from "@/components/AiUsage/useAiUsage";
import ConfigHealthButton from "@/components/ConfigHealth/ConfigHealthButton.vue";
import NotificationBell from "@/components/NotificationBar/NotificationBell.vue";
import { useMuninStore } from "@/stores/munin";
import { useIsDesktop } from "@/composables/useIsDesktop";

const props = defineProps({
  menuOpen: { type: Boolean, default: false },
  menuId: { type: String, default: "app-mobile-menu" },
  mobile: { type: Boolean, default: undefined },
});
defineEmits(["update:menuOpen"]);

const munin = useMuninStore();
const isDesktop = useIsDesktop();
const isMobile = computed(() => props.mobile ?? !isDesktop.value);
const showAiUsage = useAiUsageVisible();
</script>

<style lang="scss" scoped>
.app-header {
  box-sizing: border-box;
  width: 100%;
  height: 88px;
  padding: 0 var(--space-10);
  border-bottom: 1px solid var(--border-hairline);
  background: var(--surface-page);
}

.app-header--mobile {
  height: auto;
  padding: var(--space-5);
}

.app-header__logo {
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}

.app-header__tools {
  margin-left: auto;
}

// Figma S1: the user button sits 20 px from the top of the 88 px bar, the wordmark is centred.
.app-header:not(.app-header--mobile) .app-header__tools {
  align-self: flex-start;
  padding-top: var(--space-5);
}

// The open state looks pressed (Figma S3) but is announced by aria-expanded alone.
.app-header :deep(.app-header__menu--open) {
  color: var(--text-body);
  background-color: var(--surface-hover);
}

.app-header__separator {
  width: 1px;
  height: var(--space-6);
  background: var(--border-hairline);
}
</style>
