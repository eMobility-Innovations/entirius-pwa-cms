<template>
  <div class="accounts-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "AccountsPanel",
};
</script>

<style lang="scss" scoped>
.accounts-panel {
  display: flex;
  flex-direction: column;
}
</style>
