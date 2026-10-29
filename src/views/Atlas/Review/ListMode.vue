<template>
  <div class="list-mode">
    <div
      class="flex ai-ct gap-5 mb-8 flex-wrap"
      data-testid="list-bulk-toolbar"
    >
      <span
        class="t-secondary fs-200"
        data-testid="list-selected-count"
        :data-selected-count="selected.length"
      >
        {{
          $t("atlas.review.list.selected_count", { count: selected.length })
        }}
      </span>
      <template v-for="action in bulkActions" :key="action.key">
        <BasicTooltip v-if="action.reason" :text="action.reason">
          <BasicButton :variant="action.variant" :disabled="true" :data-testid="`list-bulk-${action.key}`">
            {{ action.label }}
          </BasicButton>
        </BasicTooltip>
        <BasicButton
          v-else
          :variant="action.variant"
          :disabled="action.disabled"
          :data-testid="`list-bulk-${action.key}`"
          @click="action.onClick"
        >
          {{ action.label }}
        </BasicButton>
      </template>
    </div>

    <Loader block v-show="loading" />
    <DataTable
      empty-size="md"
      v-show="!loading"
      :columns="columns"
      :rows="rows"
      :sortable="true"
      row-key="id"
      :empty-text="$t('atlas.review.empty_state_title')"
      @row-click="openDetail"
    >
      <template #cell-_select="{ row }">
        <BasicCheckbox
          :model-value="selected.includes(row.id)"
          :data-testid="`list-row-checkbox-${row.id}`"
          @click.stop
          @update:model-value="toggleSelect(row.id)"
        >
          <span class="visually-hidden">{{ row.name || row.external_id }}</span>
        </BasicCheckbox>
      </template>
      <template #cell-status="{ value }">
        <StatusBadge :label="value" :tone="statusVariant(value)" />
      </template>
      <template #cell-cost="{ row }">
        <span class="t-body fw-600">
          {{ formatCost(row.cost, row.currency) }}
        </span>
      </template>
    </DataTable>

    <ConfirmDialog
      :open="confirmVisible"
      :tone="(pendingAction === 'reject') ? 'danger' : 'default'"
      @confirm="bulkExecute"
      @cancel="confirmVisible = false"
      :title="$t('atlas.review.list.confirm_title')"
    >
      <template #default>
        <p>
          {{
            $t(`atlas.review.list.confirm_${pendingAction}`, {
              count: selected.length,
            })
          }}
        </p>
      </template>
    </ConfirmDialog>

    <SideDrawer
      :visible="detailVisible"
      :title="detailProduct?.name || ''"
      width="720px"
      @close="closeDetail"
    >
      <div v-if="detailProduct" class="list-detail-wrap">
        <div class="list-detail">
          <ProductCard
            :product="detailProduct"
            @show-raw="onDetailShowRaw"
            @show-gallery="onDetailShowGallery"
          />
          <RawDataPanel :product="detailProduct" />
        </div>
        <div v-if="detailActions.length" class="list-detail__actions">
          <ActionBar :actions="detailActions" />
        </div>
      </div>
    </SideDrawer>

    <RawDataModal
      :visible="rawVisible"
      :product="detailProduct"
      @close="rawVisible = false"
    />
    <GalleryModal
      :visible="galleryVisible"
      :images="detailProduct?.image_urls || []"
      :product-name="detailProduct?.name || ''"
      @close="galleryVisible = false"
    />
  </div>
</template>

<script>
import ProductCard from "./ProductCard.vue";
import RawDataPanel from "./RawDataPanel.vue";
import RawDataModal from "./RawDataModal.vue";
import GalleryModal from "./GalleryModal.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { formatCost } from "@/utils/format";
import {
  GET_SupplierProducts,
  POST_BulkApproveProducts,
  POST_BulkRejectProducts,
  POST_BulkRequeueProducts,
  POST_BulkPush,
  POST_ApproveProduct,
  POST_RejectProduct,
  POST_QueueProduct,
} from "@/api/atlas/api";

const STATUS_VARIANTS = {
  new: "neutral",
  queued: "info",
  approved: "positive",
  rejected: "negative",
  pushed_pending_images: "warning",
  pushed: "positive",
};

const BULK_FN = {
  approve: POST_BulkApproveProducts,
  reject: POST_BulkRejectProducts,
  requeue: POST_BulkRequeueProducts,
};

// Single-product review actions (skip = queue for later).
const ACTION_FN = {
  approve: POST_ApproveProduct,
  reject: POST_RejectProduct,
  skip: POST_QueueProduct,
};

const BULK_LABELS = {
  approve: "atlas.review.list.bulk_approve",
  reject: "atlas.review.list.bulk_reject",
  requeue: "atlas.review.list.bulk_requeue",
  push: "atlas.review.list.push_approved",
};

export default {
  name: "ListMode",
  components: {
    ProductCard,
    RawDataPanel,
    RawDataModal,
    GalleryModal,
  },
  props: {
    filters: { type: Object, required: true },
    kind: { type: String, default: "procurement" },
  },
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      rows: [],
      selected: [],
      loading: false,
      busy: false,
      confirmVisible: false,
      pendingAction: null,
      detailVisible: false,
      detailProduct: null,
      detailBusy: false,
      rawVisible: false,
      galleryVisible: false,
    };
  },
  computed: {
    columns() {
      return [
        { key: "_select", label: "", width: "40px", sortable: false },
        {
          key: "external_id",
          label: this.$t("atlas.review.list.col.external_id"),
          width: "1fr",
          sortable: true,
          priority: 2,
        },
        {
          key: "source_idx",
          label: this.$t("atlas.review.list.col.supplier"),
          width: "120px",
          sortable: false,
          priority: 2,
        },
        {
          key: "name",
          label: this.$t("atlas.review.list.col.name"),
          width: "2fr",
          sortable: true,
        },
        {
          key: "status",
          label: this.$t("atlas.col.status"),
          width: "max-content",
          sortable: true,
        },
        {
          key: "cost",
          label: this.$t("atlas.review.list.col.cost"),
          width: "120px",
          sortable: true,
          numeric: true,
          priority: 2,
        },
        {
          key: "stock",
          label: this.$t("atlas.review.list.col.stock"),
          width: "80px",
          sortable: true,
          numeric: true,
          priority: 2,
        },
      ];
    },
    // Bulk actions on the selection: secondary (R5), reject danger; approve and push are PIM-bound, so a
    // monitoring row in the selection locks them: disabled, the reason in a tooltip.
    bulkActions() {
      const selected = this.selected.length > 0;
      const locked = this.hasMonitoringSelected ? this.$t("atlas.products.monitoring_tooltip") : "";
      const procurement = this.kind === "procurement";
      const bulk = (key, variant, enabled, reason = "") => ({
        key,
        label: this.$t(BULK_LABELS[key]),
        variant,
        reason,
        disabled: !enabled || this.busy || Boolean(reason),
        onClick: key === "push" ? this.bulkPush : () => this.bulkConfirm(key),
      });
      return [
        procurement && bulk("approve", "secondary", selected, locked),
        bulk("reject", "danger", selected),
        bulk("requeue", "secondary", this.hasRejectedSelected),
        procurement && bulk("push", "secondary", this.hasApprovedSelected, locked),
      ].filter(Boolean);
    },
    // The drawer's footer (R5): approve is the one primary, skip secondary, reject danger.
    detailActions() {
      const p = this.detailProduct;
      if (!p) return [];
      const action = (key, label, role, show) =>
        show && {
          key,
          label: this.$t(label),
          role,
          disabled: this.detailBusy,
          testid: `list-detail-${key}`,
          onClick: () => this.detailAction(key),
        };
      return [
        action("approve", "atlas.review.approve_button", "primary", this.canApprove(p)),
        action("skip", "atlas.review.skip_button", "secondary", this.canSkip(p)),
        action("reject", "atlas.review.reject_button", "danger", this.canReject(p)),
      ].filter(Boolean);
    },
    selectedRows() {
      return this.rows.filter((r) => this.selected.includes(r.id));
    },
    hasRejectedSelected() {
      return this.selectedRows.some((r) => r.status === "rejected");
    },
    hasApprovedSelected() {
      return this.selectedRows.some((r) => r.status === "approved");
    },
    hasMonitoringSelected() {
      // Approve/push are PIM-bound; the backend refuses them for monitoring atlas.
      return this.selectedRows.some((r) => r.kind === "monitoring");
    },
  },
  watch: {
    filters: {
      handler() {
        this.fetchRows();
      },
      deep: true,
    },
  },
  mounted() {
    this.fetchRows();
  },
  methods: {
    formatCost,
    statusVariant(value) {
      return STATUS_VARIANTS[value] || "neutral";
    },
    async fetchRows() {
      this.loading = true;
      this.selected = [];
      try {
        const params = { page_size: 50 };
        if (this.filters.supplier && this.filters.supplier !== "__all") {
          params.source = this.filters.supplier;
        }
        if (this.filters.status && this.filters.status !== "__all") {
          params.status = this.filters.status;
        }
        if (this.filters.search) params.search = this.filters.search;
        const { data } = await GET_SupplierProducts(params);
        this.rows = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    toggleSelect(id) {
      const i = this.selected.indexOf(id);
      if (i >= 0) this.selected.splice(i, 1);
      else this.selected.push(id);
    },
    bulkConfirm(action) {
      this.pendingAction = action;
      this.confirmVisible = true;
    },
    async bulkExecute() {
      const fn = BULK_FN[this.pendingAction];
      if (!fn) return;
      this.busy = true;
      try {
        const ids =
          this.pendingAction === "requeue"
            ? this.selectedRows
                .filter((r) => r.status === "rejected")
                .map((r) => r.id)
            : this.selected;
        const { data } = await fn({ ids });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.review.list.toast.bulk_success", {
            count: data.affected_count ?? ids.length,
          }),
        });
        this.confirmVisible = false;
        this.fetchRows();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.busy = false;
      }
    },
    async bulkPush() {
      this.busy = true;
      try {
        const ids = this.selectedRows
          .filter((r) => r.status === "approved")
          .map((r) => r.id);
        await POST_BulkPush({ ids });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.review.list.toast.push_dispatched"),
        });
        this.fetchRows();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.busy = false;
      }
    },
    openDetail(row) {
      this.detailProduct = row;
      this.detailVisible = true;
    },
    closeDetail() {
      this.detailVisible = false;
      this.detailProduct = null;
    },
    onDetailShowRaw() {
      this.rawVisible = true;
    },
    onDetailShowGallery() {
      this.galleryVisible = true;
    },
    isDetailMonitoring(p) {
      // approve + skip(=queue) are PIM-bound and backend-refused for monitoring.
      return p?.kind === "monitoring";
    },
    canApprove(p) {
      return (
        this.kind === "procurement" &&
        !this.isDetailMonitoring(p) &&
        ["new", "queued"].includes(p?.status)
      );
    },
    canSkip(p) {
      return !this.isDetailMonitoring(p) && p?.status === "new";
    },
    canReject(p) {
      return ["new", "queued", "approved"].includes(p?.status);
    },
    async detailAction(action) {
      if (!this.detailProduct || this.detailBusy) return;
      const toastKey = {
        approve: "approved",
        reject: "rejected",
        skip: "skipped",
      }[action];
      this.detailBusy = true;
      try {
        const { data } = await ACTION_FN[action](this.detailProduct.id);
        if (data) this.detailProduct = { ...this.detailProduct, ...data };
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t(`atlas.review.toast.${toastKey}`),
        });
        this.fetchRows();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.detailBusy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.list-mode {
  display: flex;
  flex-direction: column;
}

/* Detail drawer: fill the body so content scrolls and the action bar pins to the bottom. */
.list-detail-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.list-detail {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding-bottom: var(--space-8);
}
.list-detail__actions {
  flex-shrink: 0;
  padding: var(--space-5) var(--space-8);
  margin: 0 calc(-1 * var(--space-8)) calc(-1 * var(--space-8));
  background: var(--surface-base);
  border-top: 1px solid var(--border-subtle);
}
</style>
