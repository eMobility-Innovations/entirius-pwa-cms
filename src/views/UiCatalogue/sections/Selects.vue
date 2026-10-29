<template>
  <CatalogueSection id="selects" :title="$t('ui_catalogue.sections.selects')">
    <h3 id="basic-select" class="fs-500 mb-4">BasicSelect</h3>
    <div class="selects-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in selectCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <div class="select-frame">
          <component :is="cell.invalid ? FieldStub : 'div'">
            <BasicSelect
              v-model="models[cell.id]"
              :options="cell.options"
              :multiple="cell.multiple"
              :searchable="cell.searchable"
              :disabled="cell.disabled"
              :inline="cell.open"
              :placement="cell.up ? 'top-start' : 'bottom-start'"
              placeholder="Wybierz język"
              :aria-label="cell.invalid ? undefined : 'Język treści'"
            />
          </component>
        </div>
      </CatalogueCell>
      <CatalogueCell v-for="cell in floatingCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <div class="select-frame">
          <BasicSelect v-model="floating[cell.id]" :options="LANGUAGES" :multiple="cell.multiple" floating-label="Język" />
        </div>
      </CatalogueCell>
    </div>

    <h3 id="entity-search-picker" class="fs-500 mb-4">EntitySearchPicker</h3>
    <div class="selects-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in pickerCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <div class="select-frame">
          <EntitySearchPicker
            v-model="pickers[cell.id].value"
            v-model:display-value="pickers[cell.id].label"
            :fetch-fn="cell.fetchFn"
            :disabled="cell.disabled"
            :inline="cell.open"
            placeholder="Szukaj produktu"
            aria-label="Produkt"
          />
        </div>
      </CatalogueCell>
    </div>

    <h3 id="channel-multi-select" class="fs-500 mb-4">ChannelMultiSelect</h3>
    <div class="selects-grid grid gap-3 mb-10">
      <CatalogueCell
        v-for="cell in channelCells"
        :id="cell.id"
        :key="cell.id"
        :label="cell.label"
        :interact="cell.interact"
      >
        <div class="select-frame">
          <ChannelMultiSelect
            v-model="channels[cell.id]"
            :channels="CHANNELS"
            :compact="cell.compact"
            :inline="cell.open"
            label="Kanały"
            all-label="Wszystkie"
          />
        </div>
      </CatalogueCell>
      <CatalogueCell v-for="cell in channelFloatingCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <div class="select-frame">
          <ChannelMultiSelect
            v-model="channels[cell.id]"
            :channels="CHANNELS"
            label="Kanały"
            all-label="Wszystkie"
            floating-label="Kanał sklepu"
          />
        </div>
      </CatalogueCell>
    </div>
  </CatalogueSection>
</template>

<script setup>
// Plan 15: the select family from static fixtures (r02 §6). The open state is BasicMenu `inline` (in the page flow),
// drop-up is its `top` placement; the invalid cell sits in a FormField stand-in that provides the plan-10
// `formField.js` contract (FormField itself is plan 16's). Closed cells are live: they open the real menu.
import { defineComponent, h, provide, reactive, ref, useId } from "vue";
import CatalogueSection from "../CatalogueSection.vue";
import CatalogueCell from "../CatalogueCell.vue";
import BasicSelect from "@/boots/BasicSelect/index.vue";
import EntitySearchPicker from "@/boots/EntitySearchPicker/index.vue";
import ChannelMultiSelect from "@/boots/ChannelMultiSelect/index.vue";
import { FORM_FIELD } from "@/composables/formField";

const LANGUAGES = [
  { label: "Polski", value: "pl" },
  { label: "English", value: "en" },
  { label: "Deutsch", value: "de" },
  { label: "Čeština", value: "cs", disabled: true },
  { label: "Slovenčina — język sklepu w Bratysławie i w całym regionie", value: "sk" },
];
const DESCRIBED = LANGUAGES.map((option, i) => ({
  ...option,
  description: ["Język domyślny", "Wersja międzynarodowa", "Rynek DACH", "Brak tłumaczeń", "Nowy rynek"][i],
}));
const VARIANTS = [
  { key: "single", options: LANGUAGES, filled: "pl" },
  { key: "multiple", options: LANGUAGES, multiple: true, filled: ["pl", "en", "de"] },
  { key: "searchable", options: LANGUAGES, searchable: true, filled: "en" },
  { key: "descriptions", options: DESCRIBED, filled: "de" },
];
const STATES = [
  { key: "closed-empty", interact: "focus" },
  { key: "closed-filled", filled: true },
  { key: "open", open: true, filled: true, interact: "hover" },
  { key: "disabled", disabled: true, filled: true },
  { key: "invalid", invalid: true },
  { key: "drop-up", open: true, up: true, filled: true },
];
const empty = (variant) => (variant.multiple ? [] : null);

const selectCells = VARIANTS.flatMap((variant) =>
  STATES.map((state) => ({
    ...variant,
    ...state,
    id: `basic-select-${variant.key}-${state.key}`,
    label: `${variant.key} · ${state.key.replace("-", " ")}`,
    value: state.filled ? variant.filled : empty(variant),
  }))
);
const models = reactive(Object.fromEntries(selectCells.map((cell) => [cell.id, cell.value])));
// Plan 53: a select without a FormField label keeps its name as a floating label.
const floatingCells = [
  { id: "basic-select-floating-empty", label: "floating label · empty", value: null },
  { id: "basic-select-floating-chosen", label: "floating label · chosen", value: "pl" },
  { id: "basic-select-floating-multiple", label: "floating label · 2 chosen", value: ["pl", "en"], multiple: true },
];
const floating = reactive(Object.fromEntries(floatingCells.map((cell) => [cell.id, cell.value])));

const PRODUCTS = [
  { label: "Skarpety trekkingowe merino", value: "sku-101", secondary: "SKU-101 · 3 warianty" },
  { label: "Skarpety do biegania", value: "sku-102", secondary: "SKU-102" },
  { label: "Buty trekkingowe", value: "sku-201", secondary: "SKU-201" },
];
const found = async () => PRODUCTS;
const nothing = async () => [];
const pickerCells = [
  { id: "entity-search-picker-default-empty", label: "empty", fetchFn: found, interact: "focus" },
  { id: "entity-search-picker-default-selected", label: "selected (Tag)", fetchFn: found, selected: true },
  { id: "entity-search-picker-default-open", label: "open · results", fetchFn: found, open: true, interact: "hover" },
  { id: "entity-search-picker-default-open-empty", label: "open · no results", fetchFn: nothing, open: true },
  {
    id: "entity-search-picker-default-disabled",
    label: "disabled (manual entry until the sweeps)",
    fetchFn: found,
    selected: true,
    disabled: true,
  },
];
const pickers = reactive(
  Object.fromEntries(
    pickerCells.map((cell) => [cell.id, cell.selected ? { value: "sku-101", label: PRODUCTS[0].label } : {}])
  )
);

const CHANNELS = [
  { idx: "default-europe", name: "Europa" },
  { idx: "pl", name: "Polska" },
  { idx: "de", name: "Niemcy" },
];
const channelCells = ["full", "compact"].flatMap((variant) =>
  [
    { key: "none", value: [], interact: "hover" },
    { key: "two", value: ["pl", "de"] },
    { key: "open", value: ["pl"], open: true },
  ].map((state) => ({
    ...state,
    id: `channel-multi-select-${variant}-${state.key}`,
    label: `${variant} · ${state.key === "two" ? "2 selected" : state.key}`,
    compact: variant === "compact",
  }))
);
const channelFloatingCells = [
  { id: "channel-multi-select-floating-none", label: "floating label · none", value: [] },
  { id: "channel-multi-select-floating-one", label: "floating label · 1 selected", value: ["pl"] },
  { id: "channel-multi-select-floating-two", label: "floating label · 2 selected", value: ["pl", "de"] },
];
const channels = reactive(
  Object.fromEntries([...channelCells, ...channelFloatingCells].map((cell) => [cell.id, cell.value]))
);

// A FormField stand-in: label, error text and the FORM_FIELD contract with `invalid` and `required` on.
const FieldStub = defineComponent({
  setup(_, { slots }) {
    const id = useId();
    const errorId = `${id}-error`;
    provide(FORM_FIELD, {
      id: ref(id),
      describedBy: ref(errorId),
      invalid: ref(true),
      required: ref(true),
      disabled: ref(false),
    });
    return () =>
      h("div", { class: "flex-column gap-1" }, [
        h("label", { for: id, class: "fs-200 fw-500 t-secondary" }, "Język treści"),
        slots.default?.(),
        h("p", { id: errorId, class: "fs-200 t-negative" }, "Wybierz język treści"),
      ]);
  },
});
</script>

<style lang="scss" scoped>
.selects-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr));
}

.select-frame {
  width: 15rem;
  max-width: 100%;
}
</style>
