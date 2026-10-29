<template>
  <CatalogueSection id="overlays" :title="$t('ui_catalogue.sections.overlays')">
    <div class="flex flex-wrap gap-3 mb-8">
      <BasicButton variant="secondary" data-testid="ui-open-modal" @click="live.modal = true">Otwórz modal</BasicButton>
      <BasicButton variant="secondary" data-testid="ui-open-confirm" @click="live.confirm = true">
        Otwórz potwierdzenie
      </BasicButton>
      <BasicButton variant="secondary" data-testid="ui-open-drawer" @click="live.drawer = true">
        Otwórz panel boczny
      </BasicButton>
      <BasicButton variant="secondary" data-testid="ui-open-translations" @click="live.translations = true">
        Otwórz tłumaczenia
      </BasicButton>
      <BasicMenu :items="menuItems" label="Akcje strony">
        <template #trigger>
          <BasicButton variant="secondary" data-testid="ui-open-menu">Otwórz menu</BasicButton>
        </template>
      </BasicMenu>
    </div>

    <h3 id="basic-modal" class="fs-500 mb-4">BasicModal</h3>
    <div class="flex-column gap-3 mb-10">
      <CatalogueCell id="basic-modal-sm-open" label="sm · open" interact="focus">
        <BasicModal open inline size="sm" title="Zmień nazwę">
          <p>Nowa nazwa pojawi się na liście treści.</p>
        </BasicModal>
      </CatalogueCell>
      <CatalogueCell id="basic-modal-md-footer" label="md · footer ActionBar">
        <BasicModal open inline size="md" title="Edytuj baner" :actions="dialogActions">
          <p>Obraz, podpis i link banera w nawigacji.</p>
        </BasicModal>
      </CatalogueCell>
      <CatalogueCell id="basic-modal-lg-footer" label="lg · footer ActionBar">
        <BasicModal open inline size="lg" title="Przetłumacz wszystkie strony" :actions="dialogActions">
          <p>Szacunkowy koszt tłumaczenia 12 stron na 3 języki: 0,42 USD.</p>
        </BasicModal>
      </CatalogueCell>
    </div>

    <h3 id="confirm-dialog" class="fs-500 mb-4">ConfirmDialog</h3>
    <div class="overlays-grid grid gap-3 mb-10">
      <CatalogueCell id="confirm-dialog-default-open" label="default">
        <ConfirmDialog open inline title="Utworzyć szkic?" message="Opublikowana wersja zostanie bez zmian." />
      </CatalogueCell>
      <CatalogueCell id="confirm-dialog-danger-open" label="danger">
        <ConfirmDialog
          open
          inline
          tone="danger"
          title="Usunąć stronę?"
          message="Strona i jej wersje robocze znikną na stałe."
          confirm-label="Usuń"
        />
      </CatalogueCell>
    </div>

    <h3 id="secret-reveal" class="fs-500 mb-4">SecretReveal</h3>
    <CatalogueCell id="secret-reveal-open" label="shown once · close after the confirmation" class="mb-10">
      <SecretReveal open inline title="Nowy token" :secret="FAKE_SECRET" />
    </CatalogueCell>

    <h3 id="side-drawer" class="fs-500 mb-4">SideDrawer</h3>
    <div class="overlays-grid grid gap-3 mb-10">
      <CatalogueCell id="side-drawer-focused-open" label="focused">
        <SideDrawer visible inline width="28rem" title="Szczegóły produktu">
          <p>Panel nad stroną, fokus zamknięty w środku.</p>
        </SideDrawer>
      </CatalogueCell>
      <CatalogueCell id="side-drawer-sticky-open" label="sticky">
        <SideDrawer visible mode="sticky" width="20rem" title="Filtry">
          <p>Panel w układzie strony.</p>
        </SideDrawer>
      </CatalogueCell>
    </div>

    <h3 id="translations-drawer" class="fs-500 mb-4">TranslationsDrawer</h3>
    <CatalogueCell id="translations-drawer-default-open" label="3 languages" class="mb-10">
      <TranslationsDrawer visible inline title="Podpis" :languages="LANGUAGES" default-language="pl" :values="VALUES" />
    </CatalogueCell>

    <h3 id="basic-menu" class="fs-500 mb-4">BasicMenu</h3>
    <div class="overlays-grid grid gap-3 mb-10">
      <CatalogueCell id="basic-menu-items-open" label="icons · separator · danger · disabled" interact="hover">
        <BasicMenu inline :items="menuItems" label="Akcje strony">
          <template #trigger>
            <IconButton icon="more" label="Więcej akcji" />
          </template>
        </BasicMenu>
      </CatalogueCell>
      <CatalogueCell id="basic-menu-panel-open" label="panel">
        <BasicMenu inline label="Powiadomienia">
          <template #trigger>
            <IconButton icon="notifications" label="Powiadomienia" />
          </template>
          <template #panel>
            <p class="fs-300 fw-600 t-body mb-2">2 nowe odpowiedzi</p>
            <p class="fs-200 t-muted">Acme sp. z o.o. odpisała na ofertę.</p>
          </template>
        </BasicMenu>
      </CatalogueCell>
    </div>

    <h3 id="basic-tooltip" class="fs-500 mb-4">BasicTooltip</h3>
    <div class="overlays-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in tooltipCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <PinHints :on="true">
          <div class="tooltip-frame flex jc-ct ai-ct">
            <BasicTooltip
              :text="cell.text"
              :variant="cell.variant"
              :level="cell.level"
              :placement="cell.placement"
              :open="cell.open"
            >
              <BasicButton variant="secondary">Zapisz szkic</BasicButton>
            </BasicTooltip>
          </div>
        </PinHints>
      </CatalogueCell>
    </div>

    <BasicModal v-model:open="live.modal" title="Edytuj baner" :actions="liveActions">
      <p>Prawdziwy modal: Tab krąży w środku, Esc zamyka i oddaje fokus.</p>
    </BasicModal>
    <ConfirmDialog
      v-model:open="live.confirm"
      tone="danger"
      title="Usunąć stronę?"
      message="Strona i jej wersje robocze znikną na stałe."
      confirm-label="Usuń"
      @confirm="live.confirm = false"
    />
    <SideDrawer :visible="live.drawer" title="Szczegóły produktu" width="28rem" @close="live.drawer = false">
      <p>Prawdziwy panel boczny.</p>
    </SideDrawer>
    <TranslationsDrawer
      :visible="live.translations"
      title="Podpis"
      :languages="LANGUAGES"
      default-language="pl"
      :values="VALUES"
      @cancel="live.translations = false"
      @save="live.translations = false"
    />
  </CatalogueSection>
</template>

<script setup>
// Plan 12: every overlay from static fixtures (r02 §6), SecretReveal (access plan 22) included. The open state is drawn `inline` (in the page flow, no
// Teleport, no trap), tooltips are forced `open`; the buttons at the top open the real overlays.
import { reactive } from "vue";
import CatalogueSection from "../CatalogueSection.vue";
import PinHints from "../PinHints.vue";
import CatalogueCell from "../CatalogueCell.vue";

const LANGUAGES = ["pl", "en", "de"];
const VALUES = { pl: "Nowa kolekcja", en: "New collection", de: "Neue Kollektion" };
const noop = () => {};
// SecretReveal (access plan 22): a fake shorter than a real token, so no capture holds a token-shaped string.
const FAKE_SECRET = "ent_api_EXAMPLE-not-a-token";

const live = reactive({ modal: false, confirm: false, drawer: false, translations: false });
const close = () => (live.modal = false);

const dialogActions = [
  { key: "cancel", label: "Anuluj", role: "secondary", onClick: noop },
  { key: "save", label: "Zapisz", role: "primary", onClick: noop },
];
const liveActions = [
  { key: "cancel", label: "Anuluj", role: "secondary", onClick: close },
  { key: "save", label: "Zapisz", role: "primary", onClick: close },
];

const menuItems = [
  { key: "edit", label: "Edytuj", icon: "edit" },
  { key: "duplicate", label: "Duplikuj", icon: "duplicate" },
  { key: "preview", label: "Podgląd", icon: "preview", disabled: true },
  { key: "separator", separator: true },
  { key: "delete", label: "Usuń stronę", icon: "delete", danger: true },
];

// `help-important` is the help variant at the important level (plan 60): the filled field-hint mark.
const tooltipCells = ["default", "help", "help-important"].flatMap((name) =>
  ["top", "bottom"].map((placement) => ({
    id: `basic-tooltip-${name}-${placement}`,
    label: `${name} · ${placement} · shown`,
    interact: "",
    open: true,
    variant: name === "default" ? "default" : "help",
    level: name === "help-important" ? "important" : "subtle",
    placement,
    text: name === "default" ? "Zapisz bez publikowania" : "Wersja robocza nie jest widoczna w sklepie.",
  }))
);
tooltipCells.push({
  id: "basic-tooltip-default-hover",
  label: "default · hover / focus",
  interact: "hover,focus",
  open: false,
  variant: "default",
  level: "subtle",
  placement: "top",
  text: "Zapisz bez publikowania",
});
</script>

<style lang="scss" scoped>
.overlays-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(24rem, 100%), 1fr));
}

// Room for the forced-open tooltip above or below its trigger, inside the cell's screenshot.
.tooltip-frame {
  min-height: 8rem;
}
</style>
