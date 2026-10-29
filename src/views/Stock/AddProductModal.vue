<template>
  <BasicModal
    :open="true"
    size="sm"
    :title="$t('stock.add_products_title')"
    :actions="footerActions"
    @close="$emit('close')"
  >
    <div class="add-product__toolbar flex ai-ct gap-5 mb-5">
      <BasicInput
        v-model="search"
        :placeholder="$t('stock.search_sku')"
        :aria-label="$t('stock.search_sku')"
        icon="search"
        class="add-product__search"
        @input="debouncedSearch"
      />
      <FilterChip
        :label="$t('stock.filter_without_stock')"
        :active="onlyMissing"
        @click="onlyMissing = !onlyMissing; fetchProducts()"
      />
    </div>

    <Loader v-if="loading" block />

    <div v-else-if="products.length === 0" class="pv-8 fs-300 t-muted">
      {{ $t("stock.no_products_found") }}
    </div>

    <div v-else class="add-product__list">
      <div
        v-for="p in products"
        :key="p.sku"
        class="add-product__row flex ai-ct jc-sb"
        @click="toggleSku(p.sku)"
      >
        <BasicCheckbox
          :model-value="selectedSkus.has(p.sku)"
          @update:model-value="toggleSku(p.sku)"
          @click.stop
        >
          <span class="fw-500">{{ p.sku }}</span>
        </BasicCheckbox>
        <StatusBadge
          v-if="p.has_stock"
          :label="String(p.quantity)"
          tone="neutral"
        />
        <span v-else class="fs-200 t-muted">{{ $t("stock.no_stock_yet") }}</span>
      </div>
    </div>

    <div v-if="totalCount > pageSize" class="mt-5">
      <Pagination
        :page="currentPage"
        :pages="Math.ceil(totalCount / pageSize)"
        @update:page="onPageChange"
      />
    </div>

  </BasicModal>
</template>

<script>
import { GET_WarehouseProducts } from "@/api/stock/api"

export default {
  name: "AddProductModal",
  props: {
    warehouseCode: { type: String, required: true },
  },
  emits: ["close", "add"],
  data() {
    return {
      products: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      search: "",
      onlyMissing: true,
      loading: false,
      selectedSkus: new Set(),
      _debounceTimer: null,
    }
  },
  computed: {
    footerActions() {
      return [
        { key: "cancel", label: this.$t("common.cancel"), role: "secondary", onClick: () => this.$emit("close") },
        {
          key: "add",
          label: `${this.$t("stock.add_selected")} (${this.selectedSkus.size})`,
          role: "primary",
          disabled: this.selectedSkus.size === 0,
          onClick: this.addSelected,
        },
      ]
    },
  },
  mounted() {
    this.fetchProducts()
  },
  methods: {
    async fetchProducts() {
      this.loading = true
      try {
        const params = { page: this.currentPage, page_size: this.pageSize }
        if (this.search) params.search = this.search
        if (this.onlyMissing) params.has_stock = "false"
        const { data } = await GET_WarehouseProducts(this.warehouseCode, params)
        this.products = data.results || []
        this.totalCount = data.count || 0
      } catch {
        this.products = []
      } finally {
        this.loading = false
      }
    },
    debouncedSearch() {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
        this.currentPage = 1
        this.fetchProducts()
      }, 300)
    },
    toggleSku(sku) {
      const next = new Set(this.selectedSkus)
      if (next.has(sku)) {
        next.delete(sku)
      } else {
        next.add(sku)
      }
      this.selectedSkus = next
    },
    onPageChange(page) {
      this.currentPage = page
      this.fetchProducts()
    },
    addSelected() {
      this.$emit("add", [...this.selectedSkus])
      this.$emit("close")
    },
  },
}
</script>

<style lang="scss" scoped>
.add-product__search {
  flex: 1;
  min-width: 150px;
}

.add-product__list {
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
}

.add-product__row {
  padding: var(--space-2) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);

  &:last-child {
    border-bottom: none;
  }
}
</style>
