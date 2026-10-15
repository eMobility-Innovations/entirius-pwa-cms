<template>
  <ul :id="id" role="listbox" class="option-list flex-column" :aria-multiselectable="multiple ? 'true' : undefined">
    <li
      v-for="(option, i) in options"
      :id="`${id}-${i}`"
      :key="`${i}-${option.value}`"
      ref="items"
      role="option"
      class="option-list__option flex ai-ct gap-2 pointer"
      :class="{ 'option-list__option--active': i === active, 'option-list__option--action': option.action }"
      :data-action="option.action"
      :aria-selected="option.action ? undefined : String(isSelected(option))"
      :aria-disabled="option.disabled ? 'true' : undefined"
      @mousedown.prevent
      @pointermove="option.disabled || $emit('hover', i)"
      @click="option.disabled || $emit('choose', option)"
    >
      <template v-if="multiple && !option.action">
        <FontAwesomeIcon v-if="isSelected(option)" :icon="ICONS.checkboxOn" class="option-list__box" aria-hidden="true" />
        <!-- An empty box, drawn like BasicCheckbox: a filled glyph would read as ticked. -->
        <span v-else class="option-list__box option-list__box--off" aria-hidden="true" />
      </template>
      <span class="option-list__text flex-column">
        <span class="option-list__label">{{ option.label }}</span>
        <span v-if="option.description" class="option-list__description">{{ option.description }}</span>
      </span>
      <FontAwesomeIcon
        v-if="!multiple && isSelected(option)"
        :icon="ICONS.check"
        class="option-list__check"
        aria-hidden="true"
      />
    </li>
  </ul>
</template>

<script setup>
// The option list of BasicSelect, EntitySearchPicker and ChannelMultiSelect: `role="listbox"` of `option`s with ids
// `<id>-<index>` (the owner's `aria-activedescendant`), `active` highlighted and kept in view, a checkbox per option
// when `multiple`, a check on the selected one otherwise. Options = [{ label, value, description?, disabled?, action? }];
// an `action` row (BasicSelect's load-more) is a command, never a value: no checkbox, no selected state.
// Emits `choose` (click on an enabled option) and `hover` (index under the pointer). A mousedown never takes the
// focus from the owner's list or filter input.
import { ref, watch } from "vue";
import { ICONS } from "@/boots/Icons/icons";

const props = defineProps({
  id: { type: String, required: true },
  options: { type: Array, required: true },
  isSelected: { type: Function, required: true },
  multiple: { type: Boolean, default: false },
  active: { type: Number, default: -1 },
});
defineEmits(["choose", "hover"]);

const items = ref([]);
watch(
  () => props.active,
  (index) => items.value[index]?.scrollIntoView?.({ block: "nearest" }),
  { flush: "post" }
);
</script>

<style lang="scss" scoped>
.option-list {
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  outline: none;
}

.option-list__option {
  min-height: var(--elem-height);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-base);
  color: var(--text-body);
  font-size: var(--fs-300);

  &[aria-selected="true"] {
    color: var(--text-accent);
  }

  &[aria-disabled="true"] {
    color: var(--text-muted);
    cursor: not-allowed;
  }
}

.option-list__option--action {
  color: var(--text-accent);
}

.option-list__option--active {
  background: var(--surface-hover);
}

// The active option of a focused list gets the focus ring: the keyboard position is visible without the pointer.
.option-list:focus-visible .option-list__option--active {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.option-list__text {
  flex: 1;
  min-width: 0;
}

.option-list__label {
  overflow-wrap: anywhere;
}

.option-list__description {
  color: var(--text-muted);
  font-size: var(--fs-200);
  overflow-wrap: anywhere;
}

.option-list__box,
.option-list__check {
  flex-shrink: 0;
  width: var(--space-4);
}

.option-list__box {
  color: var(--text-secondary);
}

[aria-selected="true"] > .option-list__box {
  color: var(--accent);
}

.option-list__box--off {
  box-sizing: border-box;
  height: var(--space-4);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-base);
  background: var(--surface-sunken);
}
</style>
