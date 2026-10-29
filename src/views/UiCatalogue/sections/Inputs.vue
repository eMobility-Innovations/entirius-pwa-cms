<template>
  <CatalogueSection id="inputs" :title="$t('ui_catalogue.sections.inputs')">
    <h3 id="form-field" class="fs-500 mb-4">FormField</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in fieldCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <PinHints :on="cell.hints">
          <FormField v-bind="cell.field">
            <BasicInput v-model="values[cell.id]" placeholder="Wpisz nazwę" />
          </FormField>
        </PinHints>
      </CatalogueCell>
      <CatalogueCell id="form-field-overflow-default" label="long label wraps above the control">
        <FormField :label="LONG_LABEL" required>
          <BasicInput v-model="values.overflow" />
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="basic-input" class="fs-500 mb-4">BasicInput</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in inputCells" :id="cell.id" :key="cell.id" :label="cell.label" interact="focus">
        <FormField label="Nazwa produktu" :error="cell.error" :disabled="cell.disabled">
          <BasicInput v-model="values[cell.id]" v-bind="cell.input" />
        </FormField>
      </CatalogueCell>
    </div>

    <h3 class="fs-500 mb-4">BasicInput size="lg" (sign-in screens)</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell id="basic-input-lg-trailing-filled" label="lg, a trailing reveal control, filled" interact="focus">
        <FormField label="Hasło">
          <BasicInput v-model="values['basic-input-lg-trailing-filled']" size="lg" type="password">
            <template #trailing>
              <IconButton icon="preview" label="Pokaż hasło" />
            </template>
          </BasicInput>
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="basic-textarea" class="fs-500 mb-4">BasicTextarea</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in textareaCells" :id="cell.id" :key="cell.id" :label="cell.label" interact="focus">
        <FormField label="Opis" :error="cell.error" :disabled="cell.disabled">
          <BasicTextarea v-model="values[cell.id]" :rows="3" :maxlength="cell.maxlength" placeholder="Krótki opis" />
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="number-input" class="fs-500 mb-4">NumberInput</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in numberCells" :id="cell.id" :key="cell.id" :label="cell.label" interact="focus">
        <FormField label="Ilość" :disabled="cell.disabled">
          <NumberInput v-model="values[cell.id]" :min="0" :max="10" :suffix="cell.suffix" />
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="basic-checkbox" class="fs-500 mb-4">BasicCheckbox</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in checkboxCells" :id="cell.id" :key="cell.id" :label="cell.label" interact="focus">
        <FormField :error="cell.error">
          <BasicCheckbox v-model="values[cell.id]" :disabled="cell.disabled">Pokaż w menu</BasicCheckbox>
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="basic-radio-group" class="fs-500 mb-4">BasicRadioGroup</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in radioCells" :id="cell.id" :key="cell.id" :label="cell.label" interact="focus">
        <FormField label="Widoczność">
          <BasicRadioGroup v-model="values[cell.id]" :options="VISIBILITY" :disabled="cell.disabled" />
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="basic-switch" class="fs-500 mb-4">BasicSwitch</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in switchCells" :id="cell.id" :key="cell.id" :label="cell.label" interact="focus">
        <PinHints :on="true">
          <div class="flex">
            <BasicSwitch
              v-model="values[cell.id]"
              label="Aktywny"
              :hint="cell.hint"
              :hint-level="cell.hintLevel"
              :disabled="cell.disabled"
            />
          </div>
        </PinHints>
      </CatalogueCell>
    </div>

    <h3 id="segmented-control" class="fs-500 mb-4">SegmentedControl</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in segmentedCells" :id="cell.id" :key="cell.id" :label="cell.label" interact="hover">
        <SegmentedControl v-model="values[cell.id]" :options="cell.options" :disabled="cell.disabled" />
      </CatalogueCell>
    </div>

    <h3 id="basic-date-picker" class="fs-500 mb-4">BasicDatePicker</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in dateCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <FormField label="Data publikacji">
          <BasicDatePicker v-model="values[cell.id]" :config="cell.config" />
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="color-input" class="fs-500 mb-4">ColorInput</h3>
    <div class="inputs-grid grid gap-3 mb-10">
      <CatalogueCell v-for="cell in colorCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <FormField label="Kolor tła">
          <ColorInput v-model="values[cell.id]" />
        </FormField>
      </CatalogueCell>
    </div>

    <h3 id="basic-wysiwyg" class="fs-500 mb-4">BasicWysiwyg</h3>
    <div class="inputs-grid inputs-grid--wide grid gap-3 mb-10">
      <CatalogueCell v-for="cell in wysiwygCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <BasicWysiwyg v-model="values[cell.id]" :variant="cell.variant" placeholder="Treść strony" />
      </CatalogueCell>
    </div>

    <h3 id="permission-matrix" class="fs-500 mb-4">PermissionMatrix</h3>
    <div class="inputs-grid inputs-grid--wide grid gap-3 mb-10">
      <CatalogueCell v-for="cell in matrixCells" :id="cell.id" :key="cell.id" :label="cell.label">
        <PermissionMatrix
          v-model="matrices[cell.id]"
          :areas="MATRIX_AREAS"
          :disabled="cell.disabled"
          :show-reserved="cell.disabled"
        />
      </CatalogueCell>
    </div>
  </CatalogueSection>
</template>

<script setup>
// Plan 16 cells (r02 §6): FormField stacked / inline / hint subtle / hint important / required × default, error, plus
// both hints with hints off; every hint cell pins the account-menu hints switch (plan 60); BasicInput
// text / icon / readonly / password and BasicTextarea default / maxlength × empty, filled, disabled, error; NumberInput
// plain / suffix × empty, at min, at max, disabled; BasicCheckbox, BasicRadioGroup, BasicSwitch, SegmentedControl,
// BasicDatePicker, ColorInput and BasicWysiwyg in their states; PermissionMatrix (access plan 20) editable and
// read-only. Static fixtures; every control keeps its own v-model.
import { reactive } from "vue";
import CatalogueSection from "../CatalogueSection.vue";
import CatalogueCell from "../CatalogueCell.vue";
import PinHints from "../PinHints.vue";

const LONG_LABEL = "Nazwa produktu widoczna w sklepie, w wynikach wyszukiwania i w kanałach marketplace";
const ERROR = "Pole jest wymagane";
const HINT = "Nazwa, którą klient widzi na karcie produktu.";
const HINT_IMPORTANT = "Najwyżej 120 znaków; nie można jej zmienić po publikacji.";
const FILLED = "Letnia kurtka outdoorowa";
const VISIBILITY = [
  { label: "Publiczna", value: "public" },
  { label: "Tylko zalogowani", value: "members" },
  { label: "Ukryta", value: "hidden" },
];
const DATE_CONFIG = { single: { mode: "single", wrap: true, inline: true }, range: { mode: "range", wrap: true, inline: true } };
// A sample of the django-access catalogue: every level shape (read+write, read only, write only), the sensitive tags
// and the reserved area a custom role never shows.
const area = (key, label, levels = ["read", "write"], sensitive = [], assignable = true) =>
  ({ key, label, levels, sensitive, assignable });
const MATRIX_AREAS = [
  { module: "django_pim", areas: [
    area("pim.products", "Produkty i media"),
    area("pim.product_delete", "Usuwanie produktów (SKU)", ["write"], ["destructive"]),
  ] },
  { module: "django_accounts", areas: [area("accounts.customers", "Klienci", ["read"], ["pii"])] },
  { module: "django_pricemanager", areas: [area("pricemanager.prices", "Ceny", ["read", "write"], ["money"])] },
  { module: "django_access", areas: [area("access.manage", "Role, nadania i tokeny", ["read", "write"], ["secret"], false)] },
];
const matrixCells = [
  { id: "permission-matrix-custom-editable", label: "custom role: editable, set all per module, no access.manage" },
  { id: "permission-matrix-builtin-disabled", label: "built-in role: read-only, access.manage shown", disabled: true },
];
const matrices = reactive({
  "permission-matrix-custom-editable": { "pim.products": "write", "accounts.customers": "read" },
  "permission-matrix-builtin-disabled": {
    "pim.products": "write", "pim.product_delete": "write", "accounts.customers": "read",
    "pricemanager.prices": "write", "access.manage": "write",
  },
});
const CONTENT = "<p>Letnia <strong>wyprzedaż</strong> kolekcji outdoorowej: kurtki, plecaki i namioty.</p>";

// Cells of `variants` × `states`, each built by `build(variant, state)`; `id` = "<component>-<variant>-<state>".
const cells = (component, variants, states, build) =>
  variants.flatMap((variant) =>
    states.map((state) => ({ id: `${component}-${variant}-${state}`, label: `${variant}, ${state}`, ...build(variant, state) }))
  );

const FIELD_VARIANTS = {
  stacked: { label: "Nazwa produktu" },
  inline: { label: "Język treści", layout: "inline" },
  "hint-subtle": { label: "Nazwa produktu", hint: HINT },
  "hint-important": { label: "Nazwa produktu", hint: HINT_IMPORTANT, hintLevel: "important" },
  required: { label: "Nazwa produktu", required: true },
};
const FIELD_STATES = { default: {}, error: { error: ERROR } };
const fieldCells = cells("form-field", Object.keys(FIELD_VARIANTS), Object.keys(FIELD_STATES), (variant, state) => ({
  field: { ...FIELD_VARIANTS[variant], ...FIELD_STATES[state] },
  hints: true,
}));

fieldCells.push(
  ...["hint-subtle", "hint-important"].map((variant) => ({
    id: `form-field-${variant}-hints-off`,
    label: `${variant}, hints off`,
    field: FIELD_VARIANTS[variant],
    hints: false,
  }))
);

const INPUT_VARIANTS = {
  text: { placeholder: "Wpisz nazwę" },
  icon: { placeholder: "Szukaj", icon: "search" },
  readonly: { readonly: true },
  password: { type: "password", placeholder: "Hasło" },
};
const TEXT_STATES = ["empty", "filled", "disabled", "error"];
const stateOf = (state) => ({ disabled: state === "disabled", error: state === "error" ? ERROR : "" });
const inputCells = cells("basic-input", Object.keys(INPUT_VARIANTS), TEXT_STATES, (variant, state) => ({
  input: INPUT_VARIANTS[variant],
  ...stateOf(state),
}));
const textareaCells = cells("basic-textarea", ["default", "maxlength"], TEXT_STATES, (variant, state) => ({
  maxlength: variant === "maxlength" ? 120 : null,
  ...stateOf(state),
}));
const numberCells = cells("number-input", ["plain", "suffix"], ["empty", "at-min", "at-max", "disabled"], (variant, state) => ({
  suffix: variant === "suffix" ? "szt." : "",
  disabled: state === "disabled",
}));
const checkboxCells = cells("basic-checkbox", ["single"], ["unchecked", "checked", "disabled", "error"], (variant, state) => ({
  disabled: state === "disabled",
  error: state === "error" ? "Zaznacz, aby kontynuować" : "",
}));
const radioCells = cells("basic-radio-group", ["3-options"], ["none", "one-selected", "disabled"], (variant, state) => ({
  disabled: state === "disabled",
}));
const switchCells = cells("basic-switch", ["label", "hint", "hint-important"], ["off", "on", "disabled"], (variant, state) => ({
  hint: variant === "label" ? "" : "Nieaktywna promocja nie trafia do koszyka.",
  hintLevel: variant === "hint-important" ? "important" : "subtle",
  disabled: state === "disabled",
}));
const SEGMENTS = {
  2: [
    { label: "Lista", value: "list" },
    { label: "Edycja", value: "edit" },
  ],
  3: [
    { label: "Dzień", value: "day" },
    { label: "Tydzień", value: "week" },
    { label: "Miesiąc", value: "month" },
  ],
};
const segmentedCells = cells("segmented-control", ["2-options", "3-options"], ["default", "disabled"], (variant, state) => ({
  options: SEGMENTS[variant[0]],
  disabled: state === "disabled",
}));
const dateCells = cells("basic-date-picker", ["single", "range"], ["empty", "set"], (variant) => ({
  config: DATE_CONFIG[variant],
}));
const colorCells = cells("color-input", ["default"], ["empty", "set"], () => ({}));
const wysiwygCells = cells("basic-wysiwyg", ["full", "lite"], ["empty", "content"], (variant) => ({ variant }));

// Initial values: a filled, set, checked or selected state starts with one; the rest start empty.
const INITIAL = {
  "basic-input-text-filled": FILLED,
  "basic-input-icon-filled": "kurtka",
  "basic-input-readonly-empty": "",
  "basic-input-readonly-filled": "SKU-2026-0042",
  "basic-input-readonly-disabled": "SKU-2026-0042",
  "basic-input-readonly-error": "SKU-2026-0042",
  "basic-input-password-filled": "tajne-haslo",
  "basic-input-lg-trailing-filled": "tajne-haslo",
  "basic-textarea-default-filled": FILLED,
  "basic-textarea-maxlength-filled": FILLED,
  "number-input-plain-at-min": "0",
  "number-input-plain-at-max": "10",
  "number-input-plain-disabled": "3",
  "number-input-suffix-at-min": "0",
  "number-input-suffix-at-max": "10",
  "number-input-suffix-disabled": "3",
  "basic-checkbox-single-checked": true,
  "basic-radio-group-3-options-one-selected": "members",
  "basic-radio-group-3-options-disabled": "public",
  "basic-switch-label-on": true,
  "basic-switch-hint-on": true,
  "segmented-control-2-options-default": "list",
  "segmented-control-2-options-disabled": "edit",
  "segmented-control-3-options-default": "week",
  "segmented-control-3-options-disabled": "day",
  "basic-date-picker-single-set": "2026-09-01",
  "basic-date-picker-range-set": "2026-09-01 do 2026-09-14",
  "color-input-default-set": "#0089B7",
  "basic-wysiwyg-full-content": CONTENT,
  "basic-wysiwyg-lite-content": CONTENT,
};
const values = reactive({ overflow: "", ...INITIAL });
</script>

<style lang="scss" scoped>
.inputs-grid {
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
}

.inputs-grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 32rem), 1fr));
}
</style>
