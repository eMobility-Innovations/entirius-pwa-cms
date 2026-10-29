<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('stock.manage')">
        <template #meta>
          <StatusBadge
            v-if="isManual && dirtyCount > 0"
            tone="warning"
            :dot="false"
            :label="`${$t('stock.unsaved')}: ${dirtyCount}`"
          />
        </template>
        <!-- The picker is too wide for the meta beside the title (a 390 px phone squeezes the H1): it leads the
             actions row, left of the ActionBar, so the primary stays rightmost (R5). -->
        <template #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StockWarehousePicker />
            <ActionBar v-if="isManual" :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>

    <template #toolbar>
      <div class="stock-table__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('stock.search_sku')"
          :aria-label="$t('stock.search_sku')"
          icon="search"
          class="stock-table__search"
          @input="onSearch"
        />
        <div class="filter-chip-row" role="group" :aria-label="$t('stock.status')">
          <FilterChip
            v-for="filter in filters"
            :key="filter.key"
            :label="filter.label"
            :active="activeFilter === filter.key"
            @click="setFilter(filter.key)"
          />
        </div>
      </div>
    </template>

    <div
      v-if="!isManual"
      class="flex ai-ct gap-5 mb-8 p-8 bg-accent-subtle rounded t-strong fs-200"
    >
      <FontAwesomeIcon :icon="$icons.lock" />
      <span>{{ $t("stock.integration_readonly") }}</span>
    </div>

    <Loader v-if="loading" block />

    <DataTable
      v-else
      :columns="columns"
      :rows="products"
      row-key="sku"
      empty-size="md"
      :empty-text="$t('stock.no_stock')"
    >
      <template #cell-sku="{ row }">
        <span :class="{ 't-negative': row.has_stock && row.quantity === 0 }">{{ row.sku }}</span>
      </template>
      <template #cell-quantity="{ row }">
        <NumberInput
          v-if="isManual"
          :model-value="getDisplayQty(row)"
          :min="0"
          :aria-label="`${$t('stock.quantity')}: ${row.sku}`"
          @update:model-value="(val) => onQtyChange(row.sku, val, row)"
        />
        <span v-else>{{ row.has_stock ? row.quantity : "—" }}</span>
      </template>
      <template #cell-dispatch_resolved="{ row }">
        <span v-if="row.dispatch_resolved != null">
          {{ $t("stock.dispatch_hours", { hours: row.dispatch_resolved }) }}
        </span>
        <span v-else class="t-muted fs-200">—</span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge v-if="isDirty(row.sku)" :label="$t('stock.unsaved')" tone="warning" />
        <StatusBadge v-else-if="!row.has_stock" :label="$t('stock.no_stock_label')" tone="neutral" />
      </template>
    </DataTable>

    <template v-if="totalCount > pageSize" #footer>
      <Pagination
        :page="currentPage"
        :pages="Math.ceil(totalCount / pageSize)"
        @update:page="onPageChange"
      />
    </template>

    <ImportCSVModal
      v-if="showImportModal"
      :warehouse-code="warehouse?.code"
      @close="showImportModal = false"
      @imported="onCsvImported"
    />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader"
import { useNotifyStore } from "@/stores/notify"
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors"
import { GET_WarehouseProducts, PATCH_WarehouseStock } from "@/api/stock/api"
import ImportCSVModal from "./ImportCSVModal.vue"
import StockWarehousePicker from "./StockWarehousePicker.vue"

export default {
  name: "WarehouseStockTable",
  components: { ImportCSVModal, StockWarehousePicker },
  inject: ["activeWarehouse"],
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    const formErrors = useFormErrors()
    return { loader, notify, formErrors }
  },
  data() {
    return {
      products: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 50,
      loading: false,
      dirtyItems: {},
      activeFilter: "all",
      search: "",
      showImportModal: false,
      _debounceTimer: null,
    }
  },
  computed: {
    warehouse() {
      return this.activeWarehouse()
    },
    isManual() {
      return this.warehouse?.source_type === "manual"
    },
    dirtyCount() {
      return Object.keys(this.dirtyItems).length
    },
    filters() {
      return [
        { key: "all", label: this.$t("stock.filter_all") },
        { key: "with_stock", label: this.$t("stock.filter_with_stock") },
        { key: "no_stock", label: this.$t("stock.filter_no_stock") },
      ]
    },
    columns() {
      return [
        { key: "sku", label: this.$t("stock.sku"), truncate: true },
        { key: "quantity", label: this.$t("stock.quantity"), width: "160px" },
        { key: "dispatch_resolved", label: this.$t("stock.dispatch_time"), width: "max-content", priority: 2 },
        { key: "status", label: this.$t("stock.status"), width: "max-content", align: "right" },
      ]
    },
    headerActions() {
      return [
        { key: "import", label: this.$t("stock.import_csv"), role: "secondary", onClick: this.openImport },
        {
          key: "save",
          label: this.$t("stock.save_all"),
          role: "primary",
          disabled: this.dirtyCount === 0,
          onClick: this.saveAll,
        },
      ]
    },
  },
  watch: {
    warehouse: {
      handler(newVal) {
        if (newVal) {
          this.dirtyItems = {}
          this.currentPage = 1
          this.activeFilter = "all"
          this.fetchProducts()
        }
      },
      immediate: true,
    },
  },
  methods: {
    async fetchProducts() {
      if (!this.warehouse) return
      this.loading = true
      try {
        const params = { page: this.currentPage, page_size: this.pageSize }
        if (this.search) params.search = this.search
        if (this.activeFilter === "with_stock") params.has_stock = "true"
        if (this.activeFilter === "no_stock") params.has_stock = "false"

        const { data } = await GET_WarehouseProducts(this.warehouse.code, params)
        this.products = data.results || []
        this.totalCount = data.count || 0
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        })
      } finally {
        this.loading = false
      }
    },
    getDisplayQty(item) {
      if (item.sku in this.dirtyItems) return this.dirtyItems[item.sku]
      return item.has_stock ? item.quantity : 0
    },
    isDirty(sku) {
      return sku in this.dirtyItems
    },
    onQtyChange(sku, value, item) {
      const originalQty = item.has_stock ? item.quantity : null
      if (originalQty === value) {
        delete this.dirtyItems[sku]
      } else {
        this.dirtyItems[sku] = value
      }
      this.dirtyItems = { ...this.dirtyItems }
    },
    setFilter(filter) {
      this.activeFilter = filter
      this.currentPage = 1
      this.dirtyItems = {}
      this.fetchProducts()
    },
    onSearch() {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
        this.currentPage = 1
        this.fetchProducts()
      }, 300)
    },
    async saveAll() {
      if (this.dirtyCount === 0) return
      this.loader.loaderStart()
      try {
        const items = Object.entries(this.dirtyItems).map(([sku, quantity]) => ({
          sku,
          quantity,
        }))
        await PATCH_WarehouseStock(this.warehouse.code, { items })
        this.dirtyItems = {}
        this.notify.spawnNotification({ type: "positive", msg: this.$t("stock.saved") })
        this.fetchProducts()
      } catch (err) {
        this.formErrors.handleApiError(err)
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
    onPageChange(page) {
      this.currentPage = page
      this.dirtyItems = {}
      this.fetchProducts()
    },
    openImport() {
      this.showImportModal = true
    },
    onCsvImported() {
      this.showImportModal = false
      this.fetchProducts()
    },
  },
}
</script>

<style lang="scss" scoped>
.stock-table__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.stock-table__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
</style>
