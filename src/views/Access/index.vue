<template>
  <div class="access-panel h-100">
    <router-view :key="$route.path" />
  </div>
</template>

<script>
export default {
  name: "AccessPanel",
};
</script>

<style lang="scss" scoped>
.access-panel {
  display: flex;
  flex-direction: column;
}
</style>
