<template>
  <PageLayout class="order-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('checkout_orders.orders')">
        <template v-if="channels.length > 1" #meta>
          <FormField :label="$t('checkout_orders.channel')" layout="inline">
            <BasicSelect
              :options="channelOptions"
              :model-value="activeChannel"
              :placeholder="$t('checkout_orders.channel')"
              class="order-list__channel-dropdown"
              @update:model-value="onChannelChange"
            />
          </FormField>
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="order-list__toolbar">
        <BasicInput
          v-model="search"
          icon="search"
          :placeholder="$t('checkout_orders.search_placeholder')"
          class="order-list__search"
          @input="onSearchInput"
        />
        <div class="filter-chip-row" role="group" :aria-label="$t('checkout_orders.filters')">
          <FilterChip
            v-for="tab in statusTabs"
            :key="tab.key"
            :label="tab.label"
            :active="selectedStatus === tab.key"
            @click="setStatusFilter(tab.key)"
          />
        </div>
      </div>
    </template>

      <Loader block v-show="loading" />

      <!-- Table -->
      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="orders"
        :clickable="true"
        :empty-text="$t('checkout_orders.no_orders')"
        @row-click="onRowClick"
      >
        <template #status="{ row }">
          <StatusBadge
            :label="statusLabel(row.status)"
            :tone="statusVariant(row.status)"
          />
        </template>
        <template #total_gross="{ row }">
          <span v-if="row.total_gross"
            >{{ row.total_gross }} {{ row.currency }}</span
          >
          <span v-else class="t-muted">-</span>
        </template>
        <template #created="{ row }">
          {{ formatDate(row.created) }}
        </template>
      </DataTable>

      <!-- Pagination -->
      <Pagination
        v-if="totalCount > pageSize"
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
  </PageLayout>
</template>

<script>
import { GET_Orders } from "@/api/orders/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { formatDate } from "@/utils/format";

const STATUS_VARIANTS = {
  UNPAID: "warning",
  NEW: "warning",
  CONFIRMED: "positive",
  HOLDED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "positive",
  RETURNED: "neutral",
  CANCELED: "negative",
};

export default {
  name: "OrderList",
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  data() {
    return {
      orders: [],
      totalCount: 0,
      loading: false,
      selectedStatus: "all",
      search: "",
      searchTimer: null,
      pageSize: 20,
      activeChannel: process.env.VUE_APP_CHANNEL || "default-local",
      channels: [],
      columns: [
        {
          key: "pretty_id",
          label: this.$t("checkout_orders.order_id"),
          width: "120px",
          priority: 2,
        },
        {
          key: "billing_email",
          label: this.$t("checkout_orders.email"),
          width: "1fr",
        },
        {
          key: "status",
          label: this.$t("checkout_orders.status"),
          width: "130px",
        },
        {
          key: "total_gross",
          label: this.$t("checkout_orders.total"),
          width: "120px",
          priority: 2,
          numeric: true,
        },
        {
          key: "item_count",
          label: this.$t("checkout_orders.items"),
          width: "80px",
          priority: 2,
          numeric: true,
        },
        {
          key: "created",
          label: this.$t("checkout_orders.created"),
          width: "140px",
          priority: 2,
        },
      ],
    };
  },
  computed: {
    currentPage() {
      return parseInt(this.$route.query.page || "1", 10);
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
    statusTabs() {
      return [
        { key: "all", label: this.$t("checkout_orders.all_statuses") },
        { key: "unpaid", label: this.$t("checkout_orders.statuses.UNPAID") },
        {
          key: "confirmed",
          label: this.$t("checkout_orders.statuses.CONFIRMED"),
        },
        {
          key: "in_progress",
          label: this.$t("checkout_orders.statuses.IN_PROGRESS"),
        },
        {
          key: "completed",
          label: this.$t("checkout_orders.statuses.COMPLETED"),
        },
        {
          key: "returned",
          label: this.$t("checkout_orders.statuses.RETURNED"),
        },
        {
          key: "canceled",
          label: this.$t("checkout_orders.statuses.CANCELED"),
        },
      ];
    },
    channelOptions() {
      return this.channels.map((ch) => ({
        label: ch.label || ch.idx,
        value: ch.idx,
      }));
    },
  },
  watch: {
    "$route.query"() {
      this.fetchOrders();
    },
  },
  mounted() {
    if (this.$route.query.status)
      this.selectedStatus = this.$route.query.status;
    if (this.$route.query.channel)
      this.activeChannel = this.$route.query.channel;
    this.fetchChannels();
    this.fetchOrders();
  },
  methods: {
    async fetchChannels() {
      // TODO: replace with admin channels endpoint when available
      this.channels = [
        { idx: "default-local", label: "Default Local" },
        { idx: "default-europe", label: "Default Europe" },
      ];
    },
    async fetchOrders() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.email = this.search;
        if (this.selectedStatus && this.selectedStatus !== "all")
          params.status = this.selectedStatus;
        const { data } = await GET_Orders(this.activeChannel, params);
        this.orders = data.results || [];
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
    onSearchInput() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.updateQuery({ page: 1 }), 400);
    },
    setStatusFilter(key) {
      this.selectedStatus = key;
      this.updateQuery({ page: 1, status: key === "all" ? undefined : key });
    },
    onChannelChange(value) {
      this.activeChannel = value;
      this.updateQuery({ page: 1, channel: value });
    },
    onPageChange(page) {
      this.updateQuery({ page });
    },
    updateQuery(overrides) {
      const q = { ...this.$route.query, ...overrides };
      Object.keys(q).forEach((k) => {
        if (!q[k]) delete q[k];
      });
      this.$router.replace({ query: q });
    },
    onRowClick(row) {
      this.$router.push({
        name: "OrderDetail",
        params: { uid: row.pretty_id || row.order_id },
        query: { channel: this.activeChannel },
      });
    },
    statusVariant(s) {
      return STATUS_VARIANTS[(s || "").toUpperCase()] || "neutral";
    },
    statusLabel(s) {
      const k = `checkout_orders.statuses.${(s || "").toUpperCase()}`;
      const t = this.$t(k);
      return t !== k ? t : s;
    },
    formatDate(d) {
      return d ? formatDate(d) : "-";
    },
  },
};
</script>

<style lang="scss" scoped>
.order-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-5);
}
.order-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
.order-list__channel-dropdown {
  min-width: 160px;
}
</style>
