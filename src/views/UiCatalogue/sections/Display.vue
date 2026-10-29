<template>
  <CatalogueSection id="display" :title="$t('ui_catalogue.sections.display')">
    <h3 id="status-badge" class="fs-500 mb-4">StatusBadge</h3>
    <div class="display-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in badgeCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <div class="flex">
          <StatusBadge :label="TONES[cell.tone]" :tone="cell.tone" :size="cell.size" :dot="cell.dot" />
        </div>
      </CatalogueCell>
      <CatalogueCell id="status-badge-overflow-default" label="long label in a 120 px cell: ellipsis + title">
        <div class="narrow-frame flex">
          <StatusBadge label="Oczekuje na akceptację administratora" tone="warning" />
        </div>
      </CatalogueCell>
    </div>

    <h3 id="count-badge" class="fs-500 mb-4">CountBadge</h3>
    <div class="display-grid grid gap-3 mb-10">
      <CatalogueCell v-for="count in COUNTS" :id="`count-badge-${count}-default`" :key="count" :label="`${count}`">
        <div class="flex"><CountBadge :count="count" /></div>
      </CatalogueCell>
    </div>

    <h3 id="tag" class="fs-500 mb-4">Tag</h3>
    <div class="display-grid grid gap-3 mb-10">
      <CatalogueCell id="tag-plain-default" label="plain">
        <div class="flex"><Tag label="lato-2026" /></div>
      </CatalogueCell>
      <CatalogueCell id="tag-removable-default" label="removable" interact="hover">
        <div class="flex"><Tag label="lato-2026" removable /></div>
      </CatalogueCell>
      <CatalogueCell id="tag-link-default" label="link (to)">
        <div class="flex"><Tag label="lato-2026" to="/ui#tag" removable /></div>
      </CatalogueCell>
    </div>

    <h3 id="basic-tabs" class="fs-500 mb-4">BasicTabs</h3>
    <div class="display-grid display-grid--wide grid gap-3 mb-10">
      <CatalogueCell
        v-for="(tab, i) in TABS"
        :id="`basic-tabs-counts-${tab.value}`"
        :key="tab.value"
        :label="`3 tabs with counts, „${tab.label}” active`"
        :interact="i === 0 ? 'hover,focus' : ''"
      >
        <BasicTabs :options="TABS" :model-value="tab.value" />
      </CatalogueCell>
    </div>

    <h3 id="basic-card" class="fs-500 mb-4">BasicCard</h3>
    <div class="display-grid display-grid--wide grid gap-3 mb-10">
      <CatalogueCell id="basic-card-actions-default" label="title + actions (ActionBar)">
        <BasicCard title="Dane podstawowe" gap>
          <template #actions><ActionBar :actions="cardActions" /></template>
          <p class="fs-300">Nazwa, adres URL i kanały strony.</p>
        </BasicCard>
      </CatalogueCell>
      <CatalogueCell id="basic-card-plain-default" label="plain">
        <BasicCard><p class="fs-300">Nazwa, adres URL i kanały strony.</p></BasicCard>
      </CatalogueCell>
    </div>

    <h3 id="panel-card" class="fs-500 mb-4">PanelCard</h3>
    <div class="display-grid display-grid--wide grid gap-3 mb-10">
      <CatalogueCell id="panel-card-default-default" label="default" interact="hover,focus">
        <PanelCard icon="file-code" title="Strony" description="Treści, podstrony i nawigacja sklepu." />
      </CatalogueCell>
      <CatalogueCell id="panel-card-default-locked" label="locked">
        <PanelCard icon="boxes-stacked" title="Magazyn" locked locked-text="Skontaktuj się z administratorem" />
      </CatalogueCell>
      <CatalogueCell id="panel-card-long-default" label="long description" interact="hover,focus">
        <PanelCard
          icon="tags"
          title="Promocje i kupony rabatowe"
          description="Kampanie, kody rabatowe, progi koszyka i modyfikatory cen dla wszystkich kanałów sprzedaży."
        />
      </CatalogueCell>
    </div>

    <h3 id="media-tile" class="fs-500 mb-4">MediaTile</h3>
    <div class="flex flex-wrap gap-3 mb-10">
      <CatalogueCell
        v-for="tile in TILES"
        :id="`media-tile-${tile.variant}-${tile.state}`"
        :key="tile.variant + tile.state"
        :label="`${tile.variant} · ${tile.state}`"
        :interact="tile.state === 'default' ? 'hover' : ''"
      >
        <MediaTile :src="tile.image ? logo : ''" alt="" caption="baner-lato.jpg" :selected="tile.state === 'selected'">
          <template #actions>
            <IconButton icon="edit" label="Edytuj" size="sm" />
            <IconButton icon="delete" label="Usuń" size="sm" variant="danger" />
          </template>
        </MediaTile>
      </CatalogueCell>
      <CatalogueCell id="media-tile-video-default" label="video">
        <MediaTile :src="logo" alt="" caption="film-lato.mp4" video />
      </CatalogueCell>
    </div>

    <h3 id="empty-state" class="fs-500 mb-4">EmptyState</h3>
    <div class="mb-10">
      <CatalogueCell id="empty-state-default-default" label="icon + title + message + action">
        <EmptyState icon="search" title="Brak treści" message="Żadna treść nie pasuje do filtra „Szkice”.">
          <BasicButton variant="primary">Dodaj treść</BasicButton>
        </EmptyState>
      </CatalogueCell>
    </div>

    <h3 id="loader" class="fs-500 mb-4">Loader</h3>
    <div class="display-grid display-grid--wide grid gap-3 mb-10">
      <CatalogueCell v-for="size in [32, 64]" :id="`loader-${size}-default`" :key="size" :label="`inline ${size}`">
        <div class="flex"><Loader :size="size" /></div>
      </CatalogueCell>
      <CatalogueCell id="loader-overlay-default" label="overlay (contained preview)">
        <div class="overlay-frame"><Loader overlay contained /></div>
      </CatalogueCell>
    </div>

    <h3 id="pagination" class="fs-500 mb-4">Pagination</h3>
    <div class="display-grid display-grid--wide grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in pageCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <Pagination :page="cell.page" :pages="cell.pages" :disabled="cell.disabled" />
      </CatalogueCell>
    </div>

    <h3 id="filter-chip" class="fs-500 mb-4">FilterChip</h3>
    <div class="display-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in chipCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.active ? '' : 'hover,focus'"
      >
        <div class="flex"><FilterChip label="Szkice" :count="cell.count" :active="cell.active" /></div>
      </CatalogueCell>
    </div>

    <h3 id="mobile-filter-panel" class="fs-500 mb-4">MobileFilterPanel</h3>
    <div class="mb-10">
      <CatalogueCell id="mobile-filter-panel-count-default" label="trigger with count below 768 px, the chips inline above">
        <MobileFilterPanel :active-count="2" trigger-label="Filtry">
          <FilterChip label="Wszystkie" />
          <FilterChip label="Szkice" :count="12" active />
        </MobileFilterPanel>
      </CatalogueCell>
    </div>

    <h3 id="data-table" class="fs-500 mb-4">DataTable</h3>
    <div class="flex-column gap-3">
      <CatalogueCell v-for="table in TABLES" :id="`data-table-${table.variant}-default`" :key="table.variant" :label="table.variant">
        <DataTable :columns="COLUMNS" :rows="table.rows" v-bind="table.props" row-key="id" empty-text="Brak treści">
          <template #cell-status="{ row }">
            <StatusBadge :label="row.status" :tone="row.status === 'Opublikowany' ? 'positive' : 'neutral'" />
          </template>
          <template #expand="{ row }">
            <p class="fs-200 t-muted p-3">Ostatnia zmiana: {{ row.updated }}</p>
          </template>
        </DataTable>
      </CatalogueCell>
    </div>
  </CatalogueSection>
</template>

<script setup>
// Plan 13: every display component from static fixtures (r02 §6). StatusBadge 6 tones × dot on/off × sm/md; tabs,
// cards, tiles, loaders and pagers per state; DataTable (C4, structure frozen) plain/sortable/selectable/expandable/
// empty. The media tile image is bundled, never fetched.
import CatalogueSection from "../CatalogueSection.vue";
import CatalogueCell from "../CatalogueCell.vue";
import logo from "@/assets/logo.png";

const TONES = {
  positive: "Opublikowany",
  negative: "Błąd",
  warning: "Niezapisane",
  info: "Zaplanowany",
  neutral: "Szkic",
  accent: "PL",
};
const COUNTS = [1, 12, 999, 1200];
const TABS = [
  { label: "Opis", value: "desc" },
  { label: "Warianty", value: "variants", count: 3 },
  { label: "Media", value: "media", count: 128 },
];
const TILES = [
  { variant: "image", state: "default", image: true },
  { variant: "placeholder", state: "default", image: false },
  { variant: "image", state: "selected", image: true },
];
const noop = () => {};

const badgeCells = Object.keys(TONES).flatMap((tone) =>
  ["md", "sm"].flatMap((size) =>
    [true, false].map((dot) => ({
      id: `status-badge-${tone}-${size}-${dot ? "dot" : "plain"}`,
      label: `${tone} · ${size} · ${dot ? "dot" : "no dot"}`,
      tone,
      size,
      dot,
    }))
  )
);

const PAGE_POSITIONS = { first: () => 1, middle: (pages) => Math.ceil(pages / 2), last: (pages) => pages };
const pageCells = [1, 5, 40].flatMap((pages) =>
  Object.entries(PAGE_POSITIONS)
    .filter(([position]) => pages > 1 || position === "first")
    .map(([position, pageOf]) => ({
      id: `pagination-${pages}-${position}`,
      label: `${pages} ${pages === 1 ? "page (renders nothing)" : "pages"} · ${position}`,
      interact: pages === 5 && position === "middle" ? "hover,focus" : "",
      page: pageOf(pages),
      pages,
    }))
).concat({ id: "pagination-5-disabled", label: "5 pages · disabled (loading)", interact: "", page: 3, pages: 5, disabled: true });

const chipCells = [null, 12].flatMap((count) =>
  [false, true].map((active) => ({
    id: `filter-chip-${count === null ? "plain" : "count"}-${active ? "active" : "inactive"}`,
    label: `${count === null ? "plain" : "with count"} · ${active ? "active" : "inactive"}`,
    count,
    active,
  }))
);

const cardActions = [
  { key: "save", label: "Zapisz", role: "primary", onClick: noop },
  { key: "settings", label: "Ustawienia", role: "utility", icon: "settings", onClick: noop },
];

const COLUMNS = [
  { key: "name", label: "Nazwa", sortable: true },
  { key: "status", label: "Status", width: "max-content" },
  { key: "updated", label: "Zmieniono", priority: 2 },
];
const ROWS = [
  { id: 1, name: "Strona główna", status: "Opublikowany", updated: "12.09.2026" },
  { id: 2, name: "Regulamin sklepu", status: "Szkic", updated: "10.09.2026" },
  { id: 3, name: "Kontakt", status: "Opublikowany", updated: "02.09.2026" },
];
const TABLES = [
  { variant: "plain", rows: ROWS, props: {} },
  { variant: "sortable", rows: ROWS, props: { sortable: true } },
  { variant: "selectable", rows: ROWS, props: { selectable: true, multiSelect: true } },
  { variant: "expandable", rows: ROWS, props: { expandable: true } },
  { variant: "empty", rows: [], props: {} },
];
</script>

<style lang="scss" scoped>
.display-grid {
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
}

.display-grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
}

.narrow-frame {
  width: 120px;
}

// The contained overlay covers this frame instead of the page.
.overlay-frame {
  position: relative;
  height: 8rem;
}
</style>
