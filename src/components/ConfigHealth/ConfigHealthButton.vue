<template>
  <BasicMenu
    ref="menu"
    :label="$t('config_health.title')"
    placement="bottom-end"
    sheet
    @open="store.panelOpen = true"
    @close="store.panelOpen = false"
  >
    <template #trigger>
      <span v-if="visible && showIcon" class="cfg-btn relative inline-flex" :class="{ 'cfg-btn--fixed': fixed }">
        <IconButton
          size="lg"
          class="cfg-btn__icon"
          :icon="fixed ? 'success' : 'warning'"
          :label="label"
          data-testid="config-health-button"
        />
        <span v-if="!fixed" class="cfg-btn__count" data-testid="config-health-count">{{ store.failing.length }}</span>
      </span>
      <!-- the wrapper takes the button out of the flow; the button's own class clips it (BasicButton sets position) -->
      <span v-else class="visually-hidden">
        <BasicButton variant="ghost" tabindex="-1" class="visually-hidden" data-testid="config-health-anchor">
          {{ $t("config_health.title") }}
        </BasicButton>
      </span>
    </template>
    <template #panel="{ close }">
      <ConfigHealthPanel @close="close" />
    </template>
  </BasicMenu>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { t } from "@/i18n";
import BasicButton from "@/boots/BasicButton/index.vue";
import BasicMenu from "@/boots/BasicMenu/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import { useConfigHealthStore } from "@/stores/configHealth";
import ConfigHealthPanel from "./ConfigHealthPanel.vue";

// Silence means healthy: the icon exists only while a check fails, plus ~10 s of green "fixed" after a flip.
// The panel opens in BasicMenu's panel mode from both entry points: this icon, and the user menu, which sets
// `store.panelOpen` (the menu then anchors under the icon's place in the header, icon or not). `showIcon` false keeps
// the panel without the icon (a phone header). Without the icon the trigger is a visually hidden named button, out of
// the tab order: the menu still has a control to name, anchor and return focus to when the panel closes.
defineProps({ showIcon: { type: Boolean, default: true } });

const store = useConfigHealthStore();
const menu = ref(null);

const fixed = computed(() => !store.failing.length && store.justFixed);
const visible = computed(() => store.failing.length > 0 || fixed.value);
const label = computed(() =>
  fixed.value ? t("config_health.fixed") : t("config_health.open", { count: store.failing.length })
);

const syncMenu = () => (store.panelOpen ? menu.value?.open() : menu.value?.close());
watch(() => store.panelOpen, syncMenu, { flush: "post" });
onMounted(syncMenu);
</script>

<style scoped>
.cfg-btn :deep(.cfg-btn__icon) {
  color: var(--warning);
}

.cfg-btn--fixed :deep(.cfg-btn__icon) {
  color: var(--positive);
}

.cfg-btn__count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--negative-fill);
  color: var(--text-on-status-fill);
  font-size: var(--fs-100);
  font-weight: 600;
  line-height: 1.1rem;
  text-align: center;
  pointer-events: none;
}
</style>
