<template>
  <FormField :label="$t('promo.channel')" layout="inline">
    <BasicSelect
      :options="options"
      :model-value="checkoutChannel.activeChannelIdx"
      :placeholder="$t('promo.select_channel')"
      @update:model-value="checkoutChannel.setActiveChannel"
    />
  </FormField>
</template>

<script setup>
// The panel's channel selector (PageHeader `meta` of the Promo list): it scopes which channel's rules and vouchers
// the list shows. The create/edit form carries its own Channels field, so it has no selector.
import { computed } from "vue";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";

const checkoutChannel = useCheckoutChannelStore();

// Before the channels load, the active idx is the one option, so the control never shows an empty value.
const options = computed(() => {
  const { channels, activeChannelIdx } = checkoutChannel;
  if (!channels.length) return [{ label: activeChannelIdx, value: activeChannelIdx }];
  return channels.map((ch) => ({ label: ch.name || ch.idx, value: ch.idx }));
});
</script>
