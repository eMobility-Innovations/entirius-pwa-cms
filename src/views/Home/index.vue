<template>
  <div class="home-view h-100 ov-h">
    <div class="home-inner h-100 ovy-auto">
      <div class="home-content">
        <p class="home-greeting">{{ greeting }}</p>
        <h1 class="home-title">{{ $t("panels.choose_panel") }}</h1>

        <div class="panel-grid">
          <component
            :is="panel.isEnabled ? 'button' : 'div'"
            v-for="panel in panels"
            :key="panel.idx"
            class="panel-card"
            :class="{ 'panel-card--disabled': !panel.isEnabled }"
            v-bind="panel.isEnabled ? { tabindex: '0' } : {}"
            :aria-label="$t(panel.labelKey)"
            @click="panel.isEnabled && $router.push(panel.root)"
            @keydown.enter="panel.isEnabled && $router.push(panel.root)"
          >
            <div class="panel-card-icon-wrap">
              <FontAwesomeIcon :icon="panel.icon" class="panel-card-icon" />
            </div>
            <p class="panel-card-name">{{ $t(panel.labelKey) }}</p>
            <p v-if="panel.isEnabled" class="panel-card-desc">
              {{ $t(panel.descriptionKey) }}
            </p>
            <p v-else class="panel-card-locked-msg">
              <FontAwesomeIcon icon="lock" />
              {{ $t("panels.contact_admin") }}
            </p>
          </component>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useUserStore } from "@/stores/user";
import { useMuninStore } from "@/stores/munin";
import { useAccessMatrixStore } from "@/stores/accessMatrix";
import { isAccessPanelEnabled, isAccessPanelVisibleFor } from "@/configs/accessMatrix";
import { panels as panelRegistry } from "../../configs/access";

const HIDE_DISABLED = (process.env.VUE_APP_HIDE_DISABLED_PANELS || "").toUpperCase() === "TRUE";

export default {
  setup() {
    const userStore = useUserStore();
    const munin = useMuninStore();
    // The matrix is asked who this is here, because this is where the answer is spent.
    // With the panel flag OFF the store is never even constructed: `access` is not in the
    // registry, so there is nothing to gate, and a deployment without this overlay keeps
    // exactly the component it had — no new store, no request, no pinia dependency.
    const accessMatrix = isAccessPanelEnabled() ? useAccessMatrixStore() : null;
    accessMatrix?.ensureLoaded();
    return { userStore, munin, accessMatrix };
  },
  computed: {
    panels() {
      const all = panelRegistry
        .filter(p => isAccessPanelVisibleFor(p.idx, this.accessMatrix))
        .map(p => ({
          ...p,
          isEnabled: this.munin.isPanelEnabled(p.idx),
        }));
      return HIDE_DISABLED ? all.filter(p => p.isEnabled) : all;
    },
    user() {
      return this.userStore.user;
    },
    greeting() {
      const name = this.user?.first_name || this.user?.username || "";
      return name ? `Hello, ${name}` : "Hello";
    },
  },
};
</script>

<style lang="scss" scoped>
.home-view {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.home-inner {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
}
.home-content {
  width: 100%;
  max-width: 860px;
  padding: 3rem 2rem;
}
.home-greeting {
  font-size: 13px;
  font-weight: 500;
  color: var(--c-basic-500);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.home-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--c-basic-800);
  margin-bottom: 2rem;
}
.panel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  @media only screen and (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media only screen and (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}
.panel-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 20px 16px;
  background: var(--c-basic-100);
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: all 0.2s ease;
  &:hover,
  &:focus-visible {
    border-color: var(--c-basic-300);
    box-shadow: var(--shadow-sm);
    .panel-card-icon-wrap {
      background: var(--c-support-100);
    }
  }
}
.panel-card-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--c-basic-200);
  flex-shrink: 0;
  transition: background 0.2s ease;
}
.panel-card-icon {
  font-size: 18px;
  color: var(--c-support-400);
}
.panel-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--c-basic-800);
}
.panel-card-desc {
  font-size: 11px;
  color: var(--c-basic-500);
  line-height: 1.4;
}
.panel-card--disabled {
  opacity: 0.5;
  cursor: default;
  &:hover,
  &:focus-visible {
    border-color: transparent;
    box-shadow: none;
    .panel-card-icon-wrap {
      background: var(--c-basic-200);
    }
  }
}
.panel-card-locked-msg {
  font-size: 11px;
  color: var(--c-basic-400);
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
