<template>
  <div class="flex ai-ct wrap gap-3">
    <ReadonlyOff>
      <BasicSelect
        :floating-label="$t('stock.warehouse')"
        :model-value="warehouse?.code ?? null"
        :options="options"
        class="stock-picker__select"
        @update:model-value="selectWarehouse"
      />
    </ReadonlyOff>
    <StatusBadge
      v-if="warehouse"
      :label="isManual ? $t('stock.source_manual') : $t('stock.source_integration')"
      :tone="isManual ? 'positive' : 'neutral'"
    />
    <span v-if="!isManual && warehouse?.last_synced_at" class="fs-200 t-muted">
      {{ $t("stock.last_synced") }}: {{ formatRelativeTime(warehouse.last_synced_at) }}
    </span>
  </div>
</template>

<script>
import { ReadonlyOff } from "@/composables/useReadonly";
// The panel-wide warehouse choice (P5 page frame: a control for the whole panel leads the PageHeader actions row).
// The Stock panel wrapper owns the warehouses and the active one; this picker only shows and changes them.
export default {
  name: "StockWarehousePicker",
  components: { ReadonlyOff },
  inject: ["activeWarehouse", "stockWarehouses", "selectWarehouse"],
  computed: {
    warehouse() {
      return this.activeWarehouse()
    },
    isManual() {
      return this.warehouse?.source_type === "manual"
    },
    options() {
      return this.stockWarehouses().map((wh) => ({ label: wh.name, value: wh.code }))
    },
  },
  methods: {
    formatRelativeTime(dateStr) {
      const diff = Date.now() - new Date(dateStr).getTime()
      const minutes = Math.floor(diff / 60000)
      if (minutes < 60) return this.$t("stock.time_ago_minutes", { minutes })
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return this.$t("stock.time_ago_hours", { hours })
      return this.$t("stock.time_ago_days", { days: Math.floor(hours / 24) })
    },
  },
}
</script>

<style lang="scss" scoped>
.stock-picker__select {
  min-width: 200px;
  max-width: 300px;
}
</style>
