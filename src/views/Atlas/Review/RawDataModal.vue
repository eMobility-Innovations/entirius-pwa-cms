<template>
  <BasicModal
    :open="visible"
    size="lg"
    :title="$t('atlas.review.raw_data_title')"
    @close="$emit('close')"
  >
    <pre class="raw-json bg-sunken t-body p-4 rounded" data-testid="raw-data-modal">{{ formatted }}</pre>
  </BasicModal>
</template>

<script>
export default {
  name: "RawDataModal",
  props: {
    visible: { type: Boolean, default: false },
    product: { type: Object, default: null },
  },
  emits: ["close"],
  computed: {
    formatted() {
      if (!this.product) return "";
      return JSON.stringify(this.product, null, 2);
    },
  },
};
</script>

<style lang="scss" scoped>
.raw-json {
  margin: 0;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-200);
  line-height: 1.4;
  white-space: pre;
}
</style>
