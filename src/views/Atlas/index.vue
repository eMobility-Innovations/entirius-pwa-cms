<template>
  <div class="suppliers-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "SuppliersPanel",
};
</script>

<style lang="scss" scoped>
.suppliers-panel {
  display: flex;
  flex-direction: column;
}
</style>
