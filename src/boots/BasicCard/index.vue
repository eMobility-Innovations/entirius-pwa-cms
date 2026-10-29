<template>
  <section class="basic-card flex-column" :class="[flat ? 'basic-card--flat' : 'page-card', { 'gap-4': gap }]">
    <header v-if="title || $slots.actions" class="basic-card__header flex ai-ct jc-sb gap-3">
      <h2 v-if="title" class="basic-card__title">{{ title }}</h2>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>

<script setup>
// The one card (the polish card class `.page-card`: border-subtle, card radius, 24 px padding, 16 px below tablet;
// R4: the border belongs to the container). `title` is a section title (Inter 600, one step under the page H1);
// the `actions` slot takes an ActionBar, right of the title. `gap` puts 16 px between the children; off by default,
// so children that carry their own `mb-*` keep their spacing. `flat` drops the frame (no border, no padding) for a card
// shown inside a container that already frames it (a SideDrawer, a modal).
defineProps({
  title: { type: String, default: "" },
  gap: { type: Boolean, default: false },
  flat: { type: Boolean, default: false },
});
</script>

<style lang="scss">
.basic-card__header {
  flex-wrap: wrap;
}

.basic-card__title {
  margin: 0;
  min-width: 0;
  font-size: var(--fs-400);
  font-weight: 600;
  color: var(--text-strong);
}
</style>
