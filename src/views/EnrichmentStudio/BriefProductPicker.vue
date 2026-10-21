<template>
  <EntitySearchPicker
    :model-value="modelValue?.ref || null"
    :display-value="modelValue?.label || ''"
    :fetch-fn="search"
    :placeholder="$t('enrichment.studio.product_search')"
    data-testid="brief-product-picker"
    @update:model-value="pick"
    @update:display-value="label = $event"
    @clear="$emit('update:modelValue', null)"
  />
</template>

<script>
import { GET_Products } from "@/api/pim/api";
import { usePimChannelStore } from "@/stores/pimChannel";

// A brief's product (`x-picker: "pim-product"`): a search over the PIM products of the active PIM channel. The value
// is `{ channel, ref: sku, label: name }` — the server checks at start that the product exists and has a picture.
export default {
  name: "BriefProductPicker",
  props: {
    modelValue: { type: Object, default: null },
  },
  emits: ["update:modelValue"],
  setup() {
    return { pimChannel: usePimChannelStore() };
  },
  data() {
    return { label: "" };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx || this.pimChannel.defaultChannelIdx || "";
    },
  },
  mounted() {
    if (!this.pimChannel.channels?.length) this.pimChannel.fetchChannels?.();
  },
  methods: {
    async search(query) {
      if (!this.channelIdx) return [];
      try {
        const params = { page_size: 20, ...(query ? { search: query } : {}) };
        const { data } = await GET_Products(this.channelIdx, params);
        return (data?.results || data || []).map((p) => ({ value: p.sku, label: p.name || p.sku, secondary: p.sku }));
      } catch {
        return [];
      }
    },
    // The picker sends the label right after the value: wait for it, so the brief keeps the product's name.
    async pick(sku) {
      if (!sku) return this.$emit("update:modelValue", null);
      await this.$nextTick();
      this.$emit("update:modelValue", { channel: this.channelIdx, ref: sku, label: this.label || sku });
    },
  },
};
</script>
