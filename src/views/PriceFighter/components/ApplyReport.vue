<template>
  <BasicModal :open="true" size="lg" :title="$t('pricefighter.apply_report_title')" @close="onClose">
    <div class="apply-report__body">
      <div class="apply-report__buckets">
        <StatusBadge
          v-for="bucket in buckets"
          :key="bucket.key"
          :label="`${$t(`pricefighter.${bucket.key}`)}: ${safeReport[bucket.key].length}`"
          :tone="bucket.variant"
        />
      </div>

      <div v-if="safeReport.stale.length" class="apply-report__stale-note">
        <FontAwesomeIcon :icon="$icons.warning" class="mr-2" />
        {{ $t('pricefighter.stale_note') }}
      </div>

      <div v-for="bucket in buckets" :key="bucket.key" class="apply-report__bucket">
        <template v-if="safeReport[bucket.key].length">
          <h4 class="apply-report__bucket-heading">{{ $t(`pricefighter.${bucket.key}`) }}</h4>
          <DataTable :columns="columns" :rows="safeReport[bucket.key]">
            <template #cell-market="{ row }">
              <MarketCell :channel="row.channel" :country="row.country" :currency="row.currency" />
            </template>
            <template #cell-reason="{ row }">
              <span class="t-muted">{{ row.reason }}</span>
            </template>
          </DataTable>
        </template>
      </div>
    </div>
    <template #footer>
      <BasicButton variant="primary" @click="onClose">{{ $t('common.close') }}</BasicButton>
    </template>
  </BasicModal>
</template>

<script>
import MarketCell from './MarketCell.vue'
const BUCKETS = [
  { key: 'applied', variant: 'positive' },
  { key: 'clamped', variant: 'warning' },
  { key: 'skipped', variant: 'neutral' },
  { key: 'failed', variant: 'negative' },
  { key: 'stale', variant: 'negative' },
]

export default {
  name: 'ApplyReport',
  components: { MarketCell },
  props: {
    report: {
      type: Object,
      required: true,
    },
  },
  emits: ['closed'],
  data() {
    return { buckets: BUCKETS }
  },
  computed: {
    columns() {
      return [
        { key: 'sku', label: this.$t('pricefighter.sku'), width: '1fr' },
        { key: 'market', label: this.$t('pricefighter.market'), width: '1fr' },
        { key: 'expected_new_price', label: this.$t('pricefighter.suggested_price'), numeric: true },
        // The reason says why an item was skipped, clamped or failed: it wraps, never truncates (no tooltip on a phone).
        { key: 'reason', label: this.$t('pricefighter.reason'), width: '1.4fr', truncate: false },
      ]
    },
    // Defensive default — the API always returns all 5 buckets, but never trust the shape blindly.
    safeReport() {
      const r = this.report || {}
      return Object.fromEntries(BUCKETS.map((b) => [b.key, r[b.key] || []]))
    },
  },
  methods: {
    onClose() {
      this.$emit('closed')
    },
  },
}
</script>

<style lang="scss" scoped>
.apply-report__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.apply-report__buckets {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.apply-report__stale-note {
  padding: var(--space-5);
  border-radius: var(--radius-base);
  background: var(--negative-subtle);
  color: var(--negative);
  font-size: var(--fs-200);
}

.apply-report__bucket-heading {
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  margin: 0 0 var(--space-2) 0;
}
</style>
