<template>
  <CatalogueSection id="actions" :title="$t('ui_catalogue.sections.actions')">
    <h3 id="basic-button" class="fs-500 mb-4">BasicButton</h3>
    <div class="actions-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in buttonCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <div class="flex">
          <BasicButton
            :variant="cell.variant"
            :size="cell.size"
            :icon="cell.icon"
            :disabled="cell.state === 'disabled'"
            :loading="cell.state === 'loading'"
          >
            {{ cell.text }}
          </BasicButton>
        </div>
      </CatalogueCell>
    </div>

    <h3 id="icon-button" class="fs-500 mb-4">IconButton</h3>
    <div class="actions-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in iconCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <div class="flex">
          <IconButton
            :icon="cell.icon"
            :label="cell.text"
            :variant="cell.variant"
            :size="cell.size"
            :disabled="cell.state === 'disabled'"
            :pressed="cell.state === 'pressed' || undefined"
          />
        </div>
      </CatalogueCell>
    </div>

    <h3 id="action-bar" class="fs-500 mb-4">ActionBar</h3>
    <div class="flex-column gap-3 mb-10">
      <CatalogueCell id="action-bar-desktop-default" label="utilities · secondary · primary (R5)">
        <ActionBar :actions="pageActions" />
      </CatalogueCell>
      <CatalogueCell id="action-bar-mobile-default" label="own row with „Akcje” below 768 px" mobile>
        <ActionBar :actions="pageActions" />
      </CatalogueCell>
      <CatalogueCell id="action-bar-single-default" label="one action">
        <ActionBar :actions="[saveAction]" />
      </CatalogueCell>
      <CatalogueCell id="action-bar-overflow-default" label="6 actions wrap, primary stays last">
        <ActionBar :actions="manyActions" />
      </CatalogueCell>
      <CatalogueCell id="action-bar-danger-utility-default" label="danger icon utility · secondary · primary">
        <ActionBar :actions="dangerUtilityActions" />
      </CatalogueCell>
    </div>

    <h3 id="floating-actions" class="fs-500 mb-4">FloatingActions</h3>
    <div class="actions-grid actions-grid--wide grid gap-3 mb-10">
      <CatalogueCell id="floating-actions-fab-default" label="FAB" interact="hover,focus">
        <div class="fab-frame"><FloatingActions :actions="fabActions" /></div>
      </CatalogueCell>
      <CatalogueCell id="floating-actions-fab-open" label="FAB open, 3 actions">
        <div class="fab-frame"><FloatingActions :actions="fabActions" open /></div>
      </CatalogueCell>
      <CatalogueCell id="floating-actions-pill-default" label="FAB + labelled pill (R7)" interact="hover,focus">
        <div class="fab-frame"><FloatingActions :actions="fabActions" :pill="reorderPill" /></div>
      </CatalogueCell>
    </div>

    <h3 id="bulk-action-bar" class="fs-500 mb-4">BulkActionBar</h3>
    <CatalogueCell id="bulk-action-bar-default" label="3 selected, 2 actions + dropdown action">
      <div class="bulk-frame">
        <BulkActionBar
          :count="3"
          :actions="bulkActions"
          selected-label-key="pim.products_selected"
          clear-label-key="pim.clear_selection"
        />
      </div>
    </CatalogueCell>

    <h3 id="readonly-mode" class="fs-500 mb-4 mt-10">Read-only mode</h3>
    <div class="actions-grid actions-grid--wide grid gap-3">
      <CatalogueCell id="readonly-mode-off" label="writable page: every action, FAB, enabled field">
        <ReadonlyDemo />
      </CatalogueCell>
      <CatalogueCell id="readonly-mode-on" label="read-only page: utility only, no FAB, disabled field">
        <ReadonlyDemo initial />
      </CatalogueCell>
    </div>
  </CatalogueSection>
</template>

<script setup>
// Plan 11: every action component from static fixtures (r02 §6). Buttons: 5 variants × md/sm × text/icon+text ×
// default/disabled/loading; icon buttons: 4 variants × 3 sizes × default/disabled/pressed. The FAB cells sit in a
// transformed frame, which holds their `position: fixed` inside the cell.
import CatalogueSection from "../CatalogueSection.vue";
import CatalogueCell from "../CatalogueCell.vue";
import ReadonlyDemo from "../ReadonlyDemo.vue";

const BUTTONS = {
  primary: { text: "Zapisz i publikuj", icon: "publish" },
  secondary: { text: "Zapisz szkic", icon: "saveDraft" },
  ghost: { text: "Edytuj", icon: "edit" },
  danger: { text: "Usuń", icon: "delete" },
  "danger-solid": { text: "Usuń trwale", icon: "delete" },
};
const ICON_BUTTONS = {
  ghost: { icon: "close", text: "Zamknij" },
  outline: { icon: "settings", text: "Ustawienia" },
  primary: { icon: "add", text: "Dodaj" },
  danger: { icon: "delete", text: "Usuń" },
};
const STATES = ["default", "disabled", "loading"];
const ICON_STATES = ["default", "disabled", "pressed"];
const noop = () => {};

const generatedButtonCells = Object.entries(BUTTONS).flatMap(([variant, { text, icon }]) =>
  ["md", "sm"].flatMap((size) =>
    [false, true].flatMap((withIcon) =>
      STATES.map((state) => ({
        id: `basic-button-${variant}-${size}-${withIcon ? "icon" : "text"}-${state}`,
        label: `${variant} · ${size} · ${withIcon ? "icon + text" : "text"} · ${state}`,
        interact: state === "default" ? "hover,focus" : "",
        variant,
        size,
        text,
        icon: withIcon ? icon : undefined,
        state,
      }))
    )
  )
);

// `size="lg"` (40 px) is for the sign-in screens only (AuthLayout): one primary cell shows it and its hover light. Its
// text is not „Zaloguj”: the visual harness reads a button with it as the login wall.
const buttonCells = [
  ...generatedButtonCells,
  {
    id: "basic-button-primary-lg-text-default",
    label: "primary · lg (sign-in) · text · default",
    interact: "hover,focus",
    variant: "primary",
    size: "lg",
    text: "Ustaw hasło",
    state: "default",
  },
];

const iconCells = Object.entries(ICON_BUTTONS).flatMap(([variant, { icon, text }]) =>
  ["sm", "md", "lg"].flatMap((size) =>
    ICON_STATES.map((state) => ({
      id: `icon-button-${variant}-${size}-${state}`,
      label: `${variant} · ${size} · ${state}`,
      interact: state === "default" ? "hover,focus" : "",
      variant,
      size,
      icon,
      text,
      state,
    }))
  )
);

const saveAction = { key: "publish", label: "Zapisz i publikuj", role: "primary", icon: "publish", onClick: noop };
const pageActions = [
  saveAction,
  { key: "draft", label: "Zapisz szkic", role: "secondary", icon: "saveDraft", onClick: noop },
  { key: "settings", label: "Ustawienia", role: "utility", icon: "settings", onClick: noop },
  { key: "duplicate", label: "Duplikuj", role: "utility", icon: "duplicate", onClick: noop },
];
const manyActions = [
  ...pageActions,
  { key: "preview", label: "Podgląd", role: "utility", icon: "preview", onClick: noop },
  { key: "delete", label: "Usuń stronę", role: "danger", onClick: noop },
];
const dangerUtilityActions = [
  saveAction,
  { key: "draft", label: "Zapisz szkic", role: "secondary", icon: "saveDraft", onClick: noop },
  { key: "delete", label: "Usuń stronę", role: "utility", icon: "delete", variant: "danger", onClick: noop },
];

const fabActions = [
  { icon: "add", label: "Dodaj stronę", handler: noop },
  { icon: "importCsv", label: "Importuj CSV", handler: noop },
  { icon: "duplicate", label: "Duplikuj", handler: noop, variant: "secondary" },
];
const reorderPill = { icon: "reorder", label: "Zarządzaj kolejnością", handler: noop };

const bulkActions = [
  { key: "enable", labelKey: "pim.enable_all", variant: "primary" },
  { key: "disable", labelKey: "pim.disable_all", variant: "danger" },
  {
    key: "visibility",
    labelKey: "pim.change_visibility",
    options: [
      { label: "Katalog i wyszukiwarka", value: 4 },
      { label: "Niewidoczny", value: 1 },
    ],
  },
];
</script>

<style lang="scss" scoped>
.actions-grid {
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
}

.actions-grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
}

// `transform` makes the frame the containing block of the FAB's `position: fixed`.
.fab-frame {
  position: relative;
  height: 20rem;
  transform: translateZ(0);
}

.bulk-frame {
  overflow-x: auto;
}
</style>
