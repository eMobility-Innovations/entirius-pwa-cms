<template>
  <section :id="id" class="catalogue-section mb-12" :aria-labelledby="`${id}-title`">
    <h2 :id="`${id}-title`" class="fs-600 mb-4">{{ title }}</h2>
    <slot />
  </section>
</template>

<script setup>
// One section per P3/P4 plan (and one per component inside it): `id` is the anchor the harness checks.
defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
});
</script>
