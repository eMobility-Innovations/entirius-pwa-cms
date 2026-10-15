<template>
  <div class="step-callout flex gap-3" :class="`step-callout--${tone}`" :role="role">
    <FontAwesomeIcon v-if="icon" :icon="$icons[icon]" class="step-callout__icon" aria-hidden="true" />
    <div class="step-callout__body flex-column gap-2">
      <p v-if="title" class="step-callout__title m-0">{{ title }}</p>
      <slot />
    </div>
  </div>
</template>

<script>
const TONES = ["info", "positive", "warning", "negative", "neutral"];

// A Studio note on a tinted surface: the SERP notes, quality warnings, a failed or slow step, the created draft. `tone`
// picks the subtle surface and the icon colour; `title` is the bold first line, the slot the rest.
export default {
  name: "StepCallout",
  props: {
    tone: { type: String, default: "info", validator: (value) => TONES.includes(value) },
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    // "alert" for a failure the operator must see; "status" for the rest.
    role: { type: String, default: "status" },
  },
};
</script>

<style lang="scss" scoped>
.step-callout {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  color: var(--text-body);
  font-size: var(--fs-300);
  line-height: 1.5;
}
.step-callout__body {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.step-callout__title {
  font-weight: 600;
  color: var(--text-strong);
}
.step-callout__icon {
  margin-top: 3px;
}
.step-callout--info {
  background: var(--info-subtle);
  .step-callout__icon {
    color: var(--info);
  }
}
.step-callout--positive {
  background: var(--positive-subtle);
  .step-callout__icon {
    color: var(--positive);
  }
}
.step-callout--warning {
  background: var(--warning-subtle);
  .step-callout__icon {
    color: var(--warning);
  }
}
.step-callout--negative {
  background: var(--negative-subtle);
  .step-callout__icon {
    color: var(--negative);
  }
}
.step-callout--neutral {
  background: var(--surface-raised);
  .step-callout__icon {
    color: var(--text-secondary);
  }
}
</style>
