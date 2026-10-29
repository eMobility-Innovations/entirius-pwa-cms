<template>
  <div class="orders-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "CheckoutOrdersPanel",
};
</script>

<style lang="scss" scoped>
.orders-panel {
  display: flex;
  flex-direction: column;
}
</style>
