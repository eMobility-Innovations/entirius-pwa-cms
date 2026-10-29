<template>
  <div class="permission-matrix flex-column gap-6" data-testid="permission-matrix">
    <section
      v-for="group in groups"
      :key="group.module"
      class="permission-matrix__group"
      :aria-labelledby="`${uid}-${group.module}`"
      :data-module="group.module"
    >
      <header class="permission-matrix__head flex ai-ct jc-sb wrap gap-3">
        <h3 :id="`${uid}-${group.module}`" class="permission-matrix__module fs-300 fw-600">
          {{ moduleLabel(group.module) }}
        </h3>
        <SegmentedControl
          v-if="!locked"
          :options="levelOptions"
          :model-value="groupLevel(modelValue, group.areas)"
          :aria-label="$t('access.matrix.set_all', { module: moduleLabel(group.module) })"
          data-testid="matrix-set-all"
          @update:model-value="emitValue(setGroup(modelValue, group.areas, $event))"
        />
      </header>
      <div
        v-for="area in group.areas"
        :key="area.key"
        class="permission-matrix__row flex ai-ct jc-sb wrap gap-3"
        :data-area="area.key"
      >
        <div class="flex ai-ct wrap gap-2 min-w-0">
          <span :id="`${uid}-${area.key}`" class="permission-matrix__label fs-200">{{ areaLabel(area) }}</span>
          <Tag v-for="flag in area.sensitive" :key="flag" :label="$t(`access.sensitive.${flag}`)" />
        </div>
        <div role="radiogroup" class="permission-matrix__levels" :aria-labelledby="`${uid}-${area.key}`">
          <label
            v-for="level in LEVELS"
            :key="level"
            class="permission-matrix__option fs-200"
            :class="{
              'permission-matrix__option--active': levelOf(area) === level,
              'permission-matrix__option--off': !offers(area, level),
            }"
          >
            <input
              type="radio"
              class="visually-hidden"
              :name="`${uid}-${area.key}`"
              :value="level"
              :checked="levelOf(area) === level"
              :disabled="locked || !offers(area, level)"
              @change="emitValue(setLevel(modelValue, area.key, level))"
            />
            <span>{{ $t(`access.matrix.levels.${level}`) }}</span>
          </label>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
// Areas × none/read/write (docs/ui-components.md § PermissionMatrix): `areas` = the catalogue's module groups,
// `v-model` = `{ "<area>": "read" | "write" }` (no key = none), `disabled` = read-only display (a read-only page is
// too), `showReserved` = also the non-assignable areas (access.manage; a built-in role only). One radio group per
// area, named by its label; a level the area does not offer is disabled. "Set all" per module clamps to what each area offers. Labels are text
// only: `access.areas.<key>` / `access.modules.<module>` when translated, else the catalogue's English label.
import { computed, useId } from "vue";
import { t } from "@/i18n";
import SegmentedControl from "@/boots/SegmentedControl/index.vue";
import Tag from "@/boots/Tag/index.vue";
import { useReadonly } from "@/composables/useReadonly";
import { LEVELS, NONE, groupLevel, setGroup, setLevel, visibleGroups } from "./matrix";

const props = defineProps({
  areas: { type: Array, required: true },
  modelValue: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
  showReserved: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const uid = useId();
const pageReadonly = useReadonly();
const locked = computed(() => props.disabled || pageReadonly.value);
const groups = computed(() => visibleGroups(props.areas, props.showReserved));
const levelOptions = computed(() => LEVELS.map((level) => ({ value: level, label: t(`access.matrix.levels.${level}`) })));

const translated = (key, fallback) => (t(key) === key ? fallback : t(key));
const moduleLabel = (module) => translated(`access.modules.${module}`, module.replace(/^django_/, "").replace(/_/g, " "));
const areaLabel = (area) => translated(`access.areas.${area.key}`, area.label);
const levelOf = (area) => props.modelValue[area.key] || NONE;
const offers = (area, level) => level === NONE || area.levels.includes(level);
const emitValue = (value) => emit("update:modelValue", value);
</script>

<style lang="scss">
.permission-matrix {
  &__head {
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
  }

  &__module {
    margin: 0;
    color: var(--text-body);
  }

  &__row {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__label {
    color: var(--text-body);
  }

  // The SegmentedControl's look: a 2 px hairline inset around and between the options.
  &__levels {
    --levels-pad: 2px;

    display: inline-flex;
    flex-shrink: 0;
    padding: var(--levels-pad);
    gap: var(--levels-pad);
    background-color: var(--surface-raised);
    border-radius: var(--radius-full);
  }

  &__option {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
    cursor: pointer;

    &--active {
      background-color: var(--surface-base);
      color: var(--text-body);
      font-weight: 600;
      box-shadow: var(--shadow-sm);
    }

    &--off {
      color: var(--text-muted);
      cursor: default;
      text-decoration: line-through;
    }

    &:has(:focus-visible) {
      outline: 2px solid var(--focus-ring);
      outline-offset: -2px;
    }

    &:has(:disabled):not(&--off) {
      cursor: default;
    }
  }
}
</style>
