<template>
  <component
    :is="locked ? 'div' : 'button'"
    :type="locked ? null : 'button'"
    class="panel-card flex-column"
    :class="{ 'panel-card--locked': locked }"
    @click="!locked && $emit('click')"
  >
    <span class="panel-card__icon inline-flex jc-ct ai-ct">
      <FontAwesomeIcon :icon="icon" aria-hidden="true" />
    </span>
    <span class="panel-card__body flex-column gap-3">
      <span class="panel-card__title type-title">{{ title }}</span>
      <span v-if="locked" class="panel-card__text type-description inline-flex ai-ct gap-1">
        <FontAwesomeIcon :icon="$icons.lock" aria-hidden="true" />
        {{ lockedText }}
      </span>
      <span v-else-if="description" class="panel-card__text type-description">{{ description }}</span>
    </span>
  </component>
</template>

<script setup>
// A Home panel tile (Figma S1/S2): the named `card` gradient, `--radius-3xl`, 20 px padding and gap; a plain 24 px
// icon (no tile), then title (Lexend Deca 20) and description (14/300) 12 px apart. `locked` (panel off for this user)
// = opacity .5, a lock and `lockedText` in place of the description, not focusable, no click. `icon` is the panel's
// glyph from the nav model (configs/access.js), not a meaning. Root class `panel-card` is the e2e hook; the page
// puts the landmark (`data-fid="panel-card"`) on the card Figma measures.
defineProps({
  icon: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  locked: { type: Boolean, default: false },
  lockedText: { type: String, default: "" },
});
defineEmits(["click"]);
</script>

<style lang="scss">
.panel-card {
  box-sizing: border-box;
  width: 100%;
  gap: var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-3xl);
  background: var(--surface-card);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover:not(.panel-card--locked) {
    border-color: var(--border-default);
    box-shadow: var(--shadow-sm);
  }

  &__icon {
    width: var(--space-6);
    height: var(--space-6);
    color: var(--text-strong);
    font-size: var(--fs-500);
  }

  &__title {
    color: var(--text-strong);
  }

  &__text {
    color: var(--text-muted);
  }
}

.panel-card--locked {
  opacity: 0.5;
  cursor: default;
}
</style>
