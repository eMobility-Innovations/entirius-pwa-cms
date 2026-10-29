<template>
  <nav class="step-rail" :aria-label="$t('enrichment.studio.steps')" data-testid="step-rail">
    <p v-if="selectedItem" class="step-rail__summary m-0" aria-hidden="true">
      <span class="t-secondary">{{ $t("enrichment.studio.step_of", { number: selectedItem.number, total: items.length }) }}</span>
      <span class="step-rail__summary-label">{{ selectedItem.label }}</span>
      <span class="t-secondary">{{ lineText(selectedItem) }}</span>
    </p>
    <ol class="step-rail__list m-0 p-0">
      <li v-for="item in items" :key="item.key" class="step-rail__step">
        <router-link
          :to="{ query: { step: item.key } }"
          replace
          class="step-rail__item"
          :class="{ 'step-rail__item--selected': item.key === selected }"
          :aria-current="item.key === selected ? 'step' : undefined"
          :data-testid="`step-${item.key}`"
          :data-status="item.status"
        >
          <span class="step-rail__dot" :class="`step-rail__dot--${item.look}`" aria-hidden="true">
            <FontAwesomeIcon v-if="item.look === 'approved'" :icon="$icons.check" />
            <FontAwesomeIcon v-else-if="item.look === 'running'" :icon="$icons.running" spin />
            <FontAwesomeIcon v-else-if="item.look === 'failed'" :icon="$icons.warning" />
            <template v-else>{{ item.number }}</template>
          </span>
          <span class="step-rail__text flex-column">
            <span class="step-rail__label">{{ item.label }}</span>
            <span class="step-rail__line" :class="`step-rail__line--${item.look}`">{{ lineText(item) }}</span>
          </span>
        </router-link>
      </li>
    </ol>
  </nav>
</template>

<script>
import { railItems } from "./studioLogic";

// The steps of a run as a progress line: a numbered circle per step (a check once done, a spinner while the AI writes)
// joined by a line, the name and the state in words ("Your turn", "Starts after Outline"). A step is a link that
// selects it (`?step=`), so the selection survives a reload and the back button. Below 1024 px it folds into one row of
// circles under "Step 3 of 6 · Outline", so the selected step's panel starts on the first screen.
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
    selectedItem() {
      return this.items.find((item) => item.key === this.selected) || null;
    },
  },
  methods: {
    lineText(item) {
      return this.$t(`enrichment.studio.rail.${item.line.key}`, item.line.params);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.step-rail__summary {
  display: none;
}
.step-rail__list {
  list-style: none;
}
.step-rail__step {
  position: relative;
}
// The progress line from one circle to the next.
.step-rail__step:not(:last-child)::after {
  content: "";
  position: absolute;
  left: calc(var(--space-3) + var(--space-4) - 1px);
  top: calc(var(--space-3) + var(--space-8) + var(--space-1));
  bottom: calc(var(--space-1) - var(--space-3));
  width: 2px;
  border-radius: var(--radius-full);
  background: var(--border-subtle);
}
.step-rail__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
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
.step-rail__dot {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  background: var(--surface-sunken);
  color: var(--text-secondary);
  font-size: var(--fs-250);
  font-weight: 600;
}
.step-rail__dot--review {
  background: var(--accent-fill);
  color: var(--text-on-accent-fill);
}
.step-rail__dot--running {
  background: var(--info-subtle);
  color: var(--info);
}
.step-rail__dot--approved {
  background: var(--positive-subtle);
  color: var(--positive);
}
.step-rail__dot--failed {
  background: var(--negative-subtle);
  color: var(--negative);
}
.step-rail__text {
  min-width: 0;
  padding-top: 2px;
}
.step-rail__label {
  font-weight: 600;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.step-rail__line {
  font-size: var(--fs-250);
  color: var(--text-secondary);
}
.step-rail__line--review {
  font-weight: 600;
  color: var(--text-strong);
}
.step-rail__line--failed {
  color: var(--negative);
}

// One row of circles joined by the line, the selected one ringed; the names live in the summary line above.
@include max-shell {
  .step-rail__summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    margin-bottom: var(--space-3);
    font-size: var(--fs-250);
  }
  .step-rail__summary-label {
    font-weight: 600;
    color: var(--text-strong);
  }
  .step-rail__list {
    display: flex;
    align-items: center;
  }
  .step-rail__step {
    display: flex;
    flex: 1 1 0;
    align-items: center;
  }
  .step-rail__step:last-child {
    flex: none;
  }
  .step-rail__step:not(:last-child)::after {
    position: static;
    flex: 1;
    height: 2px;
    width: auto;
    margin: 0 var(--space-1);
  }
  .step-rail__item {
    padding: 0;
    border-radius: var(--radius-full);
  }
  .step-rail__item,
  .step-rail__item:hover,
  .step-rail__item--selected {
    background: none;
  }
  .step-rail__item--selected .step-rail__dot {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .step-rail__text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
