<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pm.prices')">
        <template #meta>
          <PmChannelSelect />
        </template>
        <template v-if="dirtyCount > 0" #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge :label="unsavedLabel" tone="warning" />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>

    <template #toolbar>
      <div class="price-list__toolbar">
        <!-- Currency multi-select -->
        <BasicSelect
          :floating-label="`${$t('pm.currency')} (${selectedCurrencies.length}/${availableCurrencies.length})`"
          v-if="availableCurrencies.length"
          :model-value="selectedCurrencies"
          :options="currencyOptions"
          multiple
          class="price-list__currency"
          @update:model-value="onCurrenciesPick"
        />

        <!-- Default country (read-only) -->
        <span v-if="defaultCountry" class="price-list__country-label t-muted fs-200">
          {{ $t('pm.default_country_label', { country: defaultCountry }) }}
        </span>

        <!-- Search -->
        <BasicInput
          v-model="search"
          :placeholder="$t('pm.search_sku')"
          icon="search"
          class="price-list__search"
          @input="debouncedFetch(doSearch)"
        />

        <!-- Filter chips -->
        <div class="filter-chip-row" role="group" :aria-label="$t('pm.price_filter')">
          <FilterChip
            :label="$t('pm.all_products')"
            :active="activeFilter === 'all'"
            @click="setFilter('all')"
          />
          <FilterChip
            :label="$t('pm.with_price')"
            :active="activeFilter === 'with_price'"
            @click="setFilter('with_price')"
          />
          <FilterChip
            :label="$t('pm.without_price')"
            :active="activeFilter === 'without_price'"
            @click="setFilter('without_price')"
          />
        </div>
      </div>
    </template>

      <Loader block v-show="loading" />

      <div v-show="!loading">
        <EmptyState
          v-if="!channelIdx"
          :title="$t('pm.select_channel')"
          :message="$t('pm.select_channel')"
          icon="tag"
        />

        <p v-else-if="!rows.length && !loading" class="t-muted fs-300">
          {{ $t('pm.no_prices') }}
        </p>

        <template v-else>
          <!-- Table header -->
          <div class="pm-price-table">
            <div class="pm-price-table__head">
              <span>{{ $t('pm.sku') }}</span>
              <span>{{ $t('pm.tax_class') }}</span>
              <span>{{ $t('pm.currency') }}</span>
              <span>{{ isNetEditable ? $t('pm.net') : $t('pm.gross') }}</span>
              <span>{{ isNetEditable ? $t('pm.gross') : $t('pm.net') }}</span>
              <span>{{ $t('pm.special_net') }}</span>
              <span>{{ $t('pm.special_gross') }}</span>
              <span>{{ $t('pm.special_from') }}</span>
              <span>{{ $t('pm.special_to') }}</span>
              <span></span>
              <span></span>
            </div>

            <template v-for="row in rows" :key="row.sku + '|' + (row.currency || '')">
              <!-- Main row -->
              <div
                class="pm-price-table__row"
                :class="{ 'pm-price-table__row--dirty': dirtyRows.has(rowKey(row)) }"
              >
                <!-- SKU -->
                <router-link :to="detailPath(row.sku)" class="fw-600 t-accent text-truncate">
                  {{ row.sku }}
                </router-link>

                <!-- Tax Class -->
                <span class="t-muted fs-200">{{ row.tax_class || '—' }}</span>

                <!-- Currency -->
                <span class="fw-600 fs-200">{{ row.currency || activeCurrency }}</span>

                <!-- Net -->
                <FormField class="pm-price-input" :error="cellError(row, 'value')">
                  <BasicInput
                    :modelValue="getDirtyField(rowKey(row), 'value', primaryValue(row))"
                    format="money"
                    @update:model-value="setDirty(rowKey(row), 'value', $event, row)"
                  />
                </FormField>

                <!-- Calculated: Gross (or Net), read-only -->
                <span class="t-muted">{{ formatPrice(calculatedValue(row)) }}</span>

                <!-- Special -->
                <FormField class="pm-price-input" :error="cellError(row, 'special_value')">
                  <BasicInput
                    :modelValue="getDirtyField(rowKey(row), 'special_value', specialValue(row))"
                    format="money"
                    @update:model-value="setDirty(rowKey(row), 'special_value', $event, row)"
                  />
                </FormField>

                <!-- Special Gross (read-only) -->
                <span class="t-muted">{{ formatPrice(specialGrossValue(row)) }}</span>

                <!-- Special From -->
                <BasicDatePicker
                  fixed
                  :model-value="getDirtyField(rowKey(row), 'special_from_date', row.special_from_date || '')"
                  @update:model-value="setDirty(rowKey(row), 'special_from_date', $event, row)"
                />

                <!-- Special To -->
                <BasicDatePicker
                  fixed
                  :model-value="getDirtyField(rowKey(row), 'special_to_date', row.special_to_date || '')"
                  @update:model-value="setDirty(rowKey(row), 'special_to_date', $event, row)"
                />

                <!-- Actions: eye + flush special + delete -->
                <div class="flex ai-ct gap-2">
                  <IconButton
                    v-if="row.has_price && hasMultipleCountries"
                    icon="preview"
                    :label="$t('pm.expand_countries')"
                    size="sm"
                    :pressed="expandedSkus.has(row.sku)"
                    @click="toggleExpand(row.sku)"
                  />
                  <IconButton
                    v-if="row.has_price"
                    icon="clear"
                    :label="$t('pm.flush_special_tooltip')"
                    variant="danger"
                    size="sm"
                    @click="confirmFlush(row.sku, row.currency)"
                  />
                  <IconButton
                    v-if="row.has_price"
                    icon="delete"
                    :label="$t('pm.delete_prices_tooltip')"
                    variant="danger"
                    size="sm"
                    @click="confirmDelete(row.sku, row.currency)"
                  />
                </div>

                <!-- Status -->
                <div class="flex ai-ct gap-2">
                  <StatusBadge
                    v-if="!row.has_price"
                    :label="$t('pm.no_price_set')"
                    tone="neutral"
                  />
                  <StatusBadge
                    v-else-if="dirtyRows.has(rowKey(row))"
                    :label="$t('pm.unsaved')"
                    tone="warning"
                  />
                </div>
              </div>

              <!-- Expanded sub-table -->
              <div
                v-if="expandedSkus.has(row.sku)"
                class="pm-expand"
              >
                <Loader v-if="!expandedData[row.sku]" />
                <template v-else>
                  <div class="pm-expand__head">
                    <span>{{ $t('pm.country') }}</span>
                    <span>{{ $t('pm.tax_rate') }}</span>
                    <span>{{ $t('pm.net') }}</span>
                    <span>{{ $t('pm.gross') }}</span>
                    <span>{{ $t('pm.special_net') }} → {{ $t('pm.special_gross') }}</span>
                  </div>
                  <div
                    v-for="cr in expandedData[row.sku]"
                    :key="cr.country"
                    class="pm-expand__row"
                  >
                    <span class="fw-600">{{ cr.country }}</span>
                    <span class="t-muted">{{ cr.tax_rate != null ? cr.tax_rate + '%' : '—' }}</span>
                    <span>{{ formatPrice(cr.net) }}</span>
                    <span>{{ formatPrice(cr.gross) }}</span>
                    <span class="t-muted">
                      <template v-if="cr.special_net">
                        {{ formatPrice(cr.special_net) }} → {{ formatPrice(cr.special_gross) }}
                      </template>
                      <template v-else>—</template>
                    </span>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>
      </div>

    <FloatingActions :actions="fabActions" />

    <template v-if="!loading && channelIdx && rows.length && totalCount > pageSize" #footer>
      <Pagination
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>

    <ConfirmDialog
      tone="danger"
      :open="!!pendingFlushSku"
      @confirm="doFlushSpecial"
      @cancel="pendingFlushSku = null"
      :title="$t('pm.flush_special')"
    >
      <template #default><p>{{ $t('pm.flush_special_confirm') }}</p></template>
    </ConfirmDialog>

    <ConfirmDialog
      tone="danger"
      :open="!!pendingDeleteSku"
      @confirm="doDeletePrices"
      @cancel="pendingDeleteSku = null"
      :title="$t('pm.delete_prices')"
    >
      <template #default><p>{{ $t('pm.delete_prices_confirm') }}</p></template>
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from '@/stores/loader'
import { toggledValue } from '@/utils/toggled-value'
import { useNotifyStore } from '@/stores/notify'
import { useSearchDebounce } from '@/composables/useSearchDebounce'
import {
  GET_PmPrices,
  GET_PmPriceDetail,
  GET_PmPriceProducts,
  PATCH_PmBulkPrices,
  DELETE_PmPrice,
  POST_PmFlushSpecial,
} from '@/api/pricemanager/api'
import { extractApiMessage } from '@/composables/useFormErrors'
import { formatError } from '@/utils/formats'
import PmChannelSelect from './PmChannelSelect.vue'

const ROW_IDENTITY = ['sku', 'currency', '_original']

export default {
  name: 'PmPriceList',
  components: { PmChannelSelect },
  inject: {
    pmChannelIdx: { default: null },
    pmActiveChannel: { default: null },
  },
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    const { search, debouncedFetch } = useSearchDebounce()
    return { loader, notify, search, debouncedFetch }
  },
  data() {
    return {
      prices: [],
      products: [],
      loading: false,
      saving: false,
      pendingFlushSku: null,
      pendingDeleteSku: null,
      currentPage: 1,
      pageSize: 20,
      totalCount: 0,
      activeCurrency: '',
      selectedCurrencies: [],
      availableCurrencies: [],
      activeFilter: 'all',
      dirtyRows: new Map(),
      // A save refused for an invalid price: the invalid cells show their error until they are fixed.
      saveRefused: false,
      expandedSkus: new Set(),
      expandedData: {},
    }
  },
  computed: {
    channelIdx() {
      const v = this.pmChannelIdx
      return (typeof v === 'object' && v !== null) ? (v.value || '') : (v || '')
    },
    activeChannel() {
      const ch = this.pmActiveChannel
      return (typeof ch === 'object' && ch !== null && 'value' in ch) ? ch.value : ch
    },
    defaultCountry() {
      return this.activeChannel?.default_country || ''
    },
    isNetEditable() {
      return (this.activeChannel?.calculate_direction || 'from_net_to_gross') === 'from_net_to_gross'
    },
    hasMultipleCountries() {
      const countries = this.activeChannel?.calculate_countries
      return Array.isArray(countries) ? countries.length > 1 : false
    },
    dirtyCount() {
      return this.dirtyRows.size
    },
    // One unsaved entry is one SKU price in one currency (what the save writes); the flat list shows it on each of its
    // country rows, and every one of them is marked. The counter names both when they differ.
    unsavedLabel() {
      const rows = this.rows.filter((row) => this.dirtyRows.has(this.rowKey(row))).length
      if (rows <= this.dirtyCount) return `${this.dirtyCount} ${this.$t('pm.unsaved')}`
      return this.$t('pm.unsaved_prices_rows', { prices: this.dirtyCount, rows })
    },
    headerActions() {
      return [
        { key: 'save-all', role: 'primary', disabled: this.saving, onClick: this.saveAll,
          label: this.saving ? this.$t('pm.saving') : this.$t('pm.save_all') },
      ]
    },
    currencyOptions() {
      return this.availableCurrencies.map((c) => ({ value: c, label: c }))
    },
    // Merge prices + no-price products into unified rows list
    rows() {
      if (this.activeFilter === 'without_price') {
        return this.products.map((p) => ({
          sku: p.sku,
          tax_class: p.tax_class || '',
          has_price: false,
          countries: [],
        }))
      }
      const priceRows = this.prices.map((p) => ({ ...p, has_price: true }))
      if (this.activeFilter === 'with_price') return priceRows
      // 'all': prices + missing-currency rows for partially-priced SKUs + fully unpriced
      const priceKeys = new Set(this.prices.map((p) => p.sku + '|' + (p.currency || '')))
      const pricedSkus = {}
      for (const p of this.prices) {
        if (!pricedSkus[p.sku]) pricedSkus[p.sku] = p.tax_class || ''
      }
      // For SKUs with some prices, add "No price" rows for missing currencies
      const missingRows = []
      for (const [sku, taxClass] of Object.entries(pricedSkus)) {
        for (const cur of this.selectedCurrencies) {
          if (!priceKeys.has(sku + '|' + cur)) {
            missingRows.push({ sku, tax_class: taxClass, currency: cur, has_price: false, countries: [] })
          }
        }
      }
      // Fully unpriced products — one row per selected currency
      const allPricedSkus = new Set(Object.keys(pricedSkus))
      const currencies = this.selectedCurrencies.length ? this.selectedCurrencies : [this.activeCurrency || 'EUR']
      const noPriceRows = []
      for (const p of this.products) {
        if (allPricedSkus.has(p.sku)) continue
        for (const cur of currencies) {
          noPriceRows.push({ sku: p.sku, tax_class: p.tax_class || '', currency: cur, has_price: false, countries: [] })
        }
      }
      return [...priceRows, ...missingRows, ...noPriceRows]
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      }
    },
    fabActions() {
      return [
        {
          icon: 'add',
          label: this.$t('pm.add_product'),
          handler: () => this.$router.push('/pricing/prices/new'),
        },
      ]
    },
  },
  watch: {
    // No unsaved price left (saved, discarded, another page or channel): the refused-save marks go with them.
    dirtyCount(count) {
      if (!count) this.saveRefused = false
    },
    channelIdx(val) {
      if (!val) return
      this.dirtyRows = new Map()
      this.expandedSkus = new Set()
      this.expandedData = {}
      this.currentPage = 1
      this.activeCurrency = ''
      this.availableCurrencies = []
      this.selectedCurrencies = []
      this.fetchAll()
    },
  },
  mounted() {
    if (this.channelIdx) this.fetchAll()
  },
  methods: {
    // --- Data loading ---
    async fetchAll() {
      if (!this.channelIdx) return
      this.loading = true
      try {
        // First detect available currencies if not yet known
        if (!this.availableCurrencies.length) {
          await this.syncCurrencies()
        }
        await Promise.all([this.fetchPrices(), this.fetchProducts()])
      } finally {
        this.loading = false
      }
    },
    async fetchPrices() {
      const params = { page: this.currentPage, page_size: this.pageSize }
      if (this.selectedCurrencies.length) params.currency = this.selectedCurrencies.join(',')
      if (this.search) params.search = this.search
      try {
        const { data } = await GET_PmPrices(this.channelIdx, params)
        this.prices = data.results || []
        this.totalCount = data.count || 0
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      }
    },
    async fetchProducts() {
      if (this.activeFilter === 'with_price') return
      const params = {}
      params.currency = this.selectedCurrencies[0] || this.availableCurrencies[0] || 'EUR'
      if (this.search) params.search = this.search
      try {
        const { data } = await GET_PmPriceProducts(this.channelIdx, params)
        this.products = data.results || data || []
      } catch {
        this.products = []
      }
    },
    async syncCurrencies() {
      // Fetch all prices (no currency filter) for first page to detect available currencies
      try {
        const { data } = await GET_PmPrices(this.channelIdx, { page_size: 100 })
        const results = data.results || data || []
        const seen = new Set()
        results.forEach((p) => {
          const countries = p.countries || []
          countries.forEach((c) => { if (c.currency) seen.add(c.currency) })
          if (p.currency) seen.add(p.currency)
        })
        if (seen.size) {
          this.availableCurrencies = [...seen].sort()
          // Select all currencies by default
          if (!this.selectedCurrencies.length) {
            this.selectedCurrencies = [...this.availableCurrencies]
          }
          this.activeCurrency = this.selectedCurrencies[0] || this.availableCurrencies[0]
        }
      } catch { /* ignore — currencies stay empty */ }
    },
    // --- UI events ---
    // BasicSelect `multiple` emits the whole list; toggle the one code it added or removed.
    onCurrenciesPick(codes) {
      this.toggleCurrency(toggledValue(codes, this.selectedCurrencies))
    },
    toggleCurrency(code) {
      const idx = this.selectedCurrencies.indexOf(code)
      if (idx >= 0) {
        if (this.selectedCurrencies.length === 1) return // keep at least 1
        this.selectedCurrencies.splice(idx, 1)
      } else {
        this.selectedCurrencies.push(code)
      }
      this.activeCurrency = this.selectedCurrencies[0]
      this.currentPage = 1
      this.dirtyRows = new Map()
      this.fetchAll()
    },
    setFilter(filter) {
      if (this.activeFilter === filter) return
      this.activeFilter = filter
      this.currentPage = 1
      this.dirtyRows = new Map()
      this.expandedSkus = new Set()
      this.fetchAll()
    },
    doSearch() {
      this.currentPage = 1
      this.dirtyRows = new Map()
      this.fetchAll()
    },
    onPageChange(page) {
      this.currentPage = page
      this.dirtyRows = new Map()
      this.fetchPrices()
    },
    detailPath(sku) {
      return `/pricing/prices/${encodeURIComponent(sku)}`
    },
    // --- Expand / collapse ---
    async toggleExpand(sku) {
      const next = new Set(this.expandedSkus)
      if (next.has(sku)) {
        next.delete(sku)
        this.expandedSkus = next
        return
      }
      next.add(sku)
      this.expandedSkus = next
      if (this.expandedData[sku]) return
      try {
        const { data } = await GET_PmPriceDetail(this.channelIdx, sku)
        this.expandedData = {
          ...this.expandedData,
          [sku]: data.prices || data.countries || data.rows || [],
        }
      } catch {
        this.expandedData = { ...this.expandedData, [sku]: [] }
      }
    },
    // --- Dirty state ---
    rowKey(row) {
      return row.sku + '|' + (row.currency || '')
    },
    getDirtyField(key, field, fallback) {
      const entry = this.dirtyRows.get(key)
      if (!entry || !(field in entry)) return fallback
      return entry[field]
    },
    setDirty(key, field, value, row) {
      // A price cell (BasicInput format="money") already emits the API decimal; it is stored unchanged.
      const existing = this.dirtyRows.get(key) || { sku: row.sku, currency: row.currency, _original: row }
      // A cell typed back to its stored value is clean again (the money cell updates on every keystroke).
      if (value === this.storedField(row, field)) delete existing[field]
      else existing[field] = value
      const edited = Object.keys(existing).some((k) => !ROW_IDENTITY.includes(k))
      if (edited) this.dirtyRows.set(key, existing)
      else this.dirtyRows.delete(key)
      this.dirtyRows = new Map(this.dirtyRows)
    },
    storedField(row, field) {
      if (field === 'value') return this.primaryValue(row)
      if (field === 'special_value') return this.specialValue(row)
      return row[field] || ''
    },
    // --- Price helpers ---
    primaryValue(row) {
      const c = (row.countries || [])[0]
      const raw = this.isNetEditable ? (c ? c.net : row.net) : (c ? c.gross : row.gross)
      return this.fmt(raw)
    },
    calculatedValue(row) {
      const dirty = this.dirtyRows.get(this.rowKey(row))
      if (dirty && dirty.value) return null
      const c = (row.countries || [])[0]
      const raw = this.isNetEditable ? (c ? c.gross : row.gross) : (c ? c.net : row.net)
      return raw
    },
    specialValue(row) {
      const c = (row.countries || [])[0]
      const raw = this.isNetEditable ? (c ? c.special_net : row.special_net) : (c ? c.special_gross : row.special_gross)
      return this.fmt(raw)
    },
    specialGrossValue(row) {
      const c = (row.countries || [])[0]
      const raw = this.isNetEditable ? (c ? c.special_gross : row.special_gross) : (c ? c.special_net : row.special_net)
      return raw
    },
    fmt(val) {
      if (val == null || val === '') return ''
      const num = Number(val)
      return isNaN(num) ? '' : num.toFixed(2)
    },
    formatPrice(val) {
      if (val == null || val === '') return '—'
      const num = Number(val)
      if (isNaN(num)) return '—'
      return num.toFixed(2)
    },
    // --- Save ---
    // A value the money format rejects is marked in its cell; the save waits until it is fixed.
    hasInvalidPrice() {
      return [...this.dirtyRows.values()].some((r) => formatError('money', r.value) || formatError('money', r.special_value))
    },
    cellError(row, field) {
      if (!this.saveRefused) return ''
      const entry = this.dirtyRows.get(this.rowKey(row))
      return entry && field in entry ? formatError('money', entry[field]) : ''
    },
    async saveAll() {
      if (!this.dirtyRows.size) return
      this.saveRefused = this.hasInvalidPrice()
      if (this.saveRefused) {
        this.notify.spawnNotification({ type: 'negative', msg: this.$t('formats.invalid_rows') })
        return
      }
      this.saving = true
      this.loader.loaderStart()
      try {
        // Group dirty rows by currency (bulk endpoint takes one currency_code per call)
        const byCurrency = {}
        for (const r of this.dirtyRows.values()) {
          const hasValue = r.value != null && r.value !== ''
          const hasSpecial = 'special_value' in r
          if (!hasValue && !hasSpecial && !r.special_from_date && !r.special_to_date) continue
          const cur = r.currency || this.selectedCurrencies[0] || this.activeCurrency
          if (!byCurrency[cur]) byCurrency[cur] = []
          // For special-only edits, value can be omitted (backend handles it)
          const normalizedValue = hasValue ? String(r.value).replace(',', '.').trim() : undefined
          // Explicitly send null to clear special, undefined to leave unchanged
          let normalizedSpecial = undefined
          if (hasSpecial) {
            normalizedSpecial = r.special_value ? String(r.special_value).replace(',', '.').trim() : null
          }
          const item = {
            sku: r.sku,
            value: normalizedValue || undefined,
            special_value: normalizedSpecial,
            special_from_date: r.special_from_date || undefined,
            special_to_date: r.special_to_date || undefined,
          }
          // Include tax_class_idx for "no price" products
          if (r._original?.has_price === false && r._original?.tax_class) {
            item.tax_class_idx = r._original.tax_class
          }
          byCurrency[cur].push(item)
        }
        let totalUpdated = 0
        let totalLogged = 0
        for (const [currencyCode, items] of Object.entries(byCurrency)) {
          const { data } = await PATCH_PmBulkPrices(this.channelIdx, {
            items,
            currency_code: currencyCode,
          })
          totalUpdated += data.updated ?? items.length
          totalLogged += data.logged ?? 0
        }
        this.dirtyRows = new Map()
        this.notify.spawnNotification({
          type: 'positive',
          msg: this.$t('pm.bulk_save_success', {
            updated: totalUpdated,
            logged: totalLogged,
          }),
        })
        await this.fetchPrices()
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.save_error')),
        })
      } finally {
        this.saving = false
        this.loader.loaderFinish()
      }
    },
    confirmFlush(sku, currency) {
      this.pendingFlushSku = { sku, currency }
    },
    confirmDelete(sku, currency) {
      this.pendingDeleteSku = { sku, currency }
    },
    async doFlushSpecial() {
      const { sku, currency } = this.pendingFlushSku
      this.pendingFlushSku = null
      this.loader.loaderStart()
      try {
        await POST_PmFlushSpecial(this.channelIdx, sku, currency)
        this.notify.spawnNotification({ type: 'positive', msg: this.$t('notifications.success') })
        await this.fetchPrices()
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
    async doDeletePrices() {
      const { sku, currency } = this.pendingDeleteSku
      this.pendingDeleteSku = null
      this.loader.loaderStart()
      try {
        await DELETE_PmPrice(this.channelIdx, sku, currency)
        this.notify.spawnNotification({ type: 'positive', msg: this.$t('notifications.success') })
        await this.fetchAll()
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
.price-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.price-list__currency {
  min-width: 100px;
  max-width: 140px;
}

.price-list__country-label {
  white-space: nowrap;
  flex-shrink: 0;
}

.price-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 320px;
}

// --- Table ---

// The rows keep $min-width (two date pickers); only the table box scrolls sideways, never the page. The row date
// pickers are `fixed`, so this scroll box never clips their calendars.
.pm-price-table {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  overflow-x: auto;
}

// SKU | Tax | Cur | Net | Gross | Spec.Net | Spec.Gross | From | To | Eye | Status
// minmax keeps columns readable; fr units share leftover space. Status fits the longest badge ("Niezapisane").
$min-width: 1360px;
$cols:
  minmax(100px, 1.5fr) // SKU
  minmax(70px, 1fr)    // Tax Class
  64px                 // Currency
  minmax(80px, 1fr)    // Net (input)
  minmax(90px, 1fr)    // Gross (readonly)
  minmax(90px, 1fr)    // Special Net (input)
  minmax(90px, 0.8fr)  // Special Gross (readonly)
  minmax(12rem, 1fr)   // Promo Start (BasicDatePicker)
  minmax(12rem, 1fr)   // Promo End (BasicDatePicker)
  112px                // Actions (eye + flush + delete)
  124px;               // Status

.pm-price-table__head {
  display: grid;
  min-width: $min-width;
  grid-template-columns: $cols;
  // The DataTable cell model: neighbouring columns keep 12 px between them.
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-raised);
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}

.pm-price-table__row {
  display: grid;
  min-width: $min-width;
  grid-template-columns: $cols;
  gap: var(--space-3);
  padding: var(--space-1) var(--space-3);
  border-top: 1px solid var(--border-subtle);
  // Every row keeps the bar's width, so marking one moves nothing.
  border-left: 3px solid transparent;
  align-items: center;
  min-height: 40px;

  // Unsaved: an accent bar on the leading edge and the Status badge, the row itself stays calm.
  &--dirty {
    border-left-color: var(--warning);
  }

  &:hover {
    background: var(--surface-raised);
  }
}

.pm-price-cell {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.pm-currency-tag {
  font-size: var(--fs-200);
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.pm-price-input {
  flex: 1;
  min-width: 0;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// --- Expand sub-table ---

$expand-cols: 80px 80px 110px 110px 1fr;

.pm-expand {
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-raised);
  padding: var(--space-2) var(--space-5) var(--space-2) var(--space-12);
}

.pm-expand__head {
  display: grid;
  grid-template-columns: $expand-cols;
  gap: var(--space-2);
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--space-1);
}

.pm-expand__row {
  display: grid;
  grid-template-columns: $expand-cols;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--fs-300);
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);

  &:last-child {
    border-bottom: none;
  }
}

@media only screen and (max-width: 768px) {
  .price-list__toolbar {
    padding: 0;
  }

  .price-list__search {
    max-width: 100%;
  }
}
</style>
