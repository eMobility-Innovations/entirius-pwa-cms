<template>
  <div class="reviews-panel h-100">
    <div class="reviews-panel__toolbar flex ai-ct jc-sb bg-basic-200 fs-300">
      <div id="reviews-toolbar-left" class="flex ai-ct gap-200"></div>
      <div id="reviews-toolbar-right" class="flex ai-ct gap-200"></div>
    </div>
    <router-view />
  </div>
</template>

<script>
export default {
  name: "ReviewsPanel",
};
</script>

<style lang="scss" scoped>
.reviews-panel {
  display: flex;
  flex-direction: column;
}

.reviews-panel__toolbar {
  padding: 8px 20px;
  border-bottom: 1px solid var(--c-basic-300);
  flex-shrink: 0;
}
</style>
