<template>
  <div
    class="basic-select relative"
    :class="{ 'basic-select--clearable': showClear, 'basic-select--floating': floatingLabel }"
    v-bind="rootAttrs"
  >
    <span v-if="floatingLabel && selectedOptions.length" class="basic-select__floating" aria-hidden="true">
      {{ floatingLabel }}
    </span>
    <BasicMenu
      ref="menu"
      class="basic-select__menu"
      :label="menuLabel"
      :labelledby="menuLabelledby"
      :placement="placement"
      :inline="inline"
      @open="onOpen"
    >
      <template #trigger>
        <button
          :id="field.id.value"
          ref="control"
          type="button"
          role="combobox"
          class="basic-select__control flex ai-ct gap-2"
          :class="{ 'basic-select__control--empty': !selectedOptions.length }"
          :disabled="isDisabled"
          :aria-invalid="field.invalid.value ? 'true' : undefined"
          :aria-required="field.required.value ? 'true' : undefined"
          v-bind="controlAttrs"
          :aria-describedby="joinIds(field.describedBy.value, attrs['aria-describedby'])"
        >
          <span class="basic-select__value">{{ display }}</span>
          <FontAwesomeIcon :icon="ICONS.expand" class="basic-select__caret" aria-hidden="true" />
        </button>
      </template>
      <template #panel>
        <div class="basic-select__panel flex-column gap-1" :style="{ minWidth: `${width}px` }">
          <input
            v-if="searchable"
            v-model="query"
            type="search"
            role="combobox"
            class="basic-select__search"
            :placeholder="$t('select.search')"
            :aria-label="$t('select.search')"
            aria-autocomplete="list"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="activeId"
            @keydown="listbox.onKeydown($event, true)"
          />
          <OptionList
            :id="listId"
            :options="visible"
            :is-selected="isSelected"
            :multiple="multiple"
            :active="listbox.active.value"
            :tabindex="searchable ? -1 : 0"
            :aria-labelledby="controlAttrs['aria-labelledby'] ?? field.id.value"
            :aria-activedescendant="searchable ? undefined : activeId"
            @keydown="onListKeydown"
            @keyup.space="multiple || listbox.chooseActive()"
            @hover="listbox.active.value = $event"
            @choose="choose"
          />
          <p v-if="!matching.length" class="basic-select__empty fs-200 t-muted">{{ $t("select.no_results") }}</p>
        </div>
      </template>
    </BasicMenu>
    <IconButton v-if="showClear" icon="close" size="sm" class="basic-select__clear" :label="$t('select.clear')" @click="clear" />
  </div>
</template>

<script setup>
// One choice from a list (docs/ui-rules.md C4): `v-model` holds the value, or an array of values when `multiple`.
// `options` = [{ label, value, description?, disabled? }]; `searchable` adds a filter input above the list;
// `clearable` a clear button while something is chosen. The closed control is a `role="combobox"` button; the list
// opens in BasicMenu's panel (position, flip, outside click, Esc, focus return) as a listbox driven by
// `aria-activedescendant` (useListbox: arrows, Home / End, type-ahead, Enter / Space). Inside a FormField the
// control takes the field's id, description, invalid, required and disabled (a caller's `aria-describedby` joins the
// description); `aria-label` / `aria-labelledby` on the tag name it outside one. `placement` and `inline` go to BasicMenu (`inline`: open in the page flow, catalogue).
// `moreLabel` adds an action row at the end of the list for options that are not loaded yet: never filtered out,
// choosing it emits `more` and keeps the menu open. `search` carries the trimmed filter text on every change.
// `floatingLabel` names a select that stands without a FormField (toolbars, card headers): the empty control shows it
// as the placeholder, a chosen value puts it above the control as a 12 px muted line; it is the accessible name too.
import { computed, ref, useAttrs, useId, watch } from "vue";
import { isEqual } from "lodash";
import BasicMenu from "@/boots/BasicMenu/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import { ICONS } from "@/boots/Icons/icons";
import { useFormFieldControl } from "@/composables/formField";
import { joinIds } from "@/boots/FormField/useControlAttrs";
import { t } from "@/i18n";
import OptionList from "./OptionList.vue";
import { useListbox } from "./useListbox";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: [String, Number, Boolean, Array, Object], default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: null },
  multiple: { type: Boolean, default: false },
  searchable: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placement: { type: String, default: "bottom-start" },
  inline: { type: Boolean, default: false },
  floatingLabel: { type: String, default: "" },
  moreLabel: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue", "more", "search"]);

const MORE = "__basic_select_more__";

const field = useFormFieldControl();
const attrs = useAttrs();
const listId = `${useId()}-listbox`;
const menu = ref(null);
const control = ref(null);
const query = ref("");
const width = ref(0);

const isAria = (name) => name.startsWith("aria-");
const floatingName = computed(() =>
  props.floatingLabel && !attrs["aria-labelledby"] ? { "aria-label": props.floatingLabel } : {}
);
const controlAttrs = computed(() => ({
  ...floatingName.value,
  ...Object.fromEntries(Object.entries(attrs).filter(([name]) => isAria(name))),
}));
const rootAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([name]) => !isAria(name))));
const menuLabel = computed(() => controlAttrs.value["aria-label"] ?? "");
const menuLabelledby = computed(() => attrs["aria-labelledby"] ?? field.labelId?.value ?? "");
const isDisabled = computed(() => props.disabled || field.disabled.value);

const values = computed(() => (props.multiple ? props.modelValue ?? [] : [props.modelValue]));
const isSelected = (option) => values.value.some((value) => isEqual(value, option.value));
const selectedOptions = computed(() => props.options.filter(isSelected));
const showClear = computed(() => props.clearable && !isDisabled.value && selectedOptions.value.length > 0);

const matching = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return props.options;
  return props.options.filter((option) => String(option.label).toLowerCase().includes(needle));
});
const moreRow = computed(() => (props.moreLabel ? [{ label: props.moreLabel, value: MORE, action: "more" }] : []));
const visible = computed(() => [...matching.value, ...moreRow.value]);

const display = computed(() => {
  const picked = selectedOptions.value;
  if (picked.length > 1) return t("select.selected_count", { count: picked.length });
  return picked[0]?.label ?? (props.floatingLabel || (props.placeholder ?? t("common.select")));
});

const listbox = useListbox(visible, choose);
const activeId = computed(() => (listbox.active.value >= 0 ? `${listId}-${listbox.active.value}` : undefined));
// Sync: onOpen clears the query and then points at the chosen option; a queued reset would undo that.
watch(
  query,
  (value) => {
    listbox.reset();
    emit("search", value.trim());
  },
  { flush: "sync" }
);

// Single choice takes Space on keyup: focus returns to the trigger button, whose own Space keyup would reopen.
function onListKeydown(event) {
  if (event.key === " " && !props.multiple) event.preventDefault();
  else listbox.onKeydown(event);
}

function onOpen() {
  query.value = "";
  width.value = control.value?.offsetWidth ?? 0;
  listbox.reset(visible.value.findIndex(isSelected));
}

function choose(option) {
  if (option.action) {
    emit("more");
    return;
  }
  if (!props.multiple) {
    emit("update:modelValue", option.value);
    menu.value?.close({ returnFocus: true });
    return;
  }
  const kept = values.value.filter((value) => !isEqual(value, option.value));
  emit("update:modelValue", kept.length < values.value.length ? kept : [...values.value, option.value]);
}

function clear() {
  emit("update:modelValue", props.multiple ? [] : null);
  control.value?.focus();
}
</script>

<style lang="scss" scoped>
.basic-select {
  min-width: 0;
}

// The floating label: a compact line above the chosen value, never a second placeholder. It hangs above the
// control without taking layout height, so a select keeps the height of its siblings labelled or not.
.basic-select__floating {
  position: absolute;
  bottom: calc(100% + var(--space-1));
  left: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: var(--fs-200);
  line-height: 1.25;
}

// The control fills the select's width; BasicMenu is inline-flex by default.
.basic-select__menu {
  display: flex;
  width: 100%;

  :deep(.basic-menu__trigger) {
    flex: 1;
    align-self: stretch;
    min-width: 0;
  }

  // The list is at least as wide as the control (the panel's min-width): a wide field never gets a narrower menu.
  :deep(.basic-menu__popover--panel) {
    align-self: stretch;
    max-width: calc(100vw - var(--space-4));
    padding: var(--space-1);
  }
}

.basic-select__control {
  box-sizing: border-box;
  width: 100%;
  height: var(--elem-height);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  background: var(--surface-sunken);
  color: var(--text-body);
  font-family: inherit;
  font-size: var(--fs-300);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--border-default);
  }

  &[aria-expanded="true"] {
    border-color: var(--accent);
  }

  &[aria-invalid="true"] {
    border-color: var(--negative);
  }

  &:disabled {
    border-color: var(--border-subtle);
    background: var(--surface-disabled);
    color: var(--text-muted);
    cursor: not-allowed;
  }
}

.basic-select__control--empty {
  color: var(--text-muted);
}

.basic-select__value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.basic-select__caret {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: transform 0.15s;

  [aria-expanded="true"] > & {
    transform: rotate(180deg);
  }
}

// The clear button sits over the control between the value and the caret; the value keeps room for it.
.basic-select--clearable .basic-select__value {
  padding-right: var(--space-8);
}

.basic-select__clear {
  position: absolute;
  bottom: calc(var(--elem-height) / 2);
  right: calc(var(--space-3) + var(--space-5));
  transform: translateY(50%);
}

.basic-select__search {
  box-sizing: border-box;
  width: 100%;
  height: var(--elem-height);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  background: var(--surface-sunken);
  color: var(--text-body);
  font-family: inherit;
  font-size: var(--fs-300);

  &:focus-visible {
    border-color: var(--accent);
    outline: none;
  }
}

.basic-select__empty {
  margin: 0;
  padding: var(--space-2) var(--space-3);
}
</style>
