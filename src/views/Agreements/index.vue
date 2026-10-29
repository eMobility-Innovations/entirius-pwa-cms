<template>
  <div class="agreements-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "AgreementsPanel",
};
</script>

<style lang="scss" scoped>
.agreements-panel {
  display: flex;
  flex-direction: column;
}
</style>
