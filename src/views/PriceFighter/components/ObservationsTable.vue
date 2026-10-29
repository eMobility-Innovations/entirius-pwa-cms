<template>
  <DataTable :columns="columns" :rows="observations" :empty-text="$t('pricefighter.no_observations')">
    <!-- An invalid observation is a muted row: every value cell, not only its badge (DataTable has no row class). -->
    <template #cell-source_idx="{ row }">
      <span :class="mutedClass(row)">{{ row.source_idx }}</span>
    </template>
    <template #cell-price="{ row }">
      <span :class="mutedClass(row)">{{ row.price }} {{ row.currency || '' }}</span>
    </template>
    <template #cell-stock="{ row }">
      <span :class="mutedClass(row)">{{ row.stock != null ? row.stock : '—' }}</span>
    </template>
    <template #cell-ts="{ row }">
      <span :class="mutedClass(row)">{{ formatDate(row.ts) }}</span>
    </template>
    <template #cell-flag="{ row }">
      <StatusBadge
        :label="$t(`pricefighter.flag_${row.flag}`)"
        :tone="row.flag === 'valid' ? 'positive' : 'neutral'"
      />
    </template>
  </DataTable>
</template>

<script setup>
// Competitor observations of one decision: the gap row detail and a history entry's snapshot.
import { computed } from 'vue'
import { t } from '@/i18n'
import { formatDate } from '@/utils/format'

defineProps({
  observations: {
    type: Array,
    required: true,
  },
})

const mutedClass = (row) => (row.flag === 'valid' ? null : 't-muted')

const columns = computed(() => [
  { key: 'source_idx', label: t('pricefighter.source'), width: '1.2fr' },
  { key: 'price', label: t('pricefighter.price'), width: '1fr', numeric: true },
  { key: 'stock', label: t('pricefighter.stock'), width: '0.6fr', numeric: true, priority: 2 },
  { key: 'ts', label: t('pricefighter.observed_at'), width: '1.2fr', priority: 2 },
  { key: 'flag', label: t('pricefighter.status'), width: 'max-content' },
])
</script>
