<template>
  <div class="ui-catalogue h-100 ovy-auto page-pad">
    <PageHeader :title="$t('nav.ui_catalogue')" class="mb-8" />
    <IconsSection />
    <ActionsSection />
    <OverlaysSection />
    <DisplaySection />
    <PageFrameSection />
    <SelectsSection />
    <InputsSection />
    <ShellSection />
  </div>
</template>

<script setup>
// Component catalogue (docs/testing.md → "Catalogue"): static fixtures, no API call, one section per P3/P4 plan.
// `?theme=dark|light` sets the theme on <html> for this page only, never through the user store (that PATCHes
// the shared profile); leaving the page puts back the user's theme.
import { onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";
import IconsSection from "./sections/Icons.vue";
import ActionsSection from "./sections/Actions.vue";
import OverlaysSection from "./sections/Overlays.vue";
import DisplaySection from "./sections/Display.vue";
import PageFrameSection from "./sections/PageFrame.vue";
import SelectsSection from "./sections/Selects.vue";
import InputsSection from "./sections/Inputs.vue";
import ShellSection from "./sections/Shell.vue";

const THEMES = { dark: "dark", light: "default" };
const root = document.documentElement;
const route = useRoute();
const userStore = useUserStore();
let pinned = null;

watch(
  () => THEMES[route.query.theme],
  (theme) => {
    if (!theme) return;
    root.setAttribute("data-theme", theme);
    pinned = theme;
  },
  { immediate: true }
);
// The profile preferences can arrive after the catalogue opened, and setTheme writes the attribute: put the pin back.
const keepPinned = new MutationObserver(() => {
  if (pinned && root.getAttribute("data-theme") !== pinned) root.setAttribute("data-theme", pinned);
});
keepPinned.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
onBeforeUnmount(() => {
  keepPinned.disconnect();
  if (pinned) root.setAttribute("data-theme", userStore.theme);
});
</script>
