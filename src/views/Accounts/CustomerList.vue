<template>
  <PageLayout class="acc-list__wrapper fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('accounts.customers')" />
    </template>
    <template #toolbar>
      <div class="acc-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="acc-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <BasicSelect
          :floating-label="$t('accounts.group')"
          v-if="groupOptions.length"
          :options="groupOptions"
          :model-value="groupFilter"
          class="acc-list__filter-dropdown"
          @update:model-value="setGroupFilter"
        />
        <BasicSelect
          :floating-label="$t('accounts.channel')"
          v-if="channelOptions.length"
          :options="channelOptions"
          :model-value="channelFilter"
          class="acc-list__filter-dropdown"
          @update:model-value="setChannelFilter"
        />
        <div class="filter-chip-row" role="group" :aria-label="$t('accounts.filters')">
          <FilterChip
            v-for="tab in statusTabs"
            :key="tab.key"
            :label="tab.label"
            :active="statusFilter === tab.key"
            @click="setStatusFilter(tab.key)"
          />
        </div>
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="customers"
        :sortable="true"
        row-key="uid"
        :empty-text="$t('accounts.no_customers')"
        @sort="onSort"
        @row-click="onRowClick"
      >
        <template #cell-name="{ row }">
          {{ row.firstname }} {{ row.lastname }}
        </template>
        <template #cell-group="{ value }">
          <span v-if="value" class="bg-accent-subtle t-strong fs-200 ph-2 rounded">
            {{ value }}
          </span>
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-source_channel="{ value }">
          <span v-if="value" class="t-secondary fs-200">{{ value }}</span>
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-status="{ row }">
          <div class="flex flex-wrap gap-2">
            <StatusBadge
              :label="row.is_active ? $t('accounts.active') : $t('accounts.inactive')"
              :tone="row.is_active ? 'positive' : 'negative'"
            />
            <StatusBadge
              v-if="row.is_verified"
              :label="$t('accounts.verified')"
              tone="info"
            />
          </div>
        </template>
        <template #cell-created_at="{ value }">
          {{ formatDate(value) }}
        </template>
      </DataTable>

      <Pagination
        v-if="totalCount > pageSize"
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import {
  GET_Customers,
  GET_AccountsGroups,
  GET_AccountsChannels,
} from "@/api/accounts/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "CustomerList",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, search, debouncedFetch };
  },
  data() {
    return {
      customers: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      loading: false,
      statusFilter: "all",
      groupFilter: null,
      channelFilter: null,
      groupOptions: [],
      channelOptions: [],
    };
  },
  computed: {
    statusTabs() {
      return [
        { key: "all", label: this.$t("accounts.status") + ": All" },
        { key: "active", label: this.$t("accounts.active") },
        { key: "inactive", label: this.$t("accounts.inactive") },
        { key: "verified", label: this.$t("accounts.verified") },
        { key: "not_verified", label: this.$t("accounts.not_verified") },
      ];
    },
    columns() {
      return [
        { key: "email", label: "Email", sortable: true, width: "1fr" },
        { key: "name", label: this.$t("accounts.name"), sortable: false, width: "180px", priority: 2 },
        { key: "group", label: this.$t("accounts.group"), sortable: false, width: "120px", priority: 2 },
        { key: "source_channel", label: this.$t("accounts.channel"), sortable: false, width: "140px", priority: 2 },
        { key: "status", label: this.$t("accounts.status"), sortable: false, width: "240px" },
        { key: "created_at", label: this.$t("accounts.created"), sortable: true, width: "140px", priority: 2 },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
  },
  watch: {
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchCustomers();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchCustomers();
    this.fetchFilterOptions();
  },
  methods: {
    async fetchCustomers() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;
        if (this.groupFilter) params.group = this.groupFilter;
        if (this.channelFilter) params.source_channel = this.channelFilter;

        if (this.statusFilter === "active") params.is_active = true;
        else if (this.statusFilter === "inactive") params.is_active = false;
        else if (this.statusFilter === "verified") params.is_verified = true;
        else if (this.statusFilter === "not_verified") params.is_verified = false;

        const { data } = await GET_Customers(params);
        this.customers = data.results || [];
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
    async fetchFilterOptions() {
      try {
        const [groupsRes, channelsRes] = await Promise.all([
          GET_AccountsGroups({ page_size: 100 }),
          GET_AccountsChannels({ page_size: 100 }),
        ]);
        this.groupOptions = (groupsRes.data.results || []).map((g) => ({
          label: g.name,
          value: g.code,
        }));
        this.channelOptions = (channelsRes.data.results || []).map((c) => ({
          label: c.label,
          value: c.idx,
        }));
      } catch {
        // Filters won't show — non-blocking
      }
    },
    setStatusFilter(key) {
      this.statusFilter = key;
      this.currentPage = 1;
      this.fetchCustomers();
    },
    setGroupFilter(val) {
      this.groupFilter = this.groupFilter === val ? null : val;
      this.currentPage = 1;
      this.fetchCustomers();
    },
    setChannelFilter(val) {
      this.channelFilter = this.channelFilter === val ? null : val;
      this.currentPage = 1;
      this.fetchCustomers();
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchCustomers();
    },
    onSort({ key, direction }) {
      if (!key) {
        this.ordering = null;
      } else {
        const mapping = { email: "email", created_at: "created_at" };
        const field = mapping[key] || key;
        this.ordering = direction === "desc" ? `-${field}` : field;
      }
      this.fetchCustomers();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/accounts/customers/${row.uid}`);
    },
    formatDate(dateStr) {
      if (!dateStr) return "—";
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.acc-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-5);
}

.acc-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}

.acc-list__filter-dropdown {
  min-width: 120px;
  max-width: 200px;
}
</style>
