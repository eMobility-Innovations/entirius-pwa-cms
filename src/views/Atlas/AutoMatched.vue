<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('atlas.auto_matched.title')">
        <!-- the subtitle sits right of the title on desktop, on its own row on a phone (meta never wraps) -->
        <template #actions>
          <span class="fs-200 t-secondary">
            {{ $t("atlas.auto_matched.subtitle") }}
          </span>
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <!-- Filter chip bar -->
      <div class="flex ai-ct flex-wrap gap-2">
        <FilterChip
          :label="$t('atlas.auto_matched.filter.all')"
          :active="!hasViolationsOnly && !manualOverrideOnly && !supplierFilter"
          data-testid="auto-matched-filter-all"
          @click="resetFilters"
        />
        <FilterChip
          :label="$t('atlas.auto_matched.filter.has_violations')"
          :active="hasViolationsOnly"
          data-testid="auto-matched-filter-violations"
          @click="toggleViolations"
        />
        <FilterChip
          :label="$t('atlas.auto_matched.filter.manual_override_only')"
          :active="manualOverrideOnly"
          data-testid="auto-matched-filter-manual-override"
          @click="toggleManualOverride"
        />
      </div>
    </template>

      <Loader block v-show="loading" />

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="$t('atlas.auto_matched.empty_title')"
        :message="$t('atlas.auto_matched.empty_message')"
        icon="link"
      />

      <DataTable
        empty-size="md"
        v-show="!loading && rows.length > 0"
        :columns="columns"
        :rows="rows"
        row-key="sku"
        :empty-text="$t('atlas.auto_matched.empty_title')"
        @row-click="onRowClick"
      >
        <template #cell-suppliers="{ row }">
          <div class="flex ai-ct flex-wrap gap-2">
            <StatusBadge
              v-for="s in row.sources"
              :key="s.idx"
              :label="s.is_primary ? `★ ${s.name || s.idx}` : (s.name || s.idx)"
              :tone="s.is_primary ? 'positive' : 'neutral'"
              :data-testid="`auto-matched-supplier-${row.sku}-${s.idx}`"
            />
          </div>
        </template>
        <template #cell-flags="{ row }">
          <div class="flex ai-ct gap-2">
            <StatusBadge
              v-if="row.has_tolerance_violation"
              :label="$t('atlas.auto_matched.flag.violation')"
              tone="warning"
              :data-testid="`auto-matched-violation-${row.sku}`"
            />
            <StatusBadge
              v-if="row.has_manual_override"
              :label="$t('atlas.auto_matched.flag.manual_override')"
              tone="info"
              :data-testid="`auto-matched-manual-override-${row.sku}`"
            />
          </div>
        </template>
        <template #cell-last_auto_link_at="{ value }">
          <span class="fs-200 t-secondary">{{ formatDate(value) }}</span>
        </template>
      </DataTable>

    <template #footer>
      <Pagination
        v-if="!loading && totalCount > pageSize"
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>
  </PageLayout>
</template>

<script>
import { GET_AutoMatched } from "@/api/atlas/api";
import { useMuninStore } from "@/stores/munin";

export default {
  name: "AutoMatched",
  data() {
    return {
      rows: [],
      loading: false,
      page: 1,
      pageSize: 25,
      totalCount: 0,
      hasViolationsOnly: false,
      manualOverrideOnly: false,
      supplierFilter: "",
    };
  },
  computed: {
    columns() {
      return [
        { key: "sku", label: this.$t("atlas.auto_matched.col.sku"), width: "1fr" },
        { key: "ean", label: this.$t("atlas.auto_matched.col.ean"), numeric: true, priority: 2 },
        {
          key: "suppliers",
          label: this.$t("atlas.auto_matched.col.suppliers"),
        },
        { key: "flags", label: this.$t("atlas.auto_matched.col.flags"), priority: 2 },
        {
          key: "last_auto_link_at",
          label: this.$t("atlas.auto_matched.col.last_auto_link"),
          priority: 2,
        },
      ];
    },
    paginationState() {
      return {
        currentPage: this.page,
        totalPages: Math.max(1, Math.ceil(this.totalCount / this.pageSize)),
        itemsPerPage: this.pageSize,
        totalItems: this.totalCount,
      };
    },
    hasSuppliersPanel() {
      return useMuninStore().isPanelEnabled("atlas");
    },
  },
  watch: {
    hasViolationsOnly() {
      this.fetch();
    },
    manualOverrideOnly() {
      this.fetch();
    },
    supplierFilter() {
      this.fetch();
    },
  },
  mounted() {
    if (!this.hasSuppliersPanel) {
      this.$router.push("/");
      return;
    }
    this.fetch();
  },
  methods: {
    async fetch() {
      this.loading = true;
      try {
        const params = {
          page: this.page,
          page_size: this.pageSize,
        };
        if (this.hasViolationsOnly) params.has_violations = true;
        if (this.manualOverrideOnly) params.manual_override_only = true;
        if (this.supplierFilter) params.source = this.supplierFilter;
        const { data } = await GET_AutoMatched(params);
        this.rows = data?.results || [];
        this.totalCount = data?.count || 0;
      } catch (err) {
        this.rows = [];
        this.totalCount = 0;
        console.error("AutoMatched fetch failed", err);
      } finally {
        this.loading = false;
      }
    },
    resetFilters() {
      this.hasViolationsOnly = false;
      this.manualOverrideOnly = false;
      this.supplierFilter = "";
    },
    toggleViolations() {
      this.hasViolationsOnly = !this.hasViolationsOnly;
    },
    toggleManualOverride() {
      this.manualOverrideOnly = !this.manualOverrideOnly;
    },
    onPageChange(newPage) {
      this.page = newPage;
      this.fetch();
    },
    onRowClick(row) {
      // Deep-link to PIM ProductDetail Supplier tab (etap-06 hash sync wires #supplier).
      this.$router.push(`/pim/products/${encodeURIComponent(row.sku)}#supplier`);
    },
    formatDate(value) {
      if (!value) return "—";
      try {
        const d = new Date(value);
        return d.toLocaleString();
      } catch {
        return value;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
// All styling via design tokens. No hardcoded colours / spacing.
</style>
