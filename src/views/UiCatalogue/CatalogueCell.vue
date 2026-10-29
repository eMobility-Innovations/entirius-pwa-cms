<template>
  <figure
    class="catalogue-cell flex-column gap-2 p-3 rounded b-subtle"
    :class="{ 'catalogue-cell--mobile': mobile }"
    :data-testid="`cat-${id}`"
    :data-cat-interact="interact || null"
  >
    <slot />
    <figcaption class="fs-200 t-muted">{{ label }}</figcaption>
  </figure>
</template>

<script setup>
// One cell per variant × state (r02 §6): `id` = "<component>-<variant>-<state>", kebab-case. `interact` lists the
// states the @components layer drives on the cell ("hover", "focus", comma-separated), never faked with classes.
// `mobile` renders a mobile-only component in a 393 px frame on desktop too.
defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  interact: { type: String, default: "" },
  mobile: { type: Boolean, default: false },
});
</script>

<style lang="scss" scoped>
.catalogue-cell {
  margin: 0;
}

.catalogue-cell--mobile {
  width: 393px;
  max-width: 100%;
}
</style>
