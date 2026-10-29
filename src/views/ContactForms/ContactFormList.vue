<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('cf.submissions')" />
    </template>
    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-8 rg-3">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="form-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <BasicSelect
          :floating-label="$t('cf.type')"
          :options="typeFilterOptions"
          :model-value="typeFilter"
          class="form-list__filter"
          @update:model-value="onTypeFilter"
        />
        <BasicSelect
          :floating-label="$t('cf.channel')"
          :options="channelFilterOptions"
          :model-value="channelFilter"
          class="form-list__filter"
          @update:model-value="onChannelFilter"
        />
        <BasicSelect
          :floating-label="$t('cf.status')"
          :options="statusFilterOptions"
          :model-value="statusFilter"
          class="form-list__filter"
          @update:model-value="onStatusFilter"
        />
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="submissions"
        :sortable="true"
        row-key="id"
        :empty-text="$t('cf.no_submissions')"
        @sort="onSort"
        @row-click="onRowClick"
      >
        <template #cell-type="{ value }">
          <span :class="value ? 't-body' : 't-muted'">{{
            value || "—"
          }}</span>
        </template>
        <template #cell-status="{ value }">
          <StatusBadge
            :label="statusLabel(value)"
            :tone="statusVariant(value)"
          />
        </template>
        <template #cell-created_at="{ value }">
          {{ formatDate(value) }}
        </template>
      </DataTable>

    <template v-if="totalCount > pageSize" #footer>
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
import { GET_Submissions, GET_FormTypes } from "@/api/contactForms/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "ContactFormList",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce(400);
    return { loader, notify, search, debouncedFetch };
  },
  data() {
    return {
      submissions: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      loading: false,
      typeFilter: "__all",
      channelFilter: "__all",
      statusFilter: "__all",
      formTypes: [],
    };
  },
  computed: {
    typeFilterOptions() {
      return [
        { label: this.$t("cf.all_types"), value: "__all" },
        ...this.formTypes.map((ft) => ({
          label: ft.label || ft.code,
          value: ft.code,
        })),
      ];
    },
    channelFilterOptions() {
      return [{ label: this.$t("cf.all_channels"), value: "__all" }];
    },
    statusFilterOptions() {
      return [
        { label: this.$t("cf.all_statuses"), value: "__all" },
        { label: this.$t("cf.status_todo"), value: "todo" },
        { label: this.$t("cf.status_in_progress"), value: "in_progress" },
        { label: this.$t("cf.status_done"), value: "done" },
      ];
    },
    columns() {
      return [
        { key: "id", label: this.$t("cf.id"), sortable: false, width: "140px", priority: 2 },
        {
          key: "email",
          label: this.$t("cf.email"),
          sortable: true,
          width: "2fr",
        },
        {
          key: "type",
          label: this.$t("cf.type"),
          sortable: true,
          width: "140px",
          priority: 2,
        },
        {
          key: "status",
          label: this.$t("cf.status"),
          sortable: true,
          width: "140px",
        },
        {
          key: "slug",
          label: this.$t("cf.slug"),
          sortable: false,
          width: "1fr",
          priority: 2,
        },
        {
          key: "channel_idx",
          label: this.$t("cf.channel"),
          sortable: false,
          width: "1fr",
          priority: 2,
        },
        {
          key: "created_at",
          label: this.$t("cf.created_at"),
          sortable: true,
          width: "180px",
          priority: 2,
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
      this.fetchSubmissions();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchFormTypes();
    this.fetchSubmissions();
  },
  methods: {
    async fetchFormTypes() {
      try {
        const channelIdx = process.env.VUE_APP_CHANNEL || "england";
        const { data } = await GET_FormTypes(channelIdx);
        this.formTypes = data.results || [];
      } catch {
        // Non-fatal: fall back to "All Types" only if the catalog can't load.
        this.formTypes = [];
      }
    },
    formatDate(isoStr) {
      if (!isoStr) return "—";
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    onTypeFilter(val) {
      this.typeFilter = val;
      this.currentPage = 1;
      this.fetchSubmissions();
    },
    onChannelFilter(val) {
      this.channelFilter = val;
      this.currentPage = 1;
      this.fetchSubmissions();
    },
    onStatusFilter(val) {
      this.statusFilter = val;
      this.currentPage = 1;
      this.fetchSubmissions();
    },
    statusVariant(status) {
      const map = {
        todo: "warning",
        in_progress: "info",
        done: "positive",
      };
      return map[status] || "neutral";
    },
    statusLabel(status) {
      const map = {
        todo: this.$t("cf.status_todo"),
        in_progress: this.$t("cf.status_in_progress"),
        done: this.$t("cf.status_done"),
      };
      return map[status] || status || "—";
    },
    async fetchSubmissions() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;
        if (this.typeFilter !== "__all") params.type = this.typeFilter;
        if (this.channelFilter !== "__all") params.channel = this.channelFilter;
        if (this.statusFilter !== "__all") params.status = this.statusFilter;

        const { data } = await GET_Submissions(params);
        this.submissions = data.results || [];
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
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchSubmissions();
    },
    onSort({ key, direction }) {
      if (!key) {
        this.ordering = null;
      } else {
        this.ordering = direction === "desc" ? `-${key}` : key;
      }
      this.fetchSubmissions();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/forms/${row.id}`);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.form-list__search {
  flex: 1;
  max-width: 400px;

  // A phone gives the search its own row above the filters.
  @include max-tablet {
    flex-basis: 100%;
    max-width: none;
  }
}

.form-list__filter {
  width: 180px;
  flex-shrink: 0;
}
</style>
