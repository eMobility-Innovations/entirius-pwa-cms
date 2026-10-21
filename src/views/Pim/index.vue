<template>
  <!-- One product after another (a link from one product page to the next) is a new view: same route, new SKU. -->
  <router-view :key="$route.params.sku" />
</template>

<script>
import { ref, provide } from "vue";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useQualityStore } from "@/stores/quality";

// The Pim panel: no bar of its own. Every view shows the channel selector in its PageHeader `meta`
// (PimChannelSelect); the wrapper fetches the channels once and shares the global-scope flag with it.
export default {
  name: "PimPanel",
  setup() {
    const pimChannel = usePimChannelStore();
    const quality = useQualityStore();
    const isGlobalScope = ref(false);
    provide("isGlobalScope", isGlobalScope);
    return { pimChannel, quality };
  },
  mounted() {
    this.pimChannel.fetchChannels();
    // Probe gaps capability once per panel entry (gates the quality-rules nav item).
    if (this.quality.available === null) this.quality.probe();
  },
};
</script>
