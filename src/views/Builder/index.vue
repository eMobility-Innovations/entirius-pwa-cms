<template>
  <div class="builder-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "BuilderPanel",
};
</script>

<style lang="scss" scoped>
.builder-panel {
  display: flex;
  flex-direction: column;
}
</style>
