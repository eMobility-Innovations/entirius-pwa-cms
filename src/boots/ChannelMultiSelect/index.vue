<template>
  <div class="channel-select">
    <span v-if="floatingLabel && modelValue.length" class="channel-select__floating" aria-hidden="true">
      {{ floatingLabel }}
    </span>
    <BasicMenu :label="floatingLabel || label" :inline="inline" placement="bottom-end" @open="onOpen">
      <template #trigger>
        <button
          type="button"
          class="channel-select__trigger flex ai-ct gap-2 pointer"
          :class="{ 'channel-select__trigger--active': modelValue.length, 'channel-select__trigger--floating': floatingLabel }"
          :title="triggerName"
          :aria-label="triggerName"
        >
          <FontAwesomeIcon :icon="ICONS.channels" aria-hidden="true" />
          <span v-if="floatingLabel" class="channel-select__value">{{ floatingValue }}</span>
          <template v-else>
            <span v-if="!compact" class="channel-select__full">{{ triggerLabel }}</span>
            <span class="channel-select__short" :class="{ 'channel-select__short--always': compact }">{{ label }}</span>
          </template>
        </button>
      </template>
      <template #panel>
        <OptionList
          :id="listId"
          class="channel-select__list"
          :options="options"
          :is-selected="(option) => modelValue.includes(option.value)"
          multiple
          :active="listbox.active.value"
          tabindex="0"
          :aria-label="floatingLabel || label"
          :aria-activedescendant="listbox.active.value >= 0 ? `${listId}-${listbox.active.value}` : undefined"
          @keydown="listbox.onKeydown($event)"
          @hover="listbox.active.value = $event"
          @choose="toggle($event.value)"
        />
      </template>
    </BasicMenu>
  </div>
</template>

<script setup>
// Channel scope chip (docs/ui-rules.md C4, Figma S6): „Kanały: Wszystkie” with no channel picked, „Kanały: 2” with
// two; `compact` shows „Kanały” only (phone header), as does every chip below the tablet breakpoint. `v-model` =
// picked channel idxs, `channels` = [{ idx, name? }]. The list opens in BasicMenu's panel as a multi-select listbox
// with checkboxes (useListbox keyboard); `inline`: open in the page flow (catalogue). `floatingLabel` (a select without
// a FormField): the empty chip shows it, picked channels show their name (or „Wybrano: N”) with it above as a 12 px
// muted line; it starts the accessible name.
import { computed, useId } from "vue";
import { t } from "@/i18n";
import BasicMenu from "@/boots/BasicMenu/index.vue";
import OptionList from "@/boots/BasicSelect/OptionList.vue";
import { useListbox } from "@/boots/BasicSelect/useListbox";
import { ICONS } from "@/boots/Icons/icons";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  channels: { type: Array, default: () => [] },
  label: { type: String, default: "Channels" },
  allLabel: { type: String, default: "All" },
  compact: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
  floatingLabel: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const listId = `${useId()}-listbox`;
const options = computed(() => props.channels.map((ch) => ({ label: ch.name || ch.idx, value: ch.idx })));
const listbox = useListbox(options, (option) => toggle(option.value));

const triggerLabel = computed(() => `${props.label}: ${props.modelValue.length || props.allLabel}`);
const floatingValue = computed(() => {
  const picked = options.value.filter((option) => props.modelValue.includes(option.value));
  if (picked.length > 1) return t("select.selected_count", { count: picked.length });
  return picked[0]?.label ?? props.floatingLabel;
});
const triggerName = computed(() => {
  if (!props.floatingLabel) return triggerLabel.value;
  return props.modelValue.length ? `${props.floatingLabel}: ${floatingValue.value}` : props.floatingLabel;
});

function onOpen() {
  listbox.reset(options.value.findIndex((option) => props.modelValue.includes(option.value)));
}

function toggle(idx) {
  const picked = props.modelValue.includes(idx);
  emit("update:modelValue", picked ? props.modelValue.filter((value) => value !== idx) : [...props.modelValue, idx]);
}
</script>

<style lang="scss" scoped>
.channel-select {
  display: inline-flex;
  flex-direction: column;
  min-width: 0;
}

.channel-select__floating {
  margin-bottom: var(--space-1);
  color: var(--text-muted);
  font-size: var(--fs-200);
  line-height: 1.25;
}

.channel-select__trigger {
  box-sizing: border-box;
  height: var(--elem-height);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  background: var(--surface-sunken);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-300);
  font-weight: 500;
  white-space: nowrap;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--border-default);
    color: var(--text-body);
  }

  &[aria-expanded="true"] {
    border-color: var(--accent);
  }
}

.channel-select__trigger--active {
  border-color: var(--accent);
  color: var(--text-accent);
}

// A floating-label chip reads as a field: body text, never the dimmed secondary tone.
.channel-select__trigger--floating,
.channel-select__trigger--floating.channel-select__trigger--active {
  color: var(--text-body);
}

.channel-select__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.channel-select__short {
  display: none;
}

.channel-select__short--always {
  display: inline;
}

@media only screen and (max-width: 768px) {
  .channel-select__full {
    display: none;
  }

  .channel-select__short {
    display: inline;
  }
}

.channel-select__list {
  min-width: 12rem;
}
</style>
