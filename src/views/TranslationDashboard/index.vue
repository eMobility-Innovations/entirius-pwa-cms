<template>
  <div class="translation-panel h-100">
    <router-view class="fs-300 t-body" />
  </div>
</template>

<script>
import { usePimChannelStore } from "@/stores/pimChannel";

// The Translation panel: the channel selector and the store-wide translation in the dashboard's PageHeader read the
// channels from the store, so the wrapper fetches them once on entry (the Pim panel does the same for its views).
export default {
  name: "TranslationPanel",
  setup() {
    return { pimChannel: usePimChannelStore() };
  },
  mounted() {
    this.pimChannel.fetchChannels();
  },
};
</script>

<style lang="scss" scoped>
.translation-panel {
  display: flex;
  flex-direction: column;
}
</style>
