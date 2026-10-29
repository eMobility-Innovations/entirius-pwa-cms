<template>
  <div class="updated-mode">
    <div class="updated-mode__header flex ai-ct jc-sb mb-5 flex-wrap gap-5">
      <div>
        <h3 class="fs-300 fw-600 m-0">
          {{ $t("atlas.review.updated.title") }}
        </h3>
        <p class="fs-200 t-muted mt-2 mb-0">
          {{ $t("atlas.review.updated.help") }}
        </p>
      </div>
      <div class="flex ai-ct gap-5">
        <span
          v-if="!loading"
          class="fs-200 t-secondary"
          data-testid="updated-counter"
        >
          {{ $t("atlas.review.updated.counter", {
            updated: updatedRowsCount,
            total: rows.length,
          }) }}
        </span>
      </div>
    </div>

    <div
      v-if="perSupplierCounts.length"
      class="flex ai-ct flex-wrap gap-2 mb-8"
      data-testid="updated-sidebar"
    >
      <FilterChip
        :label="$t('common.all')"
        :active="!filters.supplier || filters.supplier === '__all'"
        :count="updatedRowsCount"
        data-testid="updated-chip-all"
      />
      <FilterChip
        v-for="entry in perSupplierCounts"
        :key="entry.idx"
        :label="entry.name"
        :active="filters.supplier === entry.idx"
        :count="entry.count"
        :data-testid="`updated-chip-${entry.idx}`"
      />
    </div>

    <BulkActionBar
      v-if="selected.length"
      :count="selected.length"
      selected-label-key="atlas.products.bulk.items_selected"
      clear-label-key="atlas.products.bulk.clear"
      :actions="bulkActions"
      data-testid="updated-bulk-bar"
      @action="handleBulkAction"
      @clear="clearSelection"
    />

    <Loader block v-show="loading" />

    <DataTable
      v-show="!loading"
      :columns="columns"
      :rows="visibleRows"
      row-key="id"
      selectable
      multi-select
      @select="onSelect"
    >
      <template #cell-source_name="{ row }">
        <span class="fs-200">{{ row.source_name || row.source_idx || "—" }}</span>
      </template>
      <template #cell-status="{ value }">
        <StatusBadge :label="value" :tone="statusVariant(value)" />
      </template>
      <template #cell-updated="{ row }">
        <StatusBadge
          v-if="isRowUpdated(row)"
          :label="$t('atlas.products.col.updated')"
          tone="warning"
          :data-testid="`updated-badge-${row.id}`"
        />
      </template>
      <template #cell-cost="{ row }">
        <span>{{ formatCost(row.cost, row.currency) }}</span>
      </template>
      <template #cell-last_change="{ row }">
        <span class="fs-200 t-secondary">{{ formatDate(row.data_changed_at) }}</span>
      </template>
      <template #empty>
        <EmptyState
          icon="notificationsOff"
          :title="$t('atlas.review.updated.empty')"
          :message="$t('atlas.review.updated.empty_message')"
        />
      </template>
    </DataTable>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useAtlasBulkActions } from "@/composables/useAtlasBulkActions";
import { formatCost, formatDate } from "@/utils/format";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_SupplierProducts } from "@/api/atlas/api";

const STATUS_VARIANTS = {
  new: "neutral",
  queued: "info",
  approved: "positive",
  rejected: "negative",
  pushed_pending_images: "warning",
  pushed: "positive",
};

const UPDATED_STATUSES = new Set(["pushed", "pushed_pending_images"]);

export default {
  name: "UpdatedMode",
  props: {
    filters: { type: Object, required: true },
    kind: { type: String, default: "procurement" },
  },
  setup() {
    return { notify: useNotifyStore(), bulk: useAtlasBulkActions() };
  },
  data() {
    return {
      rows: [],
      selected: [],
      loading: false,
      bulkBusy: false,
    };
  },
  computed: {
    columns() {
      return [
        {
          key: "external_id",
          label: this.$t("atlas.review.list.col.external_id"),
          width: "100px",
        },
        {
          key: "source_name",
          label: this.$t("atlas.col.name"),
          width: "140px",
        },
        {
          key: "name",
          label: this.$t("atlas.review.list.col.name"),
          width: "minmax(180px, 1fr)",
        },
        {
          key: "status",
          label: this.$t("atlas.col.status"),
          width: "100px",
        },
        {
          key: "updated",
          label: this.$t("atlas.products.col.updated"),
          width: "100px",
        },
        {
          key: "cost",
          label: this.$t("atlas.review.list.col.cost"),
          width: "100px",
        },
        {
          key: "last_change",
          label: this.$t("atlas.review.updated.col.last_change"),
          width: "150px",
        },
      ];
    },
    visibleRows() {
      return this.rows.filter((row) => this.isRowUpdated(row));
    },
    updatedRowsCount() {
      return this.visibleRows.length;
    },
    perSupplierCounts() {
      const acc = new Map();
      for (const row of this.visibleRows) {
        const idx = row.source_idx;
        if (!idx) continue;
        const entry = acc.get(idx) || { idx, name: row.source_name || idx, count: 0 };
        entry.count += 1;
        acc.set(idx, entry);
      }
      return Array.from(acc.values()).sort((a, b) => b.count - a.count);
    },
    bulkActions() {
      const actions = [];
      if (this.kind === "procurement") {
        actions.push({
          key: "force_repush",
          labelKey: "atlas.products.bulk.force_repush_selected",
          variant: "secondary",
        });
      }
      actions.push({
        key: "acknowledge",
        labelKey: "atlas.products.bulk.acknowledge_selected",
        variant: "primary",
      });
      return actions;
    },
  },
  watch: {
    filters: {
      deep: true,
      handler() {
        this.fetchRows();
      },
    },
  },
  mounted() {
    this.fetchRows();
  },
  methods: {
    formatCost,
    formatDate,
    statusVariant(value) {
      return STATUS_VARIANTS[value] || "neutral";
    },
    isRowUpdated(row) {
      if (!row || !UPDATED_STATUSES.has(row.status)) return false;
      if (!row.data_changed_at || !row.pushed_at) return false;
      return new Date(row.data_changed_at).getTime() > new Date(row.pushed_at).getTime();
    },
    onSelect(rows) {
      this.selected = rows;
    },
    clearSelection() {
      this.selected = [];
    },
    async fetchRows() {
      this.loading = true;
      try {
        const params = {
          status: "pushed",
          page_size: 100,
          ordering: "-data_changed_at",
        };
        if (this.filters?.supplier && this.filters.supplier !== "__all") {
          params.source = this.filters.supplier;
        }
        if (this.filters?.search) params.search = this.filters.search;
        const { data } = await GET_SupplierProducts(params);
        this.rows = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        this.rows = [];
      } finally {
        this.loading = false;
      }
    },
    async handleBulkAction(actionKey) {
      if (this.bulkBusy || !this.selected.length) return;
      this.bulkBusy = true;
      try {
        const fn = actionKey === "force_repush" ? this.bulk.forceRepushSps : this.bulk.acknowledgeSps;
        const { succeeded, failed, events } = await fn(this.selected);
        this.reportBulkResult(actionKey, succeeded.length, failed.length);
        this._emitPushEventToasts(events);
        if (succeeded.length) {
          this.selected = [];
          await this.fetchRows();
        }
      } finally {
        this.bulkBusy = false;
      }
    },
    /**
     * etap-08: surface warning events (language_fallback) from bulk push
     * responses as a single aggregated toast, deduplicated by channel.
     */
    _emitPushEventToasts(events) {
      if (!Array.isArray(events) || events.length === 0) return;
      const fallbackChannels = new Set();
      for (const ev of events) {
        if (ev?.event_type === "language_fallback" && ev?.severity === "warning") {
          const ch = ev?.details?.channel_idx;
          if (ch) fallbackChannels.add(ch);
        }
      }
      if (fallbackChannels.size) {
        this.notify.spawnNotification({
          type: "warning",
          msg: this.$t("atlas.push.language_fallback_warning", {
            channels: Array.from(fallbackChannels).join(", "),
          }),
        });
      }
    },
    reportBulkResult(actionKey, successCount, failedCount) {
      const keyMap = {
        force_repush: {
          ok: "atlas.products.bulk.toast.force_repush_succeeded",
          partial: "atlas.products.bulk.toast.force_repush_partial",
        },
        acknowledge: {
          ok: "atlas.products.bulk.toast.acknowledge_succeeded",
          partial: "atlas.products.bulk.toast.acknowledge_partial",
        },
      };
      const keys = keyMap[actionKey];
      if (failedCount === 0 && successCount > 0) {
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t(keys.ok, { count: successCount }),
        });
        return;
      }
      if (failedCount > 0) {
        this.notify.spawnNotification({
          type: failedCount && !successCount ? "negative" : "warning",
          msg: this.$t(keys.partial, { ok: successCount, failed: failedCount }),
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.updated-mode {
  display: flex;
  flex-direction: column;
}
</style>
