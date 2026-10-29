<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!embedded" #header>
      <PageHeader :title="effectiveSku || $t('pm.price_detail')" back="/pricing/prices">
        <template #meta>
          <PmChannelSelect />
        </template>
        <template v-if="showActions" #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else>
        <EmptyState
          v-if="productNotFound"
          :title="$t('pm.no_price_for_product')"
          :message="configurable ? $t('pm.prices_per_variant') : $t('pm.no_price_for_product')"
          icon="tag"
        />

        <template v-else>
          <!-- Top bar: currency selector + meta info -->
          <div class="flex ai-ct gap-8 mb-10 flex-wrap">
            <FormField :label="$t('pm.currency')">
              <BasicSelect
                :model-value="activeCurrency"
                :options="currencyOptions"
                @update:model-value="onCurrencyChange"
              />
            </FormField>
            <div class="pm-meta-item">
              <span class="field-label">{{ $t('pm.country') }}</span>
              <span class="fw-600">{{ flatPrice?.country || defaultCountryIso || '—' }}</span>
            </div>
            <div class="pm-meta-item">
              <span class="field-label">{{ $t('pm.direction') }}</span>
              <span>{{ isNetEditable ? $t('pm.from_net_to_gross') : $t('pm.from_gross_to_net') }}</span>
            </div>
            <div v-if="sourceBadge" class="pm-meta-item">
              <span class="field-label">{{ $t('pm.source_label') }}</span>
              <span class="flex ai-ct gap-2">
                <StatusBadge :label="sourceBadge.label" :tone="sourceBadge.variant" />
              </span>
            </div>
            <div v-if="flatPurchaseCost" class="pm-meta-item">
              <span class="field-label">{{ $t('pm.purchase_cost') }}</span>
              <span class="flex ai-ct gap-2">
                <span class="t-body fw-600">{{ flatPurchaseCost.net_cost }} {{ flatPurchaseCost.currency }}</span>
                <span v-if="flatPurchaseCost.supplier_idx" class="t-muted fs-200">
                  · {{ flatPurchaseCost.supplier_idx }}
                </span>
                <StatusBadge
                  v-if="marginPercent !== null"
                  :label="$t('pm.margin_percent', { value: marginPercent })"
                  :tone="Number(marginPercent) > 0 ? 'positive' : 'negative'"
                />
                <span v-else-if="!flatPrice" class="t-warning fs-200">{{ $t('pm.unpriced_hint') }}</span>
              </span>
            </div>
          </div>

          <!-- Editable row -->
          <BasicCard :title="$t('pm.price_detail')" gap class="mb-8">
            <div class="form-grid">
              <!-- Editable price (net or gross depending on direction) -->
              <FormField
                :label="isNetEditable ? $t('pm.net') : $t('pm.gross')"
                required
                :error="formErrors.getFieldError('value')?.msg || ''"
              >
                <BasicInput v-model="form.value" format="money" />
              </FormField>

              <!-- Calculated price (read-only) -->
              <FormField :label="isNetEditable ? $t('pm.gross') : $t('pm.net')">
                <BasicInput
                  :model-value="flatPrice ? fmt2(isNetEditable ? flatPrice.gross : flatPrice.net) : '—'"
                  readonly
                />
              </FormField>

              <!-- Special price -->
              <FormField
                :label="$t('pm.special_net')"
                :error="formErrors.getFieldError('special_value')?.msg || ''"
              >
                <BasicInput v-model="form.special_value" format="money" />
              </FormField>

              <!-- Promo dates -->
              <FormField :label="$t('pm.special_from')">
                <BasicDatePicker v-model="form.special_from_date" />
              </FormField>
              <FormField :label="$t('pm.special_to')">
                <BasicDatePicker v-model="form.special_to_date" />
              </FormField>
            </div>
          </BasicCard>

          <!-- Embedded (Pim product tab): no page header, the actions sit under the form -->
          <ActionBar v-if="embedded" class="mb-8" :actions="headerActions" />

          <!-- Confirmation modals -->
          <ConfirmDialog
            tone="danger"
            :open="showFlushConfirm"
            @confirm="flushSpecial"
            @cancel="showFlushConfirm = false"
            :title="$t('pm.flush_special')"
          >
            <template #default><p>{{ $t('pm.flush_special_confirm') }}</p></template>
          </ConfirmDialog>

          <ConfirmDialog
            tone="danger"
            :open="showDeleteConfirm"
            @confirm="deletePrices"
            @cancel="showDeleteConfirm = false"
            :title="$t('pm.delete_prices')"
          >
            <template #default><p>{{ $t('pm.delete_prices_confirm') }}</p></template>
          </ConfirmDialog>

          <!-- All-countries breakdown (collapsible) -->
          <BasicCard v-if="showCountries" :title="$t('pm.all_countries')" gap class="mb-8">
            <div class="pm-country-table">
              <div class="pm-country-table__head">
                <span>{{ $t('pm.country') }}</span>
                <span>{{ $t('pm.currency') }}</span>
                <span>{{ $t('pm.tax_rate') }}</span>
                <span>{{ $t('pm.net') }}</span>
                <span>{{ $t('pm.gross') }}</span>
                <span>{{ $t('pm.special') }}</span>
              </div>
              <div
                v-for="row in filteredCountries"
                :key="row.country"
                class="pm-country-table__row"
              >
                <span class="fw-600">{{ row.country }}</span>
                <span>{{ row.currency }}</span>
                <span>{{ row.tax_rate }}</span>
                <span>{{ fmt2(row.net) }}</span>
                <span>{{ fmt2(row.gross) }}</span>
                <span class="t-muted">
                  {{ fmt2(row.special_net) || '—' }}
                  <template v-if="row.special_gross"> → {{ fmt2(row.special_gross) }}</template>
                </span>
              </div>
            </div>
          </BasicCard>

          <!-- History (collapsible) -->
          <BasicCard v-if="showHistory" :title="$t('pm.history')" gap class="mb-8">
            <Loader v-if="historyLoading" />
            <EmptyState v-else-if="!history.length" icon="empty" size="sm" :title="$t('pm.no_history')" />
            <div
              v-for="entry in history"
              :key="entry.id"
              class="pm-history-row flex ai-ct gap-5"
            >
              <span class="t-muted fs-200">{{ formatDate(entry.created_at) }}</span>
              <span class="fw-600">{{ entry.country }}</span>
              <span>{{ entry.source }} — gross: {{ entry.gross_value }}, net: {{ entry.net_value }}</span>
              <span class="t-muted fs-200">{{ entry.changed_by }}</span>
            </div>
          </BasicCard>
        </template>
      </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from '@/stores/loader'
import { useNotifyStore } from '@/stores/notify'
import { useFormErrors, extractApiMessage } from '@/composables/useFormErrors'
import { isNotFound } from '@/api/createClient'
import { GET_PmPriceDetail, GET_PmPrices, PATCH_PmPrice, DELETE_PmPrice, POST_PmFlushSpecial, GET_PmPriceHistory } from '@/api/pricemanager/api'
import { formatDate } from '@/utils/format'
import PmChannelSelect from './PmChannelSelect.vue'

const PRICE_FORMATS = { value: { format: 'money' }, special_value: { format: 'money' } }

export default {
  name: 'PmPriceDetail',
  components: { PmChannelSelect },
  inject: {
    pmChannelIdx: { default: null },
    pmActiveChannel: { default: null },
  },
  props: {
    sku: { type: String, default: null },
    channelIdxProp: { type: String, default: null },
    embedded: { type: Boolean, default: false },
    // A configurable product has no prices of its own: they live on its variants.
    configurable: { type: Boolean, default: false },
  },
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    const formErrors = useFormErrors()
    return { loader, notify, formErrors }
  },
  data() {
    return {
      allCountries: [],
      purchaseCosts: [],
      loading: false,
      productNotFound: false,
      showCountries: false,
      showHistory: false,
      showFlushConfirm: false,
      showDeleteConfirm: false,
      historyLoading: false,
      history: [],
      activeCurrency: '',
      availableCurrencies: [],
      form: {
        value: '',
        special_value: '',
        special_from_date: null,
        special_to_date: null,
      },
    }
  },
  computed: {
    // The price actions exist once the product's prices loaded (not while loading, not for an unknown product).
    showActions() {
      return !this.loading && !this.productNotFound
    },
    headerActions() {
      return [
        { key: 'countries', role: 'secondary', onClick: () => (this.showCountries = !this.showCountries),
          label: this.showCountries ? this.$t('pm.hide_countries') : this.$t('pm.view_all_countries') },
        { key: 'history', role: 'secondary', onClick: this.toggleHistory,
          label: this.showHistory ? this.$t('pm.hide_history') : this.$t('pm.view_history') },
        { key: 'flush', role: 'utility', icon: 'clear', variant: 'danger', label: this.$t('pm.flush_special'),
          onClick: () => (this.showFlushConfirm = true) },
        { key: 'delete', role: 'utility', icon: 'delete', variant: 'danger', label: this.$t('pm.delete_prices'),
          onClick: () => (this.showDeleteConfirm = true) },
        { key: 'save', role: 'primary', label: this.$t('pm.save'), onClick: this.save },
      ]
    },
    effectiveSku() {
      return this.sku || this.$route?.params?.sku || ''
    },
    effectiveChannelIdx() {
      if (this.channelIdxProp) return this.channelIdxProp
      const v = this.pmChannelIdx
      return (typeof v === 'object' && v !== null) ? (v.value || '') : (v || '')
    },
    isNetEditable() {
      const ch = this.pmActiveChannel
      const obj = (typeof ch === 'object' && ch !== null && 'value' in ch) ? ch.value : ch
      return (obj?.calculate_direction || 'from_net_to_gross') === 'from_net_to_gross'
    },
    defaultCountryIso() {
      const ch = this.pmActiveChannel
      const obj = (typeof ch === 'object' && ch !== null && 'value' in ch) ? ch.value : ch
      return obj?.default_country || ''
    },
    flatPrice() {
      if (!this.allCountries.length || !this.activeCurrency) return null
      const rows = this.allCountries.filter((r) => r.currency === this.activeCurrency)
      if (!rows.length) return null
      const dc = this.defaultCountryIso
      if (dc) {
        const match = rows.find((r) => r.country === dc)
        if (match) return match
      }
      return rows[0]
    },
    filteredCountries() {
      if (!this.activeCurrency) return this.allCountries
      return this.allCountries.filter((r) => r.currency === this.activeCurrency)
    },
    flatPurchaseCost() {
      // Purchase cost is in the supplier's currency and is INDEPENDENT of the sell-price
      // currency selector — show it regardless of activeCurrency (no 1:1 relation).
      if (!this.purchaseCosts.length) return null
      const dc = this.defaultCountryIso
      if (dc) {
        const match = this.purchaseCosts.find((r) => r.country === dc)
        if (match) return match
      }
      return this.purchaseCosts[0]
    },
    marginPercent() {
      // Margin only makes sense when sell and cost share a currency (no FX conversion here).
      const pc = this.flatPurchaseCost
      const price = this.flatPrice
      if (!pc || !price || price.currency !== pc.currency) return null
      const net = Number(price.net)
      const cost = Number(pc.net_cost)
      if (!net || Number.isNaN(net) || Number.isNaN(cost)) return null
      return (((net - cost) / net) * 100).toFixed(1)
    },
    currencyOptions() {
      return this.availableCurrencies.map((code) => ({ value: code, label: code }))
    },
    sourceBadge() {
      const src = this.flatPrice?.source
      if (!src) return null
      const labels = {
        admin_edit: { key: 'pm.source_admin_edit', variant: 'neutral' },
        csv_import: { key: 'pm.source_csv_import', variant: 'neutral' },
        api: { key: 'pm.source_api', variant: 'neutral' },
        generation: { key: 'pm.source_generation', variant: 'neutral' },
        tax_rate_change: { key: 'pm.source_tax_rate_change', variant: 'neutral' },
        migration: { key: 'pm.source_migration', variant: 'neutral' },
        migration_backfill: { key: 'pm.source_migration', variant: 'neutral' },
      }
      const entry = labels[src]
      if (!entry) return { label: src, variant: 'neutral' }
      return { label: this.$t(entry.key), variant: entry.variant }
    },
  },
  watch: {
    effectiveChannelIdx(val) {
      if (val && this.effectiveSku) this.fetchDetail()
    },
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors()
      },
    },
  },
  mounted() {
    if (this.effectiveChannelIdx && this.effectiveSku) this.fetchDetail()
  },
  methods: {
    formatDate,
    async fetchDetail() {
      this.loading = true
      this.productNotFound = false
      try {
        const { data } = await GET_PmPriceDetail(this.effectiveChannelIdx, this.effectiveSku)
        const countries = data.prices || data.countries || data.results || []
        this.allCountries = countries
        this.purchaseCosts = data.purchase_costs || []

        // Extract currencies from existing prices + purchase costs, then merge with channel currencies.
        // Including purchase-cost currencies means an unpriced product still surfaces its cost.
        const existingCurrencies = new Set(countries.map((r) => r.currency).filter(Boolean))
        this.purchaseCosts.forEach((pc) => pc.currency && existingCurrencies.add(pc.currency))
        await this.fetchChannelCurrencies()
        // Merge: existing first (for this product), then any other channel currencies
        const merged = new Set([...existingCurrencies, ...this.availableCurrencies])
        this.availableCurrencies = [...merged]

        if (this.availableCurrencies.length) {
          if (!this.activeCurrency || !this.availableCurrencies.includes(this.activeCurrency)) {
            this.activeCurrency = this.availableCurrencies[0]
          }
        }
        this.syncFormToPrice()
      } catch (err) {
        if (isNotFound(err)) {
          this.productNotFound = true
        } else {
          this.notify.spawnNotification({
            type: 'negative',
            msg: extractApiMessage(err, this.$t('notifications.error')),
          })
        }
      } finally {
        this.loading = false
      }
    },
    async fetchChannelCurrencies() {
      try {
        const { data } = await GET_PmPrices(this.effectiveChannelIdx, { page_size: 100 })
        const results = data.results || []
        const seen = new Set()
        results.forEach((p) => {
          const countries = p.countries || []
          countries.forEach((c) => { if (c.currency) seen.add(c.currency) })
          if (p.currency) seen.add(p.currency)
        })
        this.availableCurrencies = [...seen].sort()
        if (this.availableCurrencies.length && !this.activeCurrency) {
          this.activeCurrency = this.availableCurrencies[0]
        }
      } catch {
        // silent — currencies dropdown will be empty
      }
    },
    fmt2(val) {
      if (val == null || val === '') return ''
      const num = Number(val)
      return isNaN(num) ? '' : num.toFixed(2)
    },
    syncFormToPrice() {
      const price = this.flatPrice
      if (price) {
        this.form.value = this.fmt2(this.isNetEditable ? price.net : price.gross)
        this.form.special_value = this.fmt2(price.special_net || price.special_gross)
        this.form.special_from_date = price.special_from_date || null
        this.form.special_to_date = price.special_to_date || null
      } else {
        this.form.value = ''
        this.form.special_value = ''
        this.form.special_from_date = null
        this.form.special_to_date = null
      }
    },
    onCurrencyChange(selected) {
      this.activeCurrency = Array.isArray(selected) ? selected[0] : selected
      this.syncFormToPrice()
    },
    async toggleHistory() {
      this.showHistory = !this.showHistory
      if (this.showHistory && !this.history.length) await this.fetchHistory()
    },
    async fetchHistory() {
      this.historyLoading = true
      try {
        const { data } = await GET_PmPriceHistory(this.effectiveChannelIdx, this.effectiveSku)
        this.history = data.results || data || []
      } catch {
        this.history = []
      } finally {
        this.historyLoading = false
      }
    },
    async save() {
      const valid = this.formErrors.validateRequired(this.form, {
        value: this.isNetEditable ? this.$t('pm.net') : this.$t('pm.gross'),
      })
      if (!valid || !this.formErrors.validateFormats(this.form, PRICE_FORMATS)) return

      this.loader.loaderStart()
      try {
        const value = String(this.form.value).replace(',', '.').trim()
        const specialRaw = this.form.special_value ? String(this.form.special_value).replace(',', '.').trim() : ''
        const payload = {
          value,
          currency_code: this.activeCurrency || this.flatPrice?.currency || 'EUR',
        }
        // Send special_value: null to explicitly clear promo, or the value if set
        const hadSpecial = this.flatPrice?.special_net || this.flatPrice?.special_gross
        if (specialRaw) {
          payload.special_value = specialRaw
        } else if (hadSpecial) {
          payload.special_value = null
        }
        if (this.form.special_from_date) payload.special_from_date = this.form.special_from_date
        if (this.form.special_to_date) payload.special_to_date = this.form.special_to_date

        await PATCH_PmPrice(this.effectiveChannelIdx, this.effectiveSku, payload)
        this.notify.spawnNotification({ type: 'positive', msg: this.$t('notifications.success') })
        await this.fetchDetail()
        if (this.showHistory) {
          this.history = []
          await this.fetchHistory()
        }
      } catch (err) {
        this.formErrors.handleApiError(err)
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.save_error')),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
    async flushSpecial() {
      this.showFlushConfirm = false
      this.loader.loaderStart()
      try {
        await POST_PmFlushSpecial(this.effectiveChannelIdx, this.effectiveSku, this.activeCurrency)
        this.notify.spawnNotification({ type: 'positive', msg: this.$t('notifications.success') })
        await this.fetchDetail()
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
    async deletePrices() {
      this.showDeleteConfirm = false
      this.loader.loaderStart()
      try {
        await DELETE_PmPrice(this.effectiveChannelIdx, this.effectiveSku, this.activeCurrency)
        this.notify.spawnNotification({ type: 'positive', msg: this.$t('notifications.success') })
        await this.fetchDetail()
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.pm-meta-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pm-country-table {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  overflow: hidden;
}

.pm-country-table__head {
  display: grid;
  grid-template-columns: 60px 60px 70px 1fr 1fr 1fr;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  background: var(--surface-raised);
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}

.pm-country-table__row {
  display: grid;
  grid-template-columns: 60px 60px 70px 1fr 1fr 1fr;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  border-top: 1px solid var(--border-subtle);
  align-items: center;
}

.pm-history-row {
  padding: var(--space-2) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--fs-200);
}
</style>
