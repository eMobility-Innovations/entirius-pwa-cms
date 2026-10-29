<template>
  <div class="promo-panel h-100">
    <router-view />
  </div>
</template>

<script>
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";

export default {
  name: "PromoPanel",
  setup() {
    const checkoutChannel = useCheckoutChannelStore();
    return { checkoutChannel };
  },
  mounted() {
    this.checkoutChannel.fetchChannels();
  },
};
</script>

<style lang="scss" scoped>
.promo-panel {
  display: flex;
  flex-direction: column;
}
</style>
