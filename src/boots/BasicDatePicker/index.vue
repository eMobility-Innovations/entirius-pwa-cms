<template>
  <div class="basic-date-picker inline-block">
    <div v-out="close" class="relative">
      <button
        ref="triggerEl"
        v-bind="attrs"
        type="button"
        class="basic-date-picker__trigger flex ai-ct gap-2"
        :aria-expanded="String(visible)"
        @click="visible ? close() : open()"
      >
        <FontAwesomeIcon :icon="ICONS.calendar" class="basic-date-picker__icon" aria-hidden="true" />
        <span :class="{ 't-muted': !current }">{{ current || $t("routes.set_new") }}</span>
      </button>
      <div v-show="visible" ref="wrapperEl" class="picker-wrapper bg-inherit bg-base" :style="fixedStyle">
        <!-- flatpickr's element: its inline calendar lands right after it, inside the wrapper -->
        <div ref="pickerEl">
          <input type="text" data-input style="display: none" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const DEFAULT_CONFIG = {
  mode: "single",
  wrap: true,
  inline: true,
  altInputClass: "invisible",
  enableTime: false,
  noCalendar: false,
};
</script>

<script setup>
// Date or date range (docs/ui-components.md § P3 inputs): an input-looking trigger with the calendar icon opens an
// inline flatpickr below it. `v-model` (the flatpickr date string), `config` (flatpickr options; a single date by default, `mode: "range"` for a range),
// `disabled`; inside a FormField the trigger takes the contract's id, label and state. The flatpickr instance lives only
// while the calendar is open (a table of pickers carries one calendar, not one per cell). `fixed`: the calendar is placed
// against the viewport, so a scrolling parent (a wide table) does not clip it; it opens upward when there is no room
// below and follows the trigger on scroll.
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import flatpickr from "flatpickr";
import { Polish } from "flatpickr/dist/l10n/pl.js";
import { english } from "flatpickr/dist/l10n/default.js";
import { getLang } from "@/i18n";
import { ICONS } from "@/boots/Icons/icons";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

const props = defineProps({
  modelValue: { type: String, default: undefined },
  config: { type: Object, default: () => DEFAULT_CONFIG },
  disabled: { type: Boolean, default: false },
  fixed: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const { attrs } = useControlAttrs({ disabled: () => props.disabled });
const visible = ref(false);
const pickerEl = ref(null);
const triggerEl = ref(null);
const wrapperEl = ref(null);
const fixedStyle = ref(null);
const current = computed(() => props.modelValue ?? "");
let instance = null;

function onChange(dates, dateString) {
  emit("update:modelValue", dateString);
}

async function open() {
  visible.value = true;
  const locale = getLang() === "PL" ? Polish : english;
  instance = flatpickr(pickerEl.value, { ...props.config, defaultDate: current.value, locale, onChange });
  if (!props.fixed) return;
  await nextTick();
  place();
  window.addEventListener("scroll", place, { capture: true, passive: true });
  window.addEventListener("resize", place);
}

function close() {
  if (!visible.value) return;
  visible.value = false;
  instance?.destroy();
  instance = null;
  window.removeEventListener("scroll", place, { capture: true });
  window.removeEventListener("resize", place);
}

// Below the trigger, or above it when the viewport has no room below and does above; never past the right edge (a
// fixed box cannot be scrolled to).
function place() {
  const trigger = triggerEl.value.getBoundingClientRect();
  const { offsetHeight: height, offsetWidth: width } = wrapperEl.value;
  const up = window.innerHeight - trigger.bottom < height && trigger.top >= height;
  const top = up ? trigger.top - height : trigger.bottom;
  const left = Math.max(0, Math.min(trigger.left, window.innerWidth - width));
  fixedStyle.value = { position: "fixed", top: `${top}px`, left: `${left}px`, bottom: "auto", transform: "none" };
}

// An outside change only: the picker's own pick is already in its input.
watch(current, (date) => {
  if (instance && date !== instance.input.value) instance.setDate(date, false);
});
onBeforeUnmount(close);
</script>

<style lang="scss">
.basic-date-picker {
  background-color: inherit;

  // The trigger looks like a BasicInput: same height, border, surface and disabled look.
  .basic-date-picker__trigger {
    min-width: 12rem;
    height: var(--elem-height);
    padding: var(--space-1) var(--space-2);
    font: inherit;
    color: var(--text-body);
    text-align: left;
    background-color: var(--surface-sunken);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-base);
    cursor: pointer;
    transition: border-color 0.2s;

    &:hover:not(:disabled) {
      border-color: var(--border-strong);
    }

    &[aria-invalid="true"] {
      border-color: var(--negative);
    }

    &:disabled {
      background-color: var(--surface-disabled);
      border-color: var(--border-subtle);
      color: var(--text-muted);
      cursor: not-allowed;
    }
  }

  .basic-date-picker__icon {
    color: var(--text-muted);
  }

  .picker-wrapper {
    position: absolute;
    bottom: 0;
    transform: translateY(100%);
    left: 0;
    z-index: 4;
  }
  // reset picker
  .flatpickr-calendar {
    background-color: inherit;
    color: inherit;
    font-size: inherit;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-base);
    box-shadow: unset;
  }
  .flatpickr-day.selected,
  .flatpickr-day.startRange,
  .flatpickr-day.endRange {
    background-color: var(--accent-fill);
    border-radius: var(--radius-base);
    box-shadow: unset;
  }

  .flatpickr-calendar.inline {
    top: 0;
  }

  .flatpickr-day.today {
    background: var(--accent-fill);
    color: var(--text-strong);
    font-weight: 600;
    border-radius: var(--radius-base);
    border: none;

    &.inRange {
      color: var(--text-accent);
    }
  }
  .flatpickr-day.inRange {
    background: var(--surface-raised);
    box-shadow: unset;
    border: none;
  }
  .flatpickr-day:hover {
    border-radius: var(--radius-base);
  }
  .flatpickr-calendar.hasTime .flatpickr-time {
    border: 0;
  }
  .flatpickr-time input {
    background-color: inherit;
    color: inherit;
    font-size: inherit;
  }
}

[data-theme="dark"] .basic-date-picker {
  .flatpickr-calendar {
    background-color: var(--surface-raised);
    color: var(--text-body);
  }
  .flatpickr-months .flatpickr-month,
  .flatpickr-current-month .flatpickr-monthDropdown-months {
    background-color: var(--surface-raised);
    color: var(--text-body);
  }
  .flatpickr-weekdays {
    background-color: var(--surface-raised);
  }
  span.flatpickr-weekday {
    background-color: var(--surface-raised);
    color: var(--text-muted);
  }
  .flatpickr-day {
    color: var(--text-body);
    &:hover {
      background-color: var(--surface-hover);
      border-color: var(--border-subtle);
    }
    &.flatpickr-disabled {
      color: var(--text-muted);
    }
  }
  .flatpickr-months .flatpickr-prev-month,
  .flatpickr-months .flatpickr-next-month {
    fill: var(--text-secondary);
    &:hover svg {
      fill: var(--text-body);
    }
  }
}
</style>
