<template>
  <div class="pm-panel h-100">
    <router-view />
  </div>
</template>

<script setup>
import { ref, computed, provide, onMounted } from 'vue'
import { GET_PmChannels } from '@/api/pricemanager/api'

// The panel's channels and the active one, read by the price views and set by PmChannelSelect.
const channels = ref([])
const activeChannelIdx = ref('')

const activeChannel = computed(() =>
  channels.value.find((ch) => ch.idx === activeChannelIdx.value) || null
)

onMounted(async () => {
  try {
    const { data } = await GET_PmChannels()
    channels.value = Array.isArray(data) ? data : data.results || []
    if (channels.value.length) activeChannelIdx.value = channels.value[0].idx
  } catch {
    // child views handle the empty state
  }
})

provide('pmChannelIdx', activeChannelIdx)
provide('pmChannels', channels)
provide('pmActiveChannel', activeChannel)
</script>

<style lang="scss" scoped>
.pm-panel {
  display: flex;
  flex-direction: column;
}
</style>
