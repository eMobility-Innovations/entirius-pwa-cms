<template>
  <div class="entity-picker relative" v-bind="rootAttrs">
    <input
      v-if="manual"
      :id="field.id.value"
      type="text"
      class="entity-picker__search"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-describedby="field.describedBy.value || undefined"
      v-bind="controlAttrs"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <BasicMenu v-else ref="menu" class="entity-picker__menu" :label="placeholder" :inline="inline" @open="onOpen">
      <template #trigger>
        <button
          :id="field.id.value"
          ref="control"
          type="button"
          role="combobox"
          class="entity-picker__trigger flex ai-ct gap-2"
          :disabled="isDisabled"
          :aria-describedby="field.describedBy.value || undefined"
          :aria-invalid="field.invalid.value ? 'true' : undefined"
          :aria-required="field.required.value ? 'true' : undefined"
          v-bind="controlAttrs"
        >
          <span v-if="modelValue" class="entity-picker__hidden">{{ selectedLabel }}</span>
          <template v-else>
            <FontAwesomeIcon :icon="ICONS.search" class="entity-picker__icon" aria-hidden="true" />
            <span class="entity-picker__placeholder">{{ placeholder }}</span>
          </template>
          <FontAwesomeIcon :icon="ICONS.expand" class="entity-picker__caret" aria-hidden="true" />
        </button>
      </template>
      <template #panel>
        <div class="entity-picker__panel flex-column gap-1" :style="{ minWidth: `${width}px` }">
          <input
            v-model="query"
            type="search"
            role="combobox"
            class="entity-picker__search"
            :placeholder="placeholder || $t('entity_picker.search')"
            :aria-label="placeholder || $t('entity_picker.search')"
            aria-autocomplete="list"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="activeId"
            @input="onSearchInput"
            @keydown="listbox.onKeydown($event, true)"
          />
          <p v-if="!options.length" class="entity-picker__status fs-200 t-muted" role="status">
            {{ loading ? $t("entity_picker.searching") : $t("entity_picker.no_results") }}
          </p>
          <OptionList
            v-else
            :id="listId"
            :options="options"
            :is-selected="(option) => option.value === modelValue"
            :active="listbox.active.value"
            :aria-label="placeholder || $t('entity_picker.search')"
            @hover="listbox.active.value = $event"
            @choose="select"
          />
        </div>
      </template>
    </BasicMenu>
    <Tag
      v-if="modelValue && !manual"
      class="entity-picker__tag"
      :label="selectedLabel"
      :removable="!isDisabled"
      @remove="clear"
    />
  </div>
</template>

<script setup>
// Async entity search (docs/ui-rules.md C4): `fetchFn(search)` resolves [{ label, value, secondary? }] (debounced
// 300 ms, or once when `clientFilter` filters them here). `v-model` = the value, `v-model:displayValue` = its label;
// the chosen entity shows as a removable Tag (remove → both cleared + `clear`). The list opens in BasicMenu's panel:
// a filter input driving the listbox (useListbox), `secondary` as the option description. Inside a FormField the
// control takes the field's id, description, invalid, required and disabled. `inline`: open in the page flow
// (catalogue). `disabled` disables the control; `manual` swaps it for a plain text field for the value, no search
// (the Edit* modals without PIM).
import { computed, onBeforeUnmount, ref, useAttrs, useId, watch } from "vue";
import BasicMenu from "@/boots/BasicMenu/index.vue";
import Tag from "@/boots/Tag/index.vue";
import OptionList from "@/boots/BasicSelect/OptionList.vue";
import { useListbox } from "@/boots/BasicSelect/useListbox";
import { ICONS } from "@/boots/Icons/icons";
import { useFormFieldControl } from "@/composables/formField";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: null },
  displayValue: { type: String, default: "" },
  fetchFn: { type: Function, required: true },
  placeholder: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  manual: { type: Boolean, default: false },
  clientFilter: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "update:displayValue", "clear"]);

const DEBOUNCE_MS = 300;
const field = useFormFieldControl();
const attrs = useAttrs();
const listId = `${useId()}-listbox`;
const menu = ref(null);
const control = ref(null);
const width = ref(0);
const query = ref("");
const results = ref([]);
const allResults = ref([]);
const loading = ref(false);
let debounceTimer = null;
let lastRequest = 0;

const isAria = (name) => name.startsWith("aria-");
const controlAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([name]) => isAria(name))));
const rootAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([name]) => !isAria(name))));
const isDisabled = computed(() => props.disabled || field.disabled.value);
const selectedLabel = computed(() => props.displayValue || props.modelValue);
const options = computed(() => results.value.map((r) => ({ label: r.label, value: r.value, description: r.secondary })));

const listbox = useListbox(options, select);
const activeId = computed(() => (listbox.active.value >= 0 ? `${listId}-${listbox.active.value}` : undefined));
watch(options, () => listbox.reset());

function onOpen() {
  query.value = "";
  width.value = control.value?.offsetWidth ?? 0;
  fetchResults("");
}

function select(item) {
  emit("update:modelValue", item.value);
  emit("update:displayValue", item.label);
  menu.value?.close({ returnFocus: true });
}

function clear() {
  emit("update:modelValue", null);
  emit("update:displayValue", "");
  emit("clear");
  control.value?.focus();
}

function onSearchInput() {
  if (props.clientFilter) return filterLocal();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchResults(query.value), DEBOUNCE_MS);
}

function filterLocal() {
  const q = query.value.toLowerCase().trim();
  const matches = (text) => String(text || "").toLowerCase().includes(q);
  results.value = q ? allResults.value.filter((r) => matches(r.label) || matches(r.secondary) || matches(r.value)) : allResults.value;
}

// Only the newest request lands: an earlier, slower one never overwrites its results.
async function fetchResults(search) {
  const request = ++lastRequest;
  loading.value = true;
  try {
    const data = (await props.fetchFn(search)) || [];
    if (request !== lastRequest) return;
    if (props.clientFilter) {
      allResults.value = data;
      filterLocal();
    } else {
      results.value = data;
    }
  } catch {
    if (request !== lastRequest) return;
    results.value = [];
    allResults.value = [];
  } finally {
    if (request === lastRequest) loading.value = false;
  }
}

// The catalogue's open state has no `open` event: it loads the list at mount.
watch(
  () => props.inline,
  (inline) => inline && !props.manual && fetchResults(""),
  { immediate: true }
);
onBeforeUnmount(() => clearTimeout(debounceTimer));
</script>

<style lang="scss" scoped>
.entity-picker {
  min-width: 0;
}

// The trigger fills the picker's width; BasicMenu is inline-flex by default.
.entity-picker__menu {
  display: flex;
  width: 100%;

  :deep(.basic-menu__trigger) {
    flex: 1;
    align-self: stretch;
    min-width: 0;
  }

  :deep(.basic-menu__popover--panel) {
    align-self: stretch;
    padding: var(--space-1);
  }
}

.entity-picker__trigger {
  box-sizing: border-box;
  width: 100%;
  height: var(--elem-height);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  background: var(--surface-sunken);
  color: var(--text-muted);
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
    cursor: not-allowed;
  }
}

.entity-picker__icon {
  flex-shrink: 0;
}

.entity-picker__placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-picker__caret {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-secondary);
  transition: transform 0.15s;

  [aria-expanded="true"] > & {
    transform: rotate(180deg);
  }
}

// The chosen value's name for assistive tech: the Tag over the control shows it.
.entity-picker__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

// The Tag lies over the control's left side: a click on it opens the list, its remove button stays its own.
.entity-picker__tag {
  position: absolute;
  top: calc(var(--elem-height) / 2);
  left: var(--space-2);
  max-width: calc(100% - var(--space-10));
  transform: translateY(-50%);
  pointer-events: none;

  :deep(.icon-button) {
    pointer-events: auto;
  }
}

.entity-picker__search {
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

.entity-picker__status {
  margin: 0;
  padding: var(--space-3);
  text-align: center;
}
</style>
