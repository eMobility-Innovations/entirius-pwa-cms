<template>
  <div class="faq-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "FaqPanel",
};
</script>

<style lang="scss" scoped>
.faq-panel {
  display: flex;
  flex-direction: column;
}
</style>
