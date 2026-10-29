<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pricefighter.gap_table')" />
    </template>
    <template #toolbar>
      <MobileFilterPanel :active-count="activeFilterCount" :trigger-label="$t('pricefighter.filters')">
        <BasicSelect
          :floating-label="$t('pricefighter.market')"
          v-if="channelOptions.length"
          :model-value="channelFilter || ALL_OPTION"
          :options="channelFilterOptions"
          class="gap-table__channel"
          @update:model-value="onChannelSelect"
        />
        <BasicSelect
          :floating-label="$t('pricefighter.recommendation')"
          :model-value="recommendationFilter || ALL_OPTION"
          :options="recommendationFilterOptions"
          class="gap-table__recommendation"
          @update:model-value="onRecommendationSelect"
        />
        <BasicSwitch
          :label="$t('pricefighter.competitor_only')"
          :model-value="competitorOnly"
          class="gap-table__competitor"
          @update:model-value="toggleCompetitorOnly"
        />
      </MobileFilterPanel>
    </template>

      <BulkActionBar
        v-if="selectedRows.length"
        :count="selectedRows.length"
        selected-label-key="pricefighter.rows_selected"
        clear-label-key="pricefighter.clear_selection"
        :actions="bulkActions"
        class="mb-10"
        @action="onBulkAction"
        @clear="onClearSelection"
      />

      <Loader block v-show="loading" />

      <div v-show="!loading">
        <EmptyState
          v-if="!rows.length"
          :title="$t('pricefighter.no_decisions')"
          :message="$t('pricefighter.no_decisions_desc')"
          icon="pricing"
        />

        <template v-else>
          <DataTable
            empty-size="md"
            ref="table"
            :columns="columns"
            :rows="rows"
            row-key="_rowKey"
            sortable
            expandable
            selectable
            multi-select
            :empty-text="$t('pricefighter.no_decisions')"
            @sort="onSort"
            @select="selectedRows = $event"
          >
            <template #cell-sku="{ row }">
              <div class="flex flex-column">
                <span class="fw-600 t-accent">{{ row.sku }}</span>
                <span class="t-muted fs-200">{{ row.name }}</span>
              </div>
            </template>
            <template #cell-market="{ row }">
              <MarketCell :channel="row.channel_idx" :country="row.country" :currency="row.currency" />
            </template>
            <template #cell-current_price="{ row }">
              {{ fmt(row.current_price) }} <span class="gap-table__ccy">{{ row.currency }}</span>
            </template>
            <template #cell-cost="{ row }">
              {{ fmt(row.cost) }} <span class="gap-table__ccy">{{ row.currency }}</span>
            </template>
            <template #cell-reference_price="{ row }">
              {{ fmt(row.reference_price) }} <span class="gap-table__ccy">{{ row.currency }}</span>
            </template>
            <template #cell-gap_baseline="{ row }">
              <span :title="`${$t('pricefighter.gap_current')}: ${fmt(row.gap_current)}`">
                {{ fmt(row.gap_baseline) }}
              </span>
            </template>
            <template #cell-suggested_price="{ row }">
              <div class="suggested-cell">
                <span>{{ fmt(row.suggested_price) }} <span class="gap-table__ccy">{{ row.currency }}</span></span>
                <div v-if="row.clamped_floor || row.clamped_step" class="suggested-cell__badges">
                  <StatusBadge v-if="row.clamped_floor" :label="$t('pricefighter.clamped_floor')" tone="warning" />
                  <StatusBadge v-if="row.clamped_step" :label="$t('pricefighter.clamped_step')" tone="warning" />
                </div>
              </div>
            </template>
            <template #cell-recommendation="{ row }">
              <StatusBadge
                :label="$t(`pricefighter.recommendation_${row.recommendation}`)"
                :tone="recommendationVariant(row.recommendation)"
              />
            </template>
            <template #expand="{ row }">
              <GapRowDetail :row="row" />
            </template>
          </DataTable>
        </template>
      </div>

    <template v-if="!loading && rows.length && totalCount > pageSize" #footer>
      <Pagination
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>

    <ApplyPreviewModal
      v-if="showPreview"
      :items="selectedRows"
      @applied="onApplied"
      @cancelled="showPreview = false"
    />
    <ApplyReport
      v-if="applyReport"
      :report="applyReport"
      @closed="onReportClosed"
    />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from '@/stores/loader'
import { useNotifyStore } from '@/stores/notify'
import { usePfChannels } from '@/composables/usePfChannels'
import { GET_PfDecisions } from '@/api/pricefighter/api'
import { extractApiMessage } from '@/composables/useFormErrors'
import { PF_PAGE_SIZE, RECOMMENDATIONS, RECOMMENDATION_VARIANTS, pfFormat } from './constants'
import GapRowDetail from './components/GapRowDetail.vue'
import ApplyPreviewModal from './components/ApplyPreviewModal.vue'
import ApplyReport from './components/ApplyReport.vue'
import MarketCell from './components/MarketCell.vue'

const SORT_API_TOKEN = {
  sku: 'sku',
  name: 'name',
  current_price: 'current_price',
  reference_price: 'competitor_price',
  gap_baseline: 'gap',
}

export default {
  name: 'PfGapTable',
  components: { GapRowDetail, ApplyPreviewModal, ApplyReport, MarketCell },
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    const { channelOptions, fetchChannels } = usePfChannels()
    return { loader, notify, channelOptions, fetchChannels }
  },
  data() {
    return {
      rows: [],
      loading: false,
      channelFilter: null,
      recommendationFilter: null,
      competitorOnly: true,
      ALL_OPTION: '__all',
      sortKey: 'gap_baseline',
      sortDirection: 'desc',
      currentPage: 1,
      pageSize: PF_PAGE_SIZE,
      totalCount: 0,
      selectedRows: [],
      showPreview: false,
      applyReport: null,
    }
  },
  computed: {
    // Only filters moved off their default count: competitor-only is on by default, so turning it off is the filter.
    activeFilterCount() {
      return [this.channelFilter, this.recommendationFilter, !this.competitorOnly].filter(Boolean).length
    },
    bulkActions() {
      return [{ key: 'apply', labelKey: 'pricefighter.apply_selected', variant: 'primary' }]
    },
    recommendationFilterOptions() {
      return [
        { value: this.ALL_OPTION, label: this.$t('pricefighter.all_recommendations') },
        ...RECOMMENDATIONS.map((r) => ({ value: r, label: this.$t(`pricefighter.recommendation_${r}`) })),
      ]
    },
    channelFilterOptions() {
      return [{ value: this.ALL_OPTION, label: this.$t('pricefighter.all_channels') }, ...this.channelOptions]
    },
    columns() {
      return [
        { key: 'sku', label: this.$t('pricefighter.sku'), sortable: true, width: '1.5fr' },
        { key: 'market', label: this.$t('pricefighter.market'), sortable: false, width: '1fr' },
        { key: 'current_price', label: this.$t('pricefighter.current_price'), sortable: true, width: '0.8fr', numeric: true, priority: 2 },
        { key: 'cost', label: this.$t('pricefighter.cost'), sortable: false, width: '0.7fr', numeric: true, priority: 2 },
        { key: 'reference_price', label: this.$t('pricefighter.competitor_price'), sortable: true, width: '0.8fr', numeric: true, priority: 2 },
        { key: 'gap_baseline', label: this.$t('pricefighter.gap'), sortable: true, width: '0.8fr', numeric: true, priority: 2 },
        { key: 'suggested_price', label: this.$t('pricefighter.suggested_price'), sortable: false, width: '1.3fr', priority: 2 },
        { key: 'recommendation', label: this.$t('pricefighter.recommendation'), sortable: false, width: 'max-content' },
      ]
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      }
    },
  },
  async mounted() {
    await this.fetchChannels()
    await this.fetchRows()
  },
  methods: {
    fmt: pfFormat,
    recommendationVariant(rec) {
      return RECOMMENDATION_VARIANTS[rec] || 'neutral'
    },
    async fetchRows() {
      this.loading = true
      this.selectedRows = []
      try {
        const params = { page: this.currentPage, competitor_only: this.competitorOnly }
        if (this.channelFilter) params.channel = this.channelFilter
        if (this.recommendationFilter) params.recommendation = this.recommendationFilter
        const apiField = SORT_API_TOKEN[this.sortKey] || 'gap'
        params.sort = this.sortDirection === 'desc' ? `-${apiField}` : apiField
        const { data } = await GET_PfDecisions(params)
        this.rows = (data.results || []).map((row) => ({
          ...row,
          _rowKey: `${row.sku}|${row.channel_idx}|${row.country}|${row.currency}`,
        }))
        this.totalCount = data.count || 0
      } catch (err) {
        this.rows = []
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loading = false
      }
    },
    onChannelSelect(value) {
      this.channelFilter = value === this.ALL_OPTION ? null : value
      this.currentPage = 1
      this.fetchRows()
    },
    onRecommendationSelect(value) {
      this.recommendationFilter = value === this.ALL_OPTION ? null : value
      this.currentPage = 1
      this.fetchRows()
    },
    toggleCompetitorOnly(on) {
      this.competitorOnly = on
      this.currentPage = 1
      this.fetchRows()
    },
    onSort({ key, direction }) {
      if (!key || !direction) {
        this.sortKey = 'gap_baseline'
        this.sortDirection = 'desc'
      } else {
        this.sortKey = key
        this.sortDirection = direction
      }
      this.currentPage = 1
      this.fetchRows()
    },
    onPageChange(page) {
      this.currentPage = page
      this.fetchRows()
    },
    onClearSelection() {
      this.selectedRows = []
      this.$refs.table?.clearSelection()
    },
    onBulkAction(key) {
      if (key === 'apply') this.showPreview = true
    },
    onApplied(report) {
      this.showPreview = false
      this.applyReport = report
    },
    onReportClosed() {
      this.applyReport = null
      this.onClearSelection()
      this.fetchRows()
    },
  },
}
</script>

<style lang="scss" scoped>
.gap-table__channel,
.gap-table__recommendation {
  min-width: 160px;
  max-width: 220px;
}

/* Suggested price + clamp badges: stack vertically, right-aligned, so long
   badges ("Clamped by max step" / "Clamped to floor") wrap under the price
   instead of overflowing into the Gap column. */
.gap-table__ccy {
  color: var(--text-muted);
  font-size: var(--fs-200);
}

.suggested-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.suggested-cell__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: var(--space-1);
}
</style>
