<template>
  <BasicModal :open="true" size="lg" :title="$t('pricefighter.apply_preview_title', { count: items.length })" @close="onCancel">
    <div class="apply-preview__body">
      <DataTable :columns="columns" :rows="items" row-key="_rowKey">
        <template #cell-market="{ row }">
          <MarketCell :channel="row.channel_idx" :country="row.country" :currency="row.currency" />
        </template>
        <template #cell-suggested_price="{ row }">
          <span class="fw-600">{{ row.suggested_price }}</span>
        </template>
        <template #cell-clamps="{ row }">
          <StatusBadge v-if="row.clamped_floor" :label="$t('pricefighter.clamped_floor')" tone="warning" />
          <StatusBadge v-if="row.clamped_step" :label="$t('pricefighter.clamped_step')" tone="warning" />
        </template>
      </DataTable>

      <div v-if="errorText" class="apply-preview__error t-negative fs-200">
        <FontAwesomeIcon :icon="$icons.warning" class="mr-2" />
        {{ errorText }}
      </div>

    </div>
    <template #footer>
      <BasicButton
        variant="secondary"
        :disabled="loading"
        @click="onCancel"
      >
        {{ $t('common.cancel') }}
      </BasicButton>
      <BasicButton
        variant="primary"
        :disabled="loading || !items.length"
        @click="onConfirm"
      >
        {{ loading ? $t('pricefighter.applying') : $t('pricefighter.confirm_apply') }}
      </BasicButton>
    </template>
  </BasicModal>
</template>

<script>
import MarketCell from './MarketCell.vue'
import { POST_PfApply } from '@/api/pricefighter/api'
import { extractApiMessage } from '@/composables/useFormErrors'

export default {
  name: 'ApplyPreviewModal',
  components: { MarketCell },
  props: {
    items: {
      type: Array,
      required: true,
    },
  },
  emits: ['applied', 'cancelled'],
  data() {
    return {
      loading: false,
      errorText: '',
    }
  },
  computed: {
    columns() {
      return [
        { key: 'sku', label: this.$t('pricefighter.sku'), width: '1fr' },
        { key: 'market', label: this.$t('pricefighter.market'), width: '1fr' },
        { key: 'current_price', label: this.$t('pricefighter.current_price'), numeric: true },
        { key: 'suggested_price', label: this.$t('pricefighter.suggested_price'), numeric: true },
        { key: 'clamps', label: this.$t('pricefighter.status'), width: 'max-content' },
      ]
    },
  },
  methods: {
    onCancel() {
      if (this.loading) return
      this.$emit('cancelled')
    },
    async onConfirm() {
      if (this.loading || !this.items.length) return
      this.loading = true
      this.errorText = ''
      try {
        const payload = {
          items: this.items.map((item) => ({
            sku: item.sku,
            market: { channel: item.channel_idx, country: item.country, currency: item.currency },
            expected_new_price: item.suggested_price,
          })),
        }
        const { data } = await POST_PfApply(payload)
        this.$emit('applied', data)
      } catch (err) {
        this.errorText = extractApiMessage(err, this.$t('notifications.save_error'))
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.apply-preview__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.apply-preview__error {
  padding: var(--space-5);
  border-radius: var(--radius-base);
  background: var(--negative-subtle);
  border-left: 3px solid var(--negative);
}
</style>
