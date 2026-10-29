<template>
  <SideDrawer
    :visible="visible"
    :title="$t('enrichment.preview.title')"
    width="520px"
    @close="$emit('close')"
  >
    <ProductPreviewCard :sku="sku" :channel-idx="channelIdx" flat />
  </SideDrawer>
</template>

<script>
import ProductPreviewCard from "./ProductPreviewCard.vue";

export default {
  name: "ProductPreviewDrawer",
  components: { ProductPreviewCard },
  props: {
    visible: { type: Boolean, default: false },
    sku: { type: String, default: null },
    channelIdx: { type: String, default: "" },
  },
  emits: ["close"],
};
</script>
