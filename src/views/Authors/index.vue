<template>
  <div class="authors-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "AuthorsPanel",
};
</script>

<style lang="scss" scoped>
.authors-panel {
  display: flex;
  flex-direction: column;
}
</style>
