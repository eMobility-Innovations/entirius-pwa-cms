<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('dp.points')" />
    </template>
    <template #toolbar>
      <div class="point-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="point-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <BasicSelect
          :floating-label="$t('dp.channel')"
          :model-value="channelFilter"
          :options="channelFilterOptions"
          class="point-list__channel"
          @update:model-value="onChannelFilter"
        />
        <div class="filter-chip-row" role="group" :aria-label="$t('dp.filters')">
          <FilterChip
            v-for="tab in filterTabs"
            :key="tab.key"
            :label="tab.label"
            :active="activeFilter === tab.key"
            @click="setFilter(tab.key)"
          />
        </div>
      </div>
    </template>

    <Loader block v-show="loading" />

    <DataTable
      empty-size="md"
      v-show="!loading"
      :columns="columns"
      :rows="points"
      :sortable="true"
      row-key="id"
      :empty-text="$t('dp.no_points')"
      @sort="onSort"
      @row-click="onRowClick"
    >
      <template #cell-type_name="{ row }">
        <span v-if="row.type" class="flex ai-ct gap-1">
          <font-awesome-icon
            v-if="row.type.is_carrier"
            :icon="$icons.lock"
            data-testid="point-carrier"
          />
          <StatusBadge tone="accent" :dot="false" :label="row.type.name" />
        </span>
        <span v-else class="t-muted">---</span>
      </template>
      <template #cell-is_active="{ value }">
        <StatusBadge
          :label="value ? $t('dp.active') : $t('dp.inactive')"
          :tone="value ? 'positive' : 'negative'"
        />
      </template>
    </DataTable>

    <FloatingActions :actions="fabActions" />

    <template v-if="!loading && points.length && totalCount > pageSize" #footer>
      <Pagination
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
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import {
  GET_Points,
  GET_PointsChannel,
  GET_DPChannels,
} from "@/api/deliverypoints/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";

export default {
  name: "PointList",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, search, debouncedFetch };
  },
  data() {
    return {
      points: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      loading: false,
      activeFilter: "all",
      channelFilter: "__all",
      channels: [],
    };
  },
  computed: {
    channelFilterOptions() {
      const opts = [{ label: this.$t("dp.all_channels"), value: "__all" }];
      for (const ch of this.channels) {
        opts.push({ label: ch.name || ch.idx, value: ch.idx });
      }
      return opts;
    },
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("dp.create_point"),
          handler: () => this.$router.push("/points/create"),
        },
      ];
    },
    filterTabs() {
      return [
        { key: "all", label: this.$t("dp.filter_all") },
        { key: "active", label: this.$t("dp.filter_active") },
        { key: "inactive", label: this.$t("dp.filter_inactive") },
        { key: "carrier", label: this.$t("dp.filter_carrier") },
        { key: "custom", label: this.$t("dp.filter_custom") },
      ];
    },
    columns() {
      return [
        {
          key: "code",
          label: this.$t("dp.code"),
          sortable: true,
          width: "1fr",
        },
        {
          key: "name",
          label: this.$t("dp.name"),
          sortable: true,
          width: "2fr",
        },
        {
          key: "type_name",
          label: this.$t("dp.type"),
          sortable: false,
          width: "160px",
        },
        {
          key: "city",
          label: this.$t("dp.city"),
          sortable: true,
          width: "1fr",
        },
        {
          key: "is_active",
          label: this.$t("dp.status"),
          sortable: true,
          width: "100px",
        },
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
      this.fetchPoints();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchChannels();
    this.fetchPoints();
  },
  methods: {
    async fetchChannels() {
      try {
        const { data } = await GET_DPChannels({ page_size: 100 });
        this.channels = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    onChannelFilter(val) {
      this.channelFilter = val;
      this.currentPage = 1;
      this.fetchPoints();
    },
    async fetchPoints() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;

        if (this.activeFilter === "active") {
          params.is_active = true;
        } else if (this.activeFilter === "inactive") {
          params.is_active = false;
        } else if (this.activeFilter === "carrier") {
          params.type = "carrier";
        } else if (this.activeFilter === "custom") {
          params.type = "custom";
        }

        const { data } =
          this.channelFilter !== "__all"
            ? await GET_PointsChannel(this.channelFilter, params)
            : await GET_Points(params);
        this.points = data.results || [];
        this.totalCount = data.count || 0;
        if (!this.points.length && this.currentPage > 1) this.resetToFirstPage();
      } catch (err) {
        if (isNotFound(err) && this.currentPage > 1) return this.resetToFirstPage();
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    setFilter(key) {
      this.activeFilter = key;
      this.currentPage = 1;
      this.fetchPoints();
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchPoints();
    },
    onSort({ key, direction }) {
      if (!key || key === "type_name") {
        this.ordering = null;
      } else {
        this.ordering = direction === "desc" ? `-${key}` : key;
      }
      this.fetchPoints();
    },
    // A stale `?page=N` (the list shrank, a filter changed) comes back empty or 404: go to page 1, never an empty page
    // without a pager. Dropping the query key refetches through the `$route.query.page` watcher.
    resetToFirstPage() {
      const { page, ...query } = this.$route.query;
      this.$router.replace({ path: this.$route.path, query });
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/points/${row.id}`);
    },
  },
};
</script>

<style lang="scss" scoped>
.point-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}
.point-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}

.point-list__channel {
  min-width: 150px;
  max-width: 200px;
  flex-shrink: 0;
}
</style>
