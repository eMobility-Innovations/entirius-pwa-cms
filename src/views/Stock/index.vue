<template>
  <div class="stock-panel h-100">
    <PageLayout v-if="!activeWarehouse && !loading">
      <template #header>
        <PageHeader :title="$t('stock.manage')">
          <template v-if="warehouses.length" #actions>
            <StockWarehousePicker />
          </template>
        </PageHeader>
      </template>

      <div class="flex ai-ct jc-ct h-100">
        <EmptyState
          :title="warehouses.length ? $t('stock.select_warehouse') : $t('stock.no_warehouses')"
          icon="stock"
        />
      </div>
    </PageLayout>

    <router-view v-else-if="activeWarehouse" />
  </div>
</template>

<script>
import { useLoaderStore } from "@/stores/loader"
import { useNotifyStore } from "@/stores/notify"
import { GET_Warehouses } from "@/api/stock/api"
import { extractApiMessage } from "@/composables/useFormErrors"
import StockWarehousePicker from "./StockWarehousePicker.vue"

export default {
  name: "StockPanel",
  components: { StockWarehousePicker },
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    return { loader, notify }
  },
  provide() {
    return {
      activeWarehouse: () => this.activeWarehouse,
      stockWarehouses: () => this.sortedWarehouses,
      selectWarehouse: this.onWarehouseSelect,
    }
  },
  data() {
    return {
      warehouses: [],
      activeWarehouse: null,
      loading: false,
    }
  },
  computed: {
    sortedWarehouses() {
      return [...this.warehouses].sort((a, b) => {
        if (a.source_type === b.source_type) return a.name.localeCompare(b.name)
        return a.source_type === "manual" ? -1 : 1
      })
    },
  },
  mounted() {
    this.fetchWarehouses()
  },
  methods: {
    async fetchWarehouses() {
      this.loading = true
      try {
        const { data } = await GET_Warehouses({ is_active: true })
        this.warehouses = data || []
        if (this.warehouses.length && !this.activeWarehouse) {
          this.activeWarehouse = this.sortedWarehouses[0]
        }
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        })
      } finally {
        this.loading = false
      }
    },
    onWarehouseSelect(selected) {
      const code = Array.isArray(selected) ? selected[0] : selected
      this.activeWarehouse = this.warehouses.find((wh) => wh.code === code) || null
    },
  },
}
</script>

<style lang="scss" scoped>
.stock-panel {
  display: flex;
  flex-direction: column;
}
</style>
