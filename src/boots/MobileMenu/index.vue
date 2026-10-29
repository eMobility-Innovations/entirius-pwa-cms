<template>
  <Teleport to="body" :disabled="inline">
    <div
      v-if="open"
      :id="id"
      ref="root"
      class="mobile-menu"
      :class="{ 'mobile-menu--inline': inline }"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('shell.menu')"
      tabindex="-1"
    >
      <IconButton
        v-if="!inline"
        class="mobile-menu__close"
        size="lg"
        icon="close"
        :label="$t('shell.close_menu')"
        @click="close"
      />
      <div class="mobile-menu__panel" data-fid="mobile-menu" @click="onPanelClick">
        <AiUsageLine v-if="showAiUsage && !inline" />
        <SidebarNav flat />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// The phone navigation (r05 §8.5, Figma S3): a full-screen modal dialog below the header with the flat sidebar list
// (Home + panels, locked ones dimmed). The header stays visible but inert; the dialog's own close button sits exactly
// over the header's menu button, so the pressed "close" state of S3 is this button. Focus moves to it on open, Tab
// cycles inside (useFocusTrap), Esc closes, focus returns to the menu button, a navigation closes it. Above the list,
// this month's AI usage (AiUsageLine) when the counter is visible: the phone header has no room for it. `inline`
// renders the list in the page flow with no trap (catalogue).
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import IconButton from "@/boots/IconButton/index.vue";
import SidebarNav from "@/boots/SidebarNav/index.vue";
import AiUsageLine from "@/components/AiUsage/AiUsageLine.vue";
import { useAiUsageVisible } from "@/components/AiUsage/useAiUsage";
import { useFocusTrap } from "@/composables/useFocusTrap";

const props = defineProps({
  open: { type: Boolean, default: false },
  id: { type: String, default: "app-mobile-menu" },
  inline: { type: Boolean, default: false },
});
const emit = defineEmits(["update:open"]);

const route = useRoute();
const showAiUsage = useAiUsageVisible();
const root = ref(null);
const close = () => emit("update:open", false);

useFocusTrap(root, {
  active: () => props.open && !props.inline,
  initialFocus: () => root.value?.querySelector(".mobile-menu__close"),
  onEscape: close,
});

// A link closes the menu even when it points at the page already open (the router then does not navigate).
function onPanelClick(event) {
  if (!props.inline && event.target.closest("a[href]")) close();
}

watch(
  () => route.path,
  () => props.open && !props.inline && close()
);
</script>

<style lang="scss" scoped>
// The header's height on a phone: 20 px padding around a 40 px button, plus its 1 px hairline.
.mobile-menu {
  --mobile-menu-top: calc(var(--space-10) + 2 * var(--space-5) + 1px);

  position: fixed;
  z-index: 150;
  top: 0;
  left: 0;
  // The app's own box (App.vue #app): a fixed `inset: 0` layer spans the layout viewport, which a phone may widen
  // past the visible one.
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  outline: none;
}

// IconButton puts the class on its button, below its own root: reach it through :deep.
.mobile-menu :deep(.mobile-menu__close) {
  position: absolute;
  top: var(--space-5);
  right: var(--space-5);
  color: var(--text-body);
  background-color: var(--surface-hover);
}

.mobile-menu__panel {
  position: absolute;
  inset: var(--mobile-menu-top) 0 0;
  overflow-y: auto;
  background: var(--surface-page);
}

.mobile-menu--inline {
  position: static;

  .mobile-menu__panel {
    position: static;
  }
}
</style>
