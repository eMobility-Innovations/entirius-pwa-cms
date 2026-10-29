<template>
  <div class="forms-panel h-100">
    <router-view />
  </div>
</template>

<script>
export default {
  name: "ContactFormsPanel",
};
</script>

<style lang="scss" scoped>
.forms-panel {
  display: flex;
  flex-direction: column;
}
</style>
