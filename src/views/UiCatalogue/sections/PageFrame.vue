<template>
  <CatalogueSection id="page-frame" :title="$t('ui_catalogue.sections.page_frame')">
    <h3 id="page-header" class="fs-500 mb-4">PageHeader</h3>
    <div class="flex-column gap-3 mb-10">
      <CatalogueCell id="page-header-root-default" label="root: H1 only">
        <PageHeader :claim-shell="false" title="Lista treści" />
      </CatalogueCell>
      <CatalogueCell id="page-header-home-default" label="home: overline + H1">
        <PageHeader :claim-shell="false" overline="Home" title="Witaj w Entirius CMS" />
      </CatalogueCell>
      <CatalogueCell id="page-header-detail-default" label="detail: crumbs + back + H1 + chip + ActionBar" interact="focus">
        <PageHeader :claim-shell="false" title="Product Showcase" :crumbs="CRUMBS" :back="noop">
          <template #meta><StatusBadge label="Opublikowany" tone="positive" /></template>
          <template #actions><ActionBar :actions="ACTIONS" /></template>
        </PageHeader>
      </CatalogueCell>
      <CatalogueCell id="page-header-overflow-default" label="long title: wraps, actions keep their place">
        <PageHeader :claim-shell="false" :title="LONG_TITLE" :crumbs="CRUMBS" :back="noop">
          <template #actions><ActionBar :actions="ACTIONS" /></template>
        </PageHeader>
      </CatalogueCell>
      <CatalogueCell id="page-header-mobile-sticky" label="mobile sticky head (pinned below 768 px), actions row below" mobile>
        <PageHeader :claim-shell="false" title="Product Showcase" :crumbs="CRUMBS" :back="noop" sticky>
          <template #meta><StatusBadge label="Opublikowany" tone="positive" /></template>
          <template #actions><ActionBar :actions="ACTIONS" /></template>
        </PageHeader>
      </CatalogueCell>
    </div>

    <h3 id="breadcrumbs" class="fs-500 mb-4">Breadcrumbs</h3>
    <div class="frame-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in crumbCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <Breadcrumbs :items="cell.items" :size="cell.size" />
      </CatalogueCell>
    </div>

    <h3 id="page-layout" class="fs-500 mb-4">PageLayout</h3>
    <div class="frame-grid frame-grid--wide grid gap-3 mb-10">
      <CatalogueCell id="page-layout-full-default" label="full: header + body">
        <div class="layout-frame bg-page">
          <PageLayout>
            <template #header><PageHeader :claim-shell="false" title="Lista treści" /></template>
            <p class="fs-300">Treść strony na tle strony, bez ramki.</p>
          </PageLayout>
        </div>
      </CatalogueCell>
      <CatalogueCell id="page-layout-toolbar-default" label="with toolbar slot (filters row)">
        <div class="layout-frame bg-page">
          <PageLayout>
            <template #header><PageHeader :claim-shell="false" title="Lista treści" /></template>
            <template #toolbar>
              <div class="flex ai-ct gap-2">
                <FilterChip label="Wszystkie" />
                <FilterChip label="Szkice" :count="12" active />
              </div>
            </template>
            <p class="fs-300">Treść strony na tle strony, bez ramki.</p>
          </PageLayout>
        </div>
      </CatalogueCell>
    </div>
  </CatalogueSection>
</template>

<script setup>
// Plan 14 cells (r02 §6): PageHeader root / home / detail / overflow / mobile sticky, Breadcrumbs 2 and 3 levels ×
// md / sm, PageLayout full and with a toolbar. Static fixtures; the back arrow is a no-op here.
import CatalogueSection from "../CatalogueSection.vue";
import CatalogueCell from "../CatalogueCell.vue";

const noop = () => {};
const CRUMBS = [{ label: "Pages", to: "/pages/content" }, { label: "Lista treści", to: "/pages/content" }, { label: "Product Showcase" }];
const LONG_TITLE = "Letnia wyprzedaż kolekcji outdoorowej 2026 — strona kampanii dla wszystkich kanałów sprzedaży";
const ACTIONS = [
  { key: "publish", label: "Zapisz i publikuj", role: "primary", icon: "publish", onClick: noop },
  { key: "draft", label: "Zapisz szkic", role: "secondary", icon: "saveDraft", onClick: noop },
  { key: "settings", label: "Ustawienia", role: "utility", icon: "settings", onClick: noop },
  { key: "duplicate", label: "Duplikuj", role: "utility", icon: "duplicate", onClick: noop },
];
const LEVELS = { 2: CRUMBS.slice(1), 3: CRUMBS };
const crumbCells = ["md", "sm"].flatMap((size) =>
  Object.entries(LEVELS).map(([levels, items]) => ({
    id: `breadcrumbs-${levels}-levels-${size}`,
    label: `${levels} levels, ${size === "md" ? "16 px (12 below 768 px)" : "12 px"}`,
    items,
    size,
    interact: size === "md" ? "hover,focus" : "",
  }))
);
</script>

<style lang="scss" scoped>
.frame-grid {
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
}

.frame-grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(min(32rem, 100%), 1fr));
}

// PageLayout fills its parent and scrolls: the cell gives it a fixed box.
.layout-frame {
  height: 16rem;
}
</style>
