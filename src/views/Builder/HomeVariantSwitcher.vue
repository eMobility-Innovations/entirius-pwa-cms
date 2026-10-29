<template>
  <FormField class="home-switcher" :label="$t('builder.home_variant')" layout="inline">
    <BasicSelect
      :model-value="currentChannel"
      :options="options"
      placeholder="—"
      @update:model-value="onSelect"
    />
  </FormField>
</template>

<script>
import { _METHOD_content } from "@/api/contentDB/api";

export default {
  name: "HomeVariantSwitcher",
  props: {
    contentType: { type: String, required: true },
    type: { type: String, required: true },
    currentUid: { type: String, default: null },
    currentChannel: { type: String, default: null },
    availableChannels: { type: Array, default: () => [] },
  },
  emits: ["switch"],
  data() {
    return {
      variants: {},
    };
  },
  computed: {
    // One option per channel; the description says whether its home is this one, exists, or gets created.
    options() {
      return this.availableChannels.map((ch) => ({
        label: ch.name || ch.idx,
        value: ch.idx,
        description: this.$t(`builder.home_${this.variantState(ch.idx)}`),
      }));
    },
  },
  watch: {
    contentType: { immediate: true, handler: "loadVariants" },
    type: { immediate: true, handler: "loadVariants" },
  },
  methods: {
    isCurrent(channel_idx) {
      return channel_idx === this.currentChannel;
    },
    variantState(channel_idx) {
      if (this.isCurrent(channel_idx)) return "current";
      return this.variants[channel_idx] ? "exists" : "create";
    },
    async loadVariants() {
      if (!this.contentType || !this.type) return;
      try {
        const { data: response } = await _METHOD_content({
          method: "get",
          url: `/${this.contentType}/${this.type}/`,
          params: { routes: ["home"] },
        });
        const list = response?.data || [];
        const map = {};
        list.forEach((draft) => {
          (draft.channels || []).forEach((ch_idx) => {
            map[ch_idx] = { uid: draft.uid, name: draft.name };
          });
        });
        this.variants = map;
      } catch (error) {
        console.warn("HomeVariantSwitcher: failed to load variants", error);
      }
    },
    onSelect(channel_idx) {
      if (this.isCurrent(channel_idx)) return;
      this.$emit("switch", {
        channel_idx,
        target_uid: this.variants[channel_idx]?.uid || null,
      });
    },
  },
};
</script>
