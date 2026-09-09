<template>
  <div class="p-500 fs-300 t-basic-800 h-100 ov-h">
    <Teleport to="#reviews-toolbar-left" defer>
      <span class="fw-600 fs-400">{{ $t("reviews.queue") }}</span>
      <span class="fs-200 t-basic-500" data-testid="reviews-count">
        {{ $t("reviews.matching", { count: totalCount }) }}
      </span>
    </Teleport>

    <div class="bg-basic-100 b-basic-300 br-50 h-100 ovy-auto p-500">
      <div class="queue__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('reviews.search_placeholder')"
          icon="search"
          class="queue__search"
          data-testid="reviews-search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <MobileFilterPanel
          :active-count="activeFilterCount"
          :trigger-label="$t('reviews.filters')"
        >
          <p class="fs-200 t-basic-600">{{ $t("reviews.filters") }}</p>
          <FilterChip
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :active="statusFilter === opt.value"
            :data-testid="`reviews-status-${opt.value}`"
            @click="setStatus(opt.value)"
          />
          <Dropdown
            :values="channelOptions"
            :selected="channelFilter ? [channelFilter] : []"
            :placeholder="$t('reviews.all_channels')"
            class="queue__channel-filter"
            data-testid="reviews-channel-filter"
            @onSelect="onChannelFilter"
          />
        </MobileFilterPanel>
      </div>

      <BulkActionBar
        v-if="selectedIds.length"
        :count="selectedIds.length"
        :actions="bulkActions"
        data-testid="reviews-bulk-bar"
        @action="onBulkAction"
        @clear="clearSelection"
      />

      <Loader v-show="loading" />

      <DataTable
        v-show="!loading"
        :columns="columns"
        :rows="rows"
        :sortable="true"
        :selectable="true"
        :multi-select="true"
        row-key="id"
        :empty-text="$t('reviews.empty')"
        @sort="onSort"
        @select="onSelect"
        @row-click="onRowClick"
      >
        <template #cell-created_at="{ value }">
          <span class="fs-200 t-basic-500">{{ formatDate(value) }}</span>
        </template>
        <template #cell-product="{ row }">
          <span class="queue__ellipsis" :title="row.product_name || ''">
            <span class="fw-600">{{ row.sku }}</span>
            <span v-if="row.product_name" class="t-basic-500">
              · {{ row.product_name }}</span
            >
          </span>
        </template>
        <template #cell-name="{ value }">
          {{ value || $t("reviews.anonymous") }}
        </template>
        <template #cell-title="{ row }">
          <span class="queue__ellipsis" :title="row.detail || ''">{{
            row.title
          }}</span>
        </template>
        <template #cell-average_rate="{ value }">
          <span class="queue__stars">{{ formatStars(value) }}</span>
        </template>
        <template #cell-status="{ value }">
          <StatusBadge
            :label="$t(`reviews.status.${value}`)"
            :variant="statusVariant(value)"
          />
        </template>
        <template #cell-actions="{ row }">
          <div v-if="row.status === 'pending'" class="flex ai-ct gap-100">
            <button
              class="queue__btn bg-positive-100 t-positive-300"
              :disabled="busy"
              :data-testid="`reviews-approve-${row.id}`"
              @click.stop="approve(row)"
            >
              {{ $t("reviews.approve") }}
            </button>
            <button
              class="queue__btn bg-negative-100 t-negative-300"
              :disabled="busy"
              :data-testid="`reviews-reject-${row.id}`"
              @click.stop="reject(row)"
            >
              {{ $t("reviews.reject") }}
            </button>
          </div>
          <span v-else class="fs-200 t-basic-400">—</span>
        </template>
      </DataTable>

      <EmptyState
        v-if="!loading && !rows.length"
        icon="star"
        :title="$t('reviews.empty')"
        :message="$t('reviews.empty_message')"
      />

      <Pagination
        v-if="totalCount > pageSize"
        :pagination="paginationState"
        @onChangePage="onPageChange"
      />
    </div>
  </div>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { extractApiMessage } from "@/composables/useFormErrors";
import { formatDate } from "@/utils/format";
import {
  GET_Reviews,
  POST_ApproveReview,
  POST_RejectReview,
  POST_BulkApproveReviews,
  POST_BulkRejectReviews,
  POST_BulkArchiveReviews,
} from "@/api/reviews/api";
import { REVIEW_STATUSES, statusVariant, formatStars } from "./reviewStatus";

const ALL = "__all";

export default {
  name: "ReviewQueue",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, search, debouncedFetch };
  },
  data() {
    return {
      rows: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: "-created_at",
      loading: false,
      busy: false,
      statusFilter: this.$route.query.status || "pending",
      channelFilter: null,
      knownChannels: [],
      selectedIds: [],
    };
  },
  computed: {
    statusOptions() {
      return [
        { value: ALL, label: this.$t("reviews.status.all") },
        ...REVIEW_STATUSES.map((s) => ({
          value: s,
          label: this.$t(`reviews.status.${s}`),
        })),
      ];
    },
    channelOptions() {
      return [
        { label: this.$t("reviews.all_channels"), value: null },
        ...this.knownChannels.map((c) => ({ label: c, value: c })),
      ];
    },
    activeFilterCount() {
      return (this.statusFilter !== ALL ? 1 : 0) + (this.channelFilter ? 1 : 0);
    },
    bulkActions() {
      return [
        {
          key: "approve",
          labelKey: "reviews.bulk.approve",
          buttonClass: "bg-positive-100 t-positive-300",
        },
        {
          key: "reject",
          labelKey: "reviews.bulk.reject",
          buttonClass: "bg-negative-100 t-negative-300",
        },
        {
          key: "archive",
          labelKey: "reviews.bulk.archive",
          buttonClass: "bg-basic-200 t-basic-600",
        },
      ];
    },
    columns() {
      return [
        {
          key: "created_at",
          label: this.$t("reviews.col.created"),
          sortable: true,
          width: "130px",
        },
        {
          key: "product",
          label: this.$t("reviews.col.product"),
          sortable: false,
          width: "minmax(160px, 1fr)",
        },
        {
          key: "name",
          label: this.$t("reviews.col.author"),
          sortable: false,
          width: "130px",
        },
        {
          key: "title",
          label: this.$t("reviews.col.title"),
          sortable: false,
          width: "minmax(180px, 1.5fr)",
        },
        {
          key: "average_rate",
          label: this.$t("reviews.col.rate"),
          sortable: true,
          width: "130px",
        },
        {
          key: "status",
          label: this.$t("reviews.col.status"),
          sortable: true,
          width: "120px",
        },
        {
          key: "channel_idx",
          label: this.$t("reviews.col.channel"),
          sortable: false,
          width: "130px",
        },
        { key: "actions", label: "", sortable: false, width: "170px" },
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
      this.fetchRows();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchRows();
  },
  methods: {
    formatDate,
    formatStars,
    statusVariant,
    buildParams() {
      const params = {
        page: this.currentPage,
        page_size: this.pageSize,
        ordering: this.ordering,
      };
      if (this.statusFilter !== ALL) params.status = this.statusFilter;
      if (this.channelFilter) params.channel_idx = this.channelFilter;
      if (this.search) params.search = this.search;
      return params;
    },
    async fetchRows() {
      this.loading = true;
      try {
        const { data } = await GET_Reviews(this.buildParams());
        this.rows = data.results || [];
        this.totalCount = data.count || 0;
        this.selectedIds = [];
        for (const row of this.rows) {
          if (row.channel_idx && !this.knownChannels.includes(row.channel_idx))
            this.knownChannels.push(row.channel_idx);
        }
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    setStatus(value) {
      this.statusFilter = value;
      this.currentPage = 1;
      this.$router.replace({
        path: this.$route.path,
        query: { ...this.$route.query, status: value, page: undefined },
      });
      this.fetchRows();
    },
    onChannelFilter(value) {
      this.channelFilter = value;
      this.currentPage = 1;
      this.fetchRows();
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchRows();
    },
    onSort({ key, direction }) {
      const sortable = { created_at: true, average_rate: true, status: true };
      this.ordering = sortable[key]
        ? `${direction === "desc" ? "-" : ""}${key}`
        : "-created_at";
      this.fetchRows();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onSelect(selected) {
      this.selectedIds = (selected || []).map((row) =>
        typeof row === "object" ? row.id : row
      );
    },
    clearSelection() {
      this.selectedIds = [];
    },
    onRowClick(row) {
      this.$router.push(`/reviews/${row.id}`);
    },
    async runAction(fn, toastKey) {
      if (this.busy) return;
      this.busy = true;
      try {
        await fn();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t(toastKey),
        });
        await this.fetchRows();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.busy = false;
      }
    },
    approve(row) {
      return this.runAction(
        () => POST_ApproveReview(row.id),
        "reviews.toast.approved"
      );
    },
    reject(row) {
      return this.runAction(
        () => POST_RejectReview(row.id, { reason: "" }),
        "reviews.toast.rejected"
      );
    },
    async onBulkAction(key) {
      if (this.busy || !this.selectedIds.length) return;
      const calls = {
        approve: () => POST_BulkApproveReviews(this.selectedIds),
        reject: () => POST_BulkRejectReviews(this.selectedIds, ""),
        archive: () => POST_BulkArchiveReviews(this.selectedIds),
      };
      this.busy = true;
      try {
        const { data } = await calls[key]();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("reviews.bulk.done", data),
        });
        await this.fetchRows();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.queue__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-200);
  margin-bottom: var(--space-400);
  flex-wrap: wrap;
}
.queue__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
.queue__channel-filter {
  min-width: 150px;
  max-width: 220px;
  flex-shrink: 0;
}
.queue__ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.queue__stars {
  white-space: nowrap;
  letter-spacing: 1px;
}
.queue__btn {
  height: var(--elem-height);
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--fs-200);
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
