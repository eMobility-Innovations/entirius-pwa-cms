<template>
  <FormField v-if="options.length" :label="$t('pm.channel')" layout="inline">
    <BasicSelect :model-value="channelIdx" :options="options" @update:model-value="onSelect" />
  </FormField>
</template>

<script setup>
// The panel's channel selector (PageHeader `meta` of the price views): the wrapper (index.vue) owns the channels and
// the active channel; this control only reads and sets them.
import { computed, inject, ref } from 'vue'

const channels = inject('pmChannels', ref([]))
const channelIdx = inject('pmChannelIdx', ref(''))

const options = computed(() => channels.value.map((ch) => ({ value: ch.idx, label: ch.name })))

function onSelect(value) {
  channelIdx.value = Array.isArray(value) ? value[0] : value
}
</script>
