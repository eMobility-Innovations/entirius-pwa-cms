<template>
  <nav class="step-rail" :aria-label="$t('enrichment.studio.steps')" data-testid="step-rail">
    <ol class="step-rail__list m-0 p-0 flex-column gap-1">
      <li v-for="(item, index) in items" :key="item.key">
        <router-link
          :to="{ query: { step: item.key } }"
          replace
          class="step-rail__item flex ai-ct gap-3"
          :class="{ 'step-rail__item--selected': item.key === selected }"
          :aria-current="item.key === selected ? 'step' : undefined"
          :data-testid="`step-${item.key}`"
          :data-status="item.status"
        >
          <span class="step-rail__icon" :class="`step-rail__icon--${item.tone}`" aria-hidden="true">
            <FontAwesomeIcon :icon="$icons[item.icon]" :spin="item.status === 'running'" />
          </span>
          <span class="flex-column">
            <span class="step-rail__label">{{ index + 1 }}. {{ item.label }}</span>
            <span class="fs-200 t-secondary">{{ $t(`enrichment.studio.step_status.${item.status}`) }}</span>
          </span>
        </router-link>
      </li>
    </ol>
  </nav>
</template>

<script>
import { railItems } from "./studioLogic";

// The steps of a run top to bottom: number, name and a plain-language state with its icon. A step is a link that
// selects it (`?step=`), so the selection survives a reload and the browser back button.
export default {
  name: "StepRail",
  props: {
    run: { type: Object, required: true },
    selected: { type: String, default: "" },
  },
  computed: {
    items() {
      return railItems(this.run);
    },
  },
};
</script>

<style lang="scss" scoped>
.step-rail__list {
  list-style: none;
}
.step-rail__item {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  color: var(--text-body);
  text-decoration: none;
}
.step-rail__item:hover {
  background: var(--surface-hover);
}
.step-rail__item--selected {
  background: var(--surface-raised);
}
.step-rail__item--selected .step-rail__label {
  color: var(--text-accent);
}
.step-rail__label {
  font-weight: 600;
  color: var(--text-strong);
}
.step-rail__icon {
  display: inline-flex;
  justify-content: center;
  width: var(--space-5);
}
.step-rail__icon--neutral {
  color: var(--text-muted);
}
.step-rail__icon--info {
  color: var(--info);
}
.step-rail__icon--warning {
  color: var(--warning);
}
.step-rail__icon--positive {
  color: var(--positive);
}
.step-rail__icon--negative {
  color: var(--negative);
}
</style>
