<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('faq.items')" />
    </template>
    <template #toolbar>
      <div class="item-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="item-list__search"
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
            :active="activeFilter === tab.key"
            @click="setFilter(tab.key)"
          />
          <BasicSelect
            :floating-label="$t('faq.group')"
            :options="groupFilterOptions"
            :model-value="groupFilter"
            class="item-list__group-filter"
            @update:model-value="onGroupFilter"
          />
        </MobileFilterPanel>
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="items"
        :sortable="true"
        row-key="id"
        :empty-text="$t('faq.no_items')"
        @sort="onSort"
        @row-click="onRowClick"
      >
        <template #cell-group_name="{ row }">
          <StatusBadge
            v-if="row.group_name"
            tone="accent"
            :dot="false"
            :label="row.group_name"
          />
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-association_count="{ row }">
          <StatusBadge tone="neutral" :dot="false" :label="(row.associations || []).length" />
        </template>
        <template #cell-is_active="{ value }">
          <StatusBadge
            :label="value ? $t('faq.active') : $t('faq.inactive')"
            :tone="value ? 'positive' : 'negative'"
          />
        </template>
      </DataTable>

    <template #footer>
      <Pagination
        v-if="totalCount > pageSize"
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>

      <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { GET_FaqItems, GET_FaqGroups } from "@/api/faq/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "FaqItemList",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, search, debouncedFetch };
  },
  data() {
    return {
      items: [],
      groups: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      loading: false,
      activeFilter: "all",
      groupFilter: null,
    };
  },
  computed: {
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("faq.create_item"),
          handler: () => this.$router.push("/faq/items/create"),
        },
      ];
    },
    statusTabs() {
      return [
        { key: "all", label: this.$t("faq.filter_all") },
        { key: "active", label: this.$t("faq.filter_active") },
        { key: "inactive", label: this.$t("faq.filter_inactive") },
      ];
    },
    groupFilterOptions() {
      const opts = [{ label: this.$t("faq.all_groups"), value: null }];
      for (const g of this.groups) {
        opts.push({ label: g.name || g.idx, value: g.id });
      }
      return opts;
    },
    activeFilterCount() {
      let count = 0;
      if (this.activeFilter !== "all") count++;
      if (this.groupFilter) count++;
      return count;
    },
    columns() {
      return [
        {
          key: "position",
          label: this.$t("faq.position"),
          sortable: true,
          width: "80px",
          priority: 2,
          numeric: true,
        },
        {
          key: "question",
          label: this.$t("faq.question"),
          sortable: true,
          width: "1fr",
        },
        {
          key: "group_name",
          label: this.$t("faq.group"),
          sortable: false,
          width: "160px",
          priority: 2,
        },
        {
          key: "association_count",
          label: this.$t("faq.associations"),
          sortable: false,
          width: "100px",
          priority: 2,
          numeric: true,
        },
        {
          key: "is_active",
          label: this.$t("faq.status"),
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
      this.fetchItems();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchGroups();
    this.fetchItems();
  },
  methods: {
    async fetchGroups() {
      try {
        const channel = process.env.VUE_APP_CHANNEL;
        const { data } = await GET_FaqGroups(channel, { page_size: 100 });
        this.groups = data.results || [];
      } catch {
        // Non-critical — silently ignore
      }
    },
    async fetchItems() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;
        if (this.activeFilter === "active") params.is_active = true;
        if (this.activeFilter === "inactive") params.is_active = false;
        if (this.groupFilter) params.group = this.groupFilter;

        const channel = process.env.VUE_APP_CHANNEL;
        const { data } = await GET_FaqItems(channel, params);
        this.items = data.results || [];
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
    setFilter(key) {
      this.activeFilter = key;
      this.currentPage = 1;
      this.fetchItems();
    },
    onGroupFilter(val) {
      this.groupFilter = val;
      this.currentPage = 1;
      this.fetchItems();
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchItems();
    },
    onSort({ key, direction }) {
      if (!key || key === "group_name" || key === "association_count") {
        this.ordering = null;
      } else {
        this.ordering = direction === "desc" ? `-${key}` : key;
      }
      this.fetchItems();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/faq/items/${row.id}`);
    },
  },
};
</script>

<style lang="scss" scoped>
.item-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.item-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}

.item-list__group-filter {
  min-width: 150px;
  max-width: 200px;
  flex-shrink: 0;
}


</style>
