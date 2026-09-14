<template>
  <div class="hc flex ai-ct">
    <!-- Panel Switcher -->
    <div class="relative" v-out="'isPanelSwitcherOpen'">
      <button
        class="hc-btn"
        :class="{ 'hc-btn--active': isPanelSwitcherOpen }"
        tabindex="0"
        :aria-label="$t('panels.switch_panel')"
        @click="isPanelSwitcherOpen = !isPanelSwitcherOpen"
        @keydown.enter="isPanelSwitcherOpen = !isPanelSwitcherOpen"
      >
        <FontAwesomeIcon icon="grip" />
      </button>
      <transition name="hc-drop">
        <div v-if="isPanelSwitcherOpen" class="hc-dropdown">
          <p class="hc-dropdown-label">{{ $t("panels.switch_panel") }}</p>
          <component
            :is="panel.isEnabled ? 'button' : 'div'"
            v-for="panel in panels"
            :key="panel.idx"
            class="hc-dropdown-item"
            :class="{
              'hc-dropdown-item--active':
                panel.isEnabled && activeApp === panel.idx,
              'hc-dropdown-item--disabled': !panel.isEnabled,
            }"
            v-bind="panel.isEnabled ? { tabindex: '0' } : {}"
            @click="panel.isEnabled && handlePanelSelect(panel)"
            @keydown.enter="panel.isEnabled && handlePanelSelect(panel)"
          >
            <FontAwesomeIcon
              :icon="panel.isEnabled ? panel.icon : 'lock'"
              class="hc-dropdown-icon"
            />
            <span>{{ $t(panel.labelKey) }}</span>
          </component>
          <div class="hc-dropdown-sep"></div>
          <button
            class="hc-dropdown-item"
            tabindex="0"
            @click="handleGoHome"
            @keydown.enter="handleGoHome"
          >
            <FontAwesomeIcon icon="house" class="hc-dropdown-icon" />
            <span>{{ $t("nav.home") }}</span>
          </button>
        </div>
      </transition>
    </div>

    <!-- Separator -->
    <div class="hc-sep"></div>

    <!-- User Menu -->
    <div class="relative" v-out="'isUserMenuOpen'">
      <button
        class="hc-btn"
        :class="{ 'hc-btn--active': isUserMenuOpen }"
        tabindex="0"
        :aria-label="userFullName"
        @click="isUserMenuOpen = !isUserMenuOpen"
        @keydown.enter="isUserMenuOpen = !isUserMenuOpen"
      >
        <FontAwesomeIcon icon="user" />
      </button>
      <transition name="hc-drop">
        <div v-if="isUserMenuOpen" class="hc-dropdown hc-dropdown--user">
          <!-- User info -->
          <p class="hc-dropdown-label">{{ userFullName }}</p>

          <!-- Theme toggle -->
          <button
            class="hc-dropdown-item"
            tabindex="0"
            @click="toggleTheme"
            @keydown.enter="toggleTheme"
          >
            <FontAwesomeIcon
              :icon="isDark ? 'sun' : 'moon'"
              class="hc-dropdown-icon"
            />
            <span>{{
              isDark ? $t("app.light_mode") : $t("app.dark_mode")
            }}</span>
          </button>

          <!-- Language picker -->
          <button
            class="hc-dropdown-item"
            tabindex="0"
            @click="isLangOpen = !isLangOpen"
            @keydown.enter="isLangOpen = !isLangOpen"
          >
            <FontAwesomeIcon icon="globe" class="hc-dropdown-icon" />
            <span>{{ currentLangLabel }}</span>
            <FontAwesomeIcon
              :icon="isLangOpen ? 'chevron-up' : 'chevron-down'"
              class="hc-dropdown-chevron"
            />
          </button>
          <div v-if="isLangOpen" class="hc-lang-list">
            <button
              v-for="l in languages"
              :key="l.code"
              class="hc-dropdown-item"
              :class="{ 'hc-dropdown-item--active': currentLang === l.code }"
              tabindex="0"
              @click="selectLanguage(l.code)"
              @keydown.enter="selectLanguage(l.code)"
            >
              <FontAwesomeIcon
                :icon="currentLang === l.code ? 'check' : 'globe'"
                class="hc-dropdown-icon"
              />
              <span>{{ l.label }}</span>
            </button>
          </div>

          <!-- Change password. Hidden when the identity provider owns the credential:
               these accounts have no local password, so the form cannot succeed. -->
          <button
            v-if="!ssoOnly"
            data-test="change-password"
            class="hc-dropdown-item"
            tabindex="0"
            @click="goToChangePassword"
            @keydown.enter="goToChangePassword"
          >
            <FontAwesomeIcon icon="key" class="hc-dropdown-icon" />
            <span>{{ $t("user.change_password") }}</span>
          </button>

          <div class="hc-dropdown-sep"></div>

          <!-- Logout -->
          <button
            class="hc-dropdown-item hc-dropdown-item--danger"
            tabindex="0"
            @click="handleLogout"
            @keydown.enter="handleLogout"
          >
            <FontAwesomeIcon
              icon="arrow-right-from-bracket"
              class="hc-dropdown-icon"
            />
            <span>{{ $t("app.log_out") }}</span>
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import { useUserStore } from "@/stores/user";
import { useNotifyStore } from "@/stores/notify";
import { useMuninStore } from "@/stores/munin";
import { panels } from "../../configs/access";
import { POST_Logout } from "../../api/contentDB/api";
import { isSsoOnly } from "@/configs/sso";

const HIDE_DISABLED = (process.env.VUE_APP_HIDE_DISABLED_PANELS || "").toUpperCase() === "TRUE";

export default {
  setup() {
    const userStore = useUserStore();
    const notify = useNotifyStore();
    const munin = useMuninStore();
    return { userStore, notify, munin };
  },
  data() {
    return {
      isPanelSwitcherOpen: false,
      isUserMenuOpen: false,
      isLangOpen: false,
      languages: [
        { code: "EN", label: "English" },
        { code: "PL", label: "Polski" },
      ],
    };
  },
  computed: {
    ssoOnly() {
      return isSsoOnly();
    },
    panels() {
      const all = panels.map((p) => ({
        ...p,
        isEnabled: this.munin.isPanelEnabled(p.idx),
      }));
      return HIDE_DISABLED ? all.filter((p) => p.isEnabled) : all;
    },
    user() {
      return this.userStore.user;
    },
    refresh() {
      return this.userStore.refresh;
    },
    activeApp() {
      return this.userStore.activeApp;
    },
    theme() {
      return this.userStore.theme;
    },
    isDark() {
      return this.theme === "dark";
    },
    currentLang() {
      return this.userStore.lang;
    },
    currentLangLabel() {
      const found = this.languages.find((l) => l.code === this.currentLang);
      return found ? found.label : this.currentLang;
    },
    userFullName() {
      return this.user?.username || this.user?.email || "User";
    },
  },
  methods: {
    toggleTheme() {
      this.userStore.setTheme(this.isDark ? "default" : "dark");
    },
    selectLanguage(code) {
      if (code !== this.currentLang) {
        this.userStore.setLanguage(code);
      }
      this.isLangOpen = false;
    },
    handlePanelSelect(panel) {
      this.isPanelSwitcherOpen = false;
      this.$router.push(panel.root);
    },
    handleGoHome() {
      this.isPanelSwitcherOpen = false;
      this.$router.push("/");
    },
    goToChangePassword() {
      this.isUserMenuOpen = false;
      this.$router.push("/change-password");
    },
    async handleLogout() {
      this.isUserMenuOpen = false;
      await POST_Logout({ refresh: this.refresh });
      this.userStore.clearAuth();
      if (this.$route.path !== "/") {
        this.$router.push("/");
      }
    },
  },
};
</script>

<style lang="scss">
.hc {
  gap: 2px;
}
.hc-sep {
  width: 1px;
  height: 16px;
  background: var(--c-basic-300);
  margin: 0 4px;
}
.hc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: none;
  color: var(--c-basic-500);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;
  &:hover {
    background: var(--c-basic-200);
    color: var(--c-basic-700);
  }
  &--active {
    background: var(--c-basic-200);
    color: var(--c-basic-800);
  }
}

/* Dropdown */
.hc-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  padding: 6px;
  background: var(--c-basic-100);
  border: 1px solid var(--c-basic-300);
  border-radius: 10px;
  box-shadow: var(--shadow-md);
  z-index: 100;
  &--user {
    min-width: 260px;
  }
}
.hc-dropdown-label {
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--c-basic-500);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.hc-dropdown-sep {
  height: 1px;
  background: var(--c-basic-300);
  margin: 4px 6px;
}
.hc-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: none;
  border: none;
  font: inherit;
  font-size: 13px;
  color: var(--c-basic-700);
  text-align: left;
  transition: background 0.12s ease;
  &:hover {
    background: var(--c-basic-200);
  }
  &--active {
    color: var(--c-support-400);
    font-weight: 600;
    background: var(--c-support-100);
    &:hover {
      background: var(--c-support-100);
    }
  }
  &--disabled {
    opacity: 0.45;
    cursor: default;
    &:hover {
      background: none;
    }
  }
  &--danger:hover {
    color: var(--c-negative-200);
  }
}
.hc-dropdown-icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  font-size: 12px;
}

.hc-dropdown-chevron {
  margin-left: auto;
  font-size: 10px;
  color: var(--c-basic-400);
}
.hc-lang-list {
  padding-left: 12px;
}

/* Dropdown animation */
.hc-drop-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.hc-drop-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.hc-drop-enter-from,
.hc-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
