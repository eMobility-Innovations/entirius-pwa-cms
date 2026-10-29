<template>
  <div class="sku-stock" :class="{ 'sku-stock--embedded': embedded }">
    <Loader v-if="loading" block />

    <div v-else-if="rows.length === 0" class="pv-12">
      <EmptyState :title="$t('stock.no_warehouses')" icon="warehouse" />
    </div>

    <template v-else>
      <div v-if="dirtyCount > 0" class="sku-stock__actions flex ai-ct jc-fe gap-5 mb-5">
        <StatusBadge tone="warning" :dot="false" :label="`${$t('stock.unsaved')}: ${dirtyCount}`" />
        <BasicButton mutates variant="primary" @click="saveAll">
          {{ $t("stock.save_all") }}
        </BasicButton>
      </div>

      <DataTable :columns="columns" :rows="rows" row-key="warehouse_code">
        <template #cell-source_type="{ row }">
          <StatusBadge
            :label="row.source_type === 'manual' ? $t('stock.source_manual') : $t('stock.source_integration')"
            :tone="row.source_type === 'manual' ? 'positive' : 'neutral'"
          />
        </template>
        <template #cell-quantity="{ row }">
          <NumberInput
            v-if="row.source_type === 'manual'"
            :model-value="getDisplayQty(row)"
            :min="0"
            :aria-label="`${$t('stock.quantity')}: ${row.warehouse_name}`"
            @update:model-value="(val) => onQtyChange(row.warehouse_code, val)"
          />
          <span v-else class="t-muted">{{ row.quantity }}</span>
        </template>
      </DataTable>
    </template>
  </div>
</template>

<script>
import { useLoaderStore } from "@/stores/loader"
import { useNotifyStore } from "@/stores/notify"
import { GET_StockBySku, PATCH_StockBySku } from "@/api/stock/api"
import { extractApiMessage } from "@/composables/useFormErrors"

export default {
  name: "StockTab",
  props: {
    sku: { type: String, required: true },
    embedded: { type: Boolean, default: true },
  },
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    return { loader, notify }
  },
  data() {
    return {
      rows: [],
      loading: false,
      dirtyItems: {},
    }
  },
  computed: {
    dirtyCount() {
      return Object.keys(this.dirtyItems).length
    },
    columns() {
      return [
        { key: "warehouse_name", label: this.$t("stock.warehouse") },
        { key: "source_type", label: this.$t("stock.source_manual"), width: "max-content" },
        { key: "quantity", label: this.$t("stock.quantity"), width: "160px" },
      ]
    },
  },
  watch: {
    sku: {
      handler(val) {
        if (val) this.fetchStock()
      },
      immediate: true,
    },
  },
  methods: {
    async fetchStock() {
      if (!this.sku) return
      this.loading = true
      this.dirtyItems = {}
      try {
        const { data } = await GET_StockBySku(this.sku)
        this.rows = data || []
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        })
      } finally {
        this.loading = false
      }
    },
    getDisplayQty(row) {
      return row.warehouse_code in this.dirtyItems
        ? this.dirtyItems[row.warehouse_code]
        : row.quantity
    },
    onQtyChange(warehouseCode, value) {
      const original = this.rows.find((r) => r.warehouse_code === warehouseCode)
      if (original && original.quantity === value) {
        delete this.dirtyItems[warehouseCode]
      } else {
        this.dirtyItems[warehouseCode] = value
      }
      this.dirtyItems = { ...this.dirtyItems }
    },
    async saveAll() {
      if (this.dirtyCount === 0) return
      this.loader.loaderStart()
      try {
        const items = Object.entries(this.dirtyItems).map(([warehouse_code, quantity]) => ({
          warehouse_code,
          quantity,
        }))
        await PATCH_StockBySku(this.sku, { items })
        this.dirtyItems = {}
        this.notify.spawnNotification({ type: "positive", msg: this.$t("stock.saved") })
        this.fetchStock()
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.sku-stock--embedded {
  padding: var(--space-8);
}

.sku-stock__actions {
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
}
</style>
