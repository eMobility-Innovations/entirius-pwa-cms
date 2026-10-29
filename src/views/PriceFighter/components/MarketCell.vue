<template>
  <span class="market-cell">
    <span>{{ country }} · {{ currency }}</span>
    <span class="market-cell__channel t-muted fs-200">{{ channel }}</span>
  </span>
</template>

<script setup>
// The market of a PriceFighter row. The channel keeps its own line: rows that differ only by channel stay apart
// at a glance, and a narrow column never cuts it off.
defineProps({
  channel: { type: String, default: '' },
  country: { type: String, default: '' },
  currency: { type: String, default: '' },
})
</script>

<style lang="scss" scoped>
.market-cell {
  display: flex;
  flex-direction: column;
}

.market-cell__channel {
  overflow-wrap: anywhere;
}
</style>
