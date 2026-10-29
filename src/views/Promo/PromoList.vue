<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('nav.promo_list')">
        <template #meta>
          <PromoChannelSelect />
        </template>
      </PageHeader>
    </template>

    <template #toolbar>
      <!-- Discounts / Vouchers: a switch only when there is something to switch to (B-83), or a way back from a
           locked vouchers deep link -->
      <SegmentedControl
        v-if="showTabs"
        v-model="activeTab"
        :options="tabOptions"
        class="mb-8"
      />
      <div v-if="activeTab === 'discounts'" class="promo-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          :aria-label="$t('common.start_typing')"
          icon="search"
          class="promo-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <MobileFilterPanel
          :active-count="activeFilterCount"
          :trigger-label="$t('builder.filters')"
        >
          <p class="fs-200 t-secondary">{{ $t("builder.filters") }}</p>
          <FilterChip
            v-for="tab in statusTabs"
            :key="tab.key"
            :label="tab.label"
            :active="statusFilter === tab.key"
            @click="setStatusFilter(tab.key)"
          />
          <BasicSelect
            :floating-label="$t('promo.col_modifier')"
            :options="modifierOptions"
            :model-value="modifierFilter"
            class="promo-list__modifier-filter"
            @update:model-value="onModifierFilter"
          />
        </MobileFilterPanel>
      </div>
    </template>

    <!-- DISCOUNTS tab -->
    <template v-if="activeTab === 'discounts'">
      <!-- Bulk action bar (visible only when selection exists) -->
      <div v-if="hasSelection" class="promo-list__bulk-bar mb-8">
        <span class="promo-list__bulk-count t-body fw-600">
          {{ $t("promo.bulk_selected", { n: selectionCount }) }}
        </span>
        <div class="promo-list__bulk-actions">
          <BasicButton mutates variant="secondary" @click="startBulk('activate')">
            {{ $t('promo.bulk_activate') }}
          </BasicButton>
          <BasicButton mutates variant="secondary" @click="startBulk('deactivate')">
            {{ $t('promo.bulk_deactivate') }}
          </BasicButton>
          <BasicButton mutates variant="danger" @click="startBulk('delete')">
            {{ $t('promo.bulk_delete') }}
          </BasicButton>
          <BasicButton variant="secondary" @click="clearSelection">
            {{ $t('promo.bulk_clear') }}
          </BasicButton>
        </div>
      </div>

      <!-- Select-all-matching banner -->
      <div
        v-if="pageFullySelected && totalCount > rules.length && !selectAllMatching"
        class="promo-list__select-banner bg-accent-subtle t-strong fs-200 ph-5 pv-2 rounded mb-8"
      >
        {{ $t("promo.bulk_select_all_page", { n: rules.length }) }}
        <BasicButton variant="ghost" size="sm" @click="selectAllMatching = true">
          {{ $t("promo.bulk_select_all_matching", { total: totalCount }) }}
        </BasicButton>
      </div>
      <div
        v-else-if="selectAllMatching"
        class="promo-list__select-banner bg-accent-subtle t-strong fs-200 ph-5 pv-2 rounded mb-8"
      >
        {{ $t("promo.bulk_all_selected", { total: totalCount }) }}
        <BasicButton variant="ghost" size="sm" @click="clearSelection">
          {{ $t("promo.bulk_clear_selection") }}
        </BasicButton>
      </div>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :key="tableKey"
        :columns="columns"
        :rows="rules"
        row-key="id"
        :empty-text="$t('promo.no_rules')"
        :sortable="true"
        :selectable="true"
        :multi-select="true"
        @sort="onSort"
        @row-click="onRowClick"
        @select="onSelect"
      >
        <template #cell-modifier="{ row }">
          <Tag
            :label="modifierShortLabel(row.modifier)"
            :title="modifierLabel(row.modifier)"
          />
        </template>
        <template #cell-code_count="{ row }">
          <CountBadge :count="row.code_count ?? 0" />
        </template>
        <template #cell-is_active="{ row }">
          <StatusBadge
            :label="row.is_active ? $t('promo.active') : $t('promo.inactive')"
            :tone="row.is_active ? 'positive' : 'negative'"
          />
        </template>
        <template #cell-automatic_applications="{ row }">
          <StatusBadge
            v-if="row.automatic_applications"
            :label="$t('promo.automatic')"
            tone="neutral"
          />
          <span v-else class="t-muted">—</span>
        </template>
      </DataTable>

      <FloatingActions :actions="fabActions" />

      <!-- Bulk delete confirmation modal -->
      <ConfirmDialog
        tone="danger"
        :open="pendingBulkAction === 'delete'"
        @confirm="onBulkDeleteAccept"
        @cancel="pendingBulkAction = null"
        :title="$t('promo.bulk_confirm_delete_title')"
      >
        <template #default>
          <p>{{ $t("promo.bulk_confirm_delete", { n: selectionCount }) }}</p>
        </template>
      </ConfirmDialog>
    </template>

    <!-- VOUCHERS tab (gated on the checkout_voucher module) -->
    <template v-else-if="activeTab === 'vouchers'">
      <VouchersSection v-if="vouchersEnabled" />
      <div v-else class="promo-vouchers-disabled">
        <EmptyState
          icon="lock"
          :title="$t('promo.vouchers_unavailable_title')"
          :message="$t('promo.vouchers_unavailable')"
        />
      </div>
    </template>

    <template #footer>
      <Pagination
        v-if="activeTab === 'discounts' && totalCount > pageSize"
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useMuninStore } from "@/stores/munin";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";
import { modifierShortLabel } from "./promo-modifiers";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { GET_DiscountRules, GET_DiscountMeta, POST_BulkRules } from "@/api/promo/api";
import VouchersSection from "./VouchersSection.vue";
import PromoChannelSelect from "./PromoChannelSelect.vue";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "PromoList",
  components: { VouchersSection, PromoChannelSelect },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const munin = useMuninStore();
    const checkoutChannel = useCheckoutChannelStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, munin, checkoutChannel, search, debouncedFetch };
  },
  data() {
    return {
      activeTab:
        this.$route.query.tab === "vouchers" ? "vouchers" : "discounts",
      rules: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      loading: false,
      statusFilter: "all",
      modifierFilter: null,
      modifiers: [],
      targets: [],
      selectedRows: [],
      selectAllMatching: false,
      tableKey: 0,
      pendingBulkAction: null,
    };
  },
  computed: {
    channel() {
      return (
        this.checkoutChannel.activeChannelIdx ||
        process.env.VUE_APP_CHANNEL ||
        "default-local"
      );
    },
    vouchersEnabled() {
      return this.munin.isModuleEnabled("checkout_voucher");
    },
    tabOptions() {
      const tabs = [{ value: "discounts", label: this.$t("promo.tab_discounts") }];
      // Without the voucher module the segment stays hidden; deep links to
      // ?tab=vouchers still land on the locked EmptyState below.
      if (this.vouchersEnabled) {
        tabs.push({ value: "vouchers", label: this.$t("promo.tab_vouchers") });
      }
      return tabs;
    },
    showTabs() {
      return this.tabOptions.length > 1 || this.activeTab !== "discounts";
    },
    statusTabs() {
      return [
        { key: "all", label: this.$t("promo.filter_all") },
        { key: "active", label: this.$t("promo.filter_active") },
        { key: "inactive", label: this.$t("promo.filter_inactive") },
      ];
    },
    modifierOptions() {
      const opts = [{ label: this.$t("promo.all_modifiers"), value: null }];
      for (const m of this.modifiers) {
        opts.push({ label: modifierShortLabel(m.value, m.label), value: m.value });
      }
      return opts;
    },
    activeFilterCount() {
      let count = 0;
      if (this.statusFilter !== "all") count++;
      if (this.modifierFilter) count++;
      return count;
    },
    columns() {
      return [
        {
          key: "name",
          label: this.$t("promo.col_name"),
          sortable: true,
          width: "1fr",
        },
        {
          key: "modifier",
          label: this.$t("promo.col_modifier"),
          sortable: false,
          width: "160px",
          priority: 2,
        },
        {
          key: "target",
          label: this.$t("promo.col_target"),
          sortable: false,
          width: "160px",
          priority: 2,
        },
        {
          key: "code_count",
          label: this.$t("promo.col_codes"),
          sortable: false,
          width: "80px",
          priority: 2,
          numeric: true,
        },
        {
          key: "is_active",
          label: this.$t("promo.col_status"),
          sortable: true,
          width: "100px",
        },
        {
          key: "automatic_applications",
          label: this.$t("promo.col_automatic"),
          sortable: false,
          width: "100px",
          priority: 2,
        },
        {
          key: "priority",
          label: this.$t("promo.col_priority"),
          sortable: true,
          width: "80px",
          priority: 2,
          numeric: true,
        },
      ];
    },
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("promo.create_rule"),
          handler: () => this.$router.push("/promo/create"),
        },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
    selectedIds() {
      return this.selectedRows.map((r) => r.id);
    },
    selectionCount() {
      return this.selectAllMatching ? this.totalCount : this.selectedIds.length;
    },
    hasSelection() {
      return this.selectionCount > 0;
    },
    pageFullySelected() {
      return this.rules.length > 0 && this.selectedRows.length === this.rules.length;
    },
  },
  watch: {
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchRules();
    },
    activeTab(tab) {
      this.$router
        .replace({ query: { ...this.$route.query, tab } })
        .catch(() => {});
    },
    "checkoutChannel.activeChannelIdx"() {
      this.currentPage = 1;
      this.fetchMeta();
      this.fetchRules();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchMeta();
    this.fetchRules();
  },
  methods: {
    modifierLabel(value) {
      const found = this.modifiers.find((m) => m.value === value);
      return found ? found.label : value;
    },
    modifierShortLabel(value) {
      return modifierShortLabel(value, this.modifierLabel(value));
    },
    async fetchMeta() {
      try {
        const { data } = await GET_DiscountMeta(this.channel);
        this.modifiers = data.modifiers || [];
        this.targets = data.targets || [];
      } catch {
        // Non-critical — modifiers may not label if meta fails
      }
    },
    async fetchRules() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;
        if (this.statusFilter === "active") params.is_active = true;
        if (this.statusFilter === "inactive") params.is_active = false;
        if (this.modifierFilter) params.modifier = this.modifierFilter;

        const { data } = await GET_DiscountRules(this.channel, params);
        this.rules = data.results || [];
        this.totalCount = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    listFilters() {
      const filters = {};
      if (this.search) filters.search = this.search;
      if (this.statusFilter === "active") filters.is_active = true;
      if (this.statusFilter === "inactive") filters.is_active = false;
      if (this.modifierFilter) filters.modifier = this.modifierFilter;
      return filters;
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchRules();
    },
    setStatusFilter(key) {
      this.statusFilter = key;
      this.currentPage = 1;
      this.fetchRules();
    },
    onModifierFilter(val) {
      this.modifierFilter = val;
      this.currentPage = 1;
      this.fetchRules();
    },
    onSort({ key, direction }) {
      const sortable = ["name", "is_active", "priority", "created_at"];
      if (!key || !sortable.includes(key)) {
        this.ordering = null;
      } else {
        this.ordering = direction === "desc" ? `-${key}` : key;
      }
      this.fetchRules();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/promo/${row.id}`);
    },
    onSelect(rows) {
      this.selectedRows = rows;
      if (!this.pageFullySelected) {
        this.selectAllMatching = false;
      }
    },
    clearSelection() {
      this.selectedRows = [];
      this.selectAllMatching = false;
      this.tableKey++;
    },
    startBulk(action) {
      if (action === "delete") {
        this.pendingBulkAction = "delete";
      } else {
        this.performBulk(action);
      }
    },
    onBulkDeleteAccept() {
      this.pendingBulkAction = null;
      this.performBulk("delete");
    },
    async performBulk(action) {
      const body = this.selectAllMatching
        ? { action, all_matching: true, filters: this.listFilters() }
        : { action, ids: this.selectedIds };

      this.loader.loaderStart();
      try {
        const { data } = await POST_BulkRules(this.channel, body);
        const affected = data.affected ?? 0;
        const msgKey = action === "delete" ? "promo.bulk_deleted" : "promo.bulk_done";
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t(msgKey, { n: affected }),
        });
        this.clearSelection();
        this.currentPage = 1;
        await this.fetchRules();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.promo-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.promo-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}

.promo-list__modifier-filter {
  min-width: 150px;
  max-width: 220px;
  flex-shrink: 0;
}

.promo-list__bulk-bar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
  padding: var(--space-5);
  background-color: var(--surface-raised);
  border-radius: var(--radius-base);
  border: 1px solid var(--border-subtle);
}

.promo-list__bulk-count {
  font-size: var(--fs-200);
  white-space: nowrap;
}

.promo-list__bulk-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.promo-list__select-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.promo-vouchers-disabled {
  opacity: 0.6;
  pointer-events: none;
}
</style>
