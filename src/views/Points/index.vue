<template>
  <div class="points-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "PointsPanel",
};
</script>

<style lang="scss" scoped>
.points-panel {
  display: flex;
  flex-direction: column;
}
</style>
