<template>
  <PageHeader v-if="!claims" class="shell-page-header" :title="routeTitle" :crumbs="crumbs" :claim-shell="false" />
  <slot />
</template>

<script setup>
// The page-header slot of the shell (R2, R3; r05 #4) at the top of <main>. A view's PageHeader claims it
// (PAGE_HEADER_CLAIM) and gets the route's crumbs, the back action to the parent crumb and a place for its title;
// while nobody claims it, this renders the fallback: a PageHeader (out of the claim) with the crumbs and the H1 from
// the route's `titleKey`, so every page has exactly one H1. The fallback draws no back arrow: a view without a PageHeader keeps its own back control (a
// toolbar IconButton that may carry its own target), so a page shows one. The browser tab reads `<page> · <panel> · Entirius CMS`.
import { computed, onBeforeUnmount, provide, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { t } from "@/i18n";
import PageHeader from "@/boots/PageHeader/index.vue";
import { PAGE_HEADER_CLAIM } from "@/composables/pageHeader";
import { useActiveNav, useBreadcrumbs, usePanels } from "@/composables/useNav";

const APP_NAME = "Entirius CMS";

const route = useRoute();
const panels = usePanels();
const { panelIdx } = useActiveNav();
const claims = ref(0);
const claimedTitle = ref("");
const { crumbs, back } = useBreadcrumbs(() => claimedTitle.value || null);

// The deepest matched route that names itself.
const routeTitle = computed(() => {
  const named = route.matched.findLast((record) => record.meta?.titleKey);
  return t(named ? named.meta.titleKey : "app.no_title");
});
const panelLabel = computed(() => {
  const panel = panels.value.find((candidate) => candidate.idx === panelIdx.value);
  return panel ? t(panel.labelKey) : "";
});

function release() {
  claims.value = Math.max(0, claims.value - 1);
  if (!claims.value) claimedTitle.value = "";
}

provide(PAGE_HEADER_CLAIM, { claim: () => (claims.value += 1), release, crumbs, back, title: claimedTitle });

watchEffect(() => {
  const page = claimedTitle.value || routeTitle.value;
  document.title = [...new Set([page, panelLabel.value])].filter(Boolean).concat(APP_NAME).join(" · ");
});
onBeforeUnmount(() => (document.title = APP_NAME));
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// PageLayout's frame: 40 / 80 on desktop, 20 on a phone; the view below keeps its own padding.
// The bottom padding keeps the H1's descenders off a panel toolbar that follows it directly.
.shell-page-header {
  flex: none;
  padding: var(--space-10) calc(2 * var(--space-10)) var(--space-2);

  @include max-tablet {
    padding: var(--space-5) var(--space-5) var(--space-2);
  }
}
</style>
