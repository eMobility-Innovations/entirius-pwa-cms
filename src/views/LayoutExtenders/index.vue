<template>
  <div class="layout-extender-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "LayoutExtenderPanel",
};
</script>

<style lang="scss" scoped>
.layout-extender-panel {
  display: flex;
  flex-direction: column;
}
</style>
