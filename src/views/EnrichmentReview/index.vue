<template>
  <PageLayout class="enrichment-review">
    <template #header>
      <PageHeader :title="$t('enrichment.review.title')">
        <template #meta>
          <SegmentedControl
            v-model="mode"
            :options="modeOptions"
            data-testid="enrichment-mode-switch"
          />
        </template>
        <template #actions>
          <ActionBar :actions="pageActions" />
        </template>
        <template #tabs>
          <RouteTabs :tabs="ENRICHMENT_REVIEW_TABS" />
        </template>
      </PageHeader>
    </template>

    <template #toolbar>
      <div class="flex-column gap-5">
        <div class="flex ai-ct gap-5">
          <div
            class="filter-chip-row"
            role="group"
            :aria-label="$t('enrichment.review.col.status')"
          >
            <FilterChip
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :active="filters.status === opt.value"
              :data-testid="`enrichment-status-${opt.value}`"
              @click="onFilterChange('status', opt.value)"
            />
          </div>
          <span
            class="enrichment-review__count fs-200 t-muted ml-auto"
            data-testid="enrichment-count"
          >
            {{ $t("enrichment.review.matching", { count: totalCount }) }}
          </span>
        </div>

        <div
          v-if="filters.task"
          class="enrichment-review__task flex ai-ct flex-wrap gap-3 fs-300"
          data-testid="enrichment-task-filter"
        >
          <span>
            {{ $t("enrichment.review.task_filter_of") }}
            <router-link :to="taskLink" class="t-accent fw-600" data-testid="enrichment-task-filter-link">
              {{ runLabels[filters.task]?.title || $t("enrichment.tasks.generic") }}
            </router-link>
          </span>
          <BasicButton variant="ghost" size="sm" data-testid="enrichment-task-filter-clear" @click="clearTask">
            {{ $t("enrichment.ai.show_all") }}
          </BasicButton>
          <BatchCorrection class="ml-auto" :task-id="Number(filters.task)" @queued="fetchRows" />
        </div>
        <RunCorrections
          v-else-if="filters.status === 'pending' && mode !== 'focus'"
          :rows="rows"
          :labels="runLabels"
          @queued="fetchRows"
        />

        <MobileFilterPanel
          :active-count="activeFilterCount"
          :trigger-label="$t('enrichment.review.filters')"
          data-testid="enrichment-filters-row"
        >
          <BasicInput
            v-model="filters.search"
            :placeholder="$t('enrichment.review.search_placeholder')"
            :aria-label="$t('enrichment.review.search_placeholder')"
            icon="search"
            class="enrichment-review__search"
            data-testid="enrichment-search-input"
            @input="onSearchChange"
          />
          <BasicSelect
            :floating-label="$t('enrichment.review.col.module')"
            :options="moduleOptions"
            :model-value="filters.target_module"
            data-testid="enrichment-module-filter"
            @update:model-value="(v) => onFilterChange('target_module', v)"
          />
          <BasicSelect
            :floating-label="$t('enrichment.review.col.kind')"
            :options="kindOptions"
            :model-value="filters.target_kind"
            data-testid="enrichment-kind-filter"
            @update:model-value="(v) => onFilterChange('target_kind', v)"
          />
          <BasicSelect
            :floating-label="$t('enrichment.review.col.source')"
            :options="sourceOptions"
            :model-value="filters.source"
            data-testid="enrichment-source-filter"
            @update:model-value="(v) => onFilterChange('source', v)"
          />
          <BasicInput
            v-model="filters.confidence_min"
            type="number"
            :placeholder="$t('enrichment.review.confidence_min')"
            :aria-label="$t('enrichment.review.confidence_min')"
            class="enrichment-review__confidence"
            data-testid="enrichment-confidence-filter"
            @input="onSearchChange"
          />
        </MobileFilterPanel>
      </div>
    </template>

    <div v-bind="tabPanel">
      <ListMode
        v-if="mode === 'list'"
        :rows="rows"
        :runs="runLabels"
        :loading="loading"
        :total-count="totalCount"
        :busy="busy"
        :bulk="!filters.task"
        :status-filter="filters.status"
        @accept="acceptOne"
        @reject="rejectOne"
        @bulk-accept="bulkAsk = 'accept'"
        @bulk-reject="bulkAsk = 'reject'"
        @bulk-undo="bulkAsk = 'undo'"
        @reconfirm="openDrift"
        @row-open="openDetail"
        @preview-product="openProductPreview"
      >
        <template #empty>
          <EmptyState icon="enrich" :title="$t('enrichment.review.empty')" :message="$t('enrichment.review.empty_message')" data-testid="review-empty">
            <div class="flex jc-ct flex-wrap gap-3">
              <BasicButton v-if="narrowed" data-testid="review-empty-clear" @click="clearFilters">
                {{ $t("enrichment.review.clear_filters") }}
              </BasicButton>
              <BasicButton v-if="filters.status !== 'pending'" data-testid="review-empty-pending" @click="onFilterChange('status', 'pending')">
                {{ $t("enrichment.review.show_pending") }}
              </BasicButton>
              <BasicButton v-else-if="filters.task" data-testid="review-empty-applied" @click="onFilterChange('status', 'applied')">
                {{ $t("enrichment.review.show_applied") }}
              </BasicButton>
              <router-link v-if="!narrowed" to="/pim/products" class="enrichment-review__run-link t-accent fw-600" data-testid="review-empty-run">
                {{ $t("enrichment.review.run_ai") }}
              </router-link>
            </div>
          </EmptyState>
        </template>
      </ListMode>
      <ProductMode
        v-else-if="mode === 'product'"
        :rows="rows"
        :loading="loading"
        :busy="busy"
        @accept="acceptOne"
        @reject="rejectOne"
        @updated="patchRow"
        @preview-product="openProductPreview"
      />
      <FocusMode
        v-else
        :rows="rows"
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        :total-count="totalCount"
        :status-filter="filters.status"
        @need-more="loadNextPage"
        @exit="exitFocus"
      />
    </div>

    <!-- Mounted while the list loads (no footer jump); a page change waits for the running fetch or action. -->
    <template v-if="mode !== 'focus' && totalCount > pageSize" #footer>
      <Pagination
        :page="page"
        :pages="Math.ceil(totalCount / pageSize)"
        :disabled="loading || busy"
        @update:page="onPage"
      />
    </template>

    <DriftModal
      :visible="driftVisible"
      :proposal="driftProposal"
      :busy="busy"
      @confirm="confirmDrift"
      @reject="rejectDrift"
      @close="closeDrift"
    />

    <ImportCsvDialog
      :visible="importVisible"
      @imported="onImported"
      @close="importVisible = false"
    />

    <ConfirmDialog
      :open="!!bulkAsk"
      :tone="bulkAsk === 'reject' ? 'danger' : 'default'"
      :title="bulkAsk ? $t(`enrichment.review.bulk.confirm_${bulkAsk}`, { count: totalCount }) : ''"
      :message="bulkAsk ? $t(`enrichment.review.bulk.confirm_${bulkAsk}_message`) : ''"
      :confirm-label="bulkAsk ? $t(`enrichment.review.bulk.${bulkAsk}_all`, { count: totalCount }) : ''"
      confirm-testid="enrichment-bulk-confirm"
      @confirm="runBulk"
      @cancel="bulkAsk = null"
    />

    <SideDrawer
      :visible="!!detail"
      :title="detail ? detailTitle : ''"
      width="720px"
      @close="detail = null"
    >
      <ProposalPanel
        v-if="detail"
        :key="detail.id"
        :proposal="detail"
        :task="detailTask"
        :busy="busy"
        data-testid="enrichment-detail"
        @accept="detailAccept"
        @reject="detailReject"
        @updated="detailUpdated"
      />
    </SideDrawer>

    <ProductPreviewDrawer
      :visible="previewVisible"
      :sku="previewSku"
      :channel-idx="pimChannel.activeChannelIdx"
      @close="closeProductPreview"
    />
  </PageLayout>
</template>

<script>
import { defineAsyncComponent } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { extractApiMessage } from "@/composables/useFormErrors";
import RouteTabs from "@/components/Navigation/RouteTabs.vue";
import { ENRICHMENT_REVIEW_TABS, routeTabPanel } from "@/components/Navigation/nav-routes";
import ListMode from "./ListMode.vue";
import ProductMode from "./ProductMode.vue";
import DriftModal from "./DriftModal.vue";
import ImportCsvDialog from "./ImportCsvDialog.vue";
import ProductPreviewDrawer from "./ProductPreviewDrawer.vue";
import ProposalPanel from "./ProposalPanel.vue";
import { acceptChosen } from "./applyMode";
import BatchCorrection from "./BatchCorrection.vue";
import RunCorrections from "./RunCorrections.vue";
import { runUidOf, subjectName } from "./reviewLogic";
import { noteProductNames } from "./runLabel";
import { useRunLabels } from "./useRunLabels";
import {
  GET_Task,
  GET_Proposals,
  POST_RejectProposal,
  POST_BulkAcceptProposals,
  POST_BulkRejectProposals,
  POST_BulkUndoProposals,
} from "@/api/enrichment/api";

const FocusMode = defineAsyncComponent(() => import("./FocusMode.vue"));

const MODES = ["list", "product", "focus"];
const DEFAULT_NARROWING = { target_module: "__all", target_kind: "__all", source: "__all", confidence_min: "", search: "" };

const STATUS_VALUES = [
  "pending",
  "drifted",
  "applied",
  "rejected",
  "superseded",
  "reverted",
];

export default {
  name: "EnrichmentReview",
  components: { ListMode, ProductMode, FocusMode, DriftModal, ImportCsvDialog, ProductPreviewDrawer, ProposalPanel, BatchCorrection, RunCorrections, RouteTabs },
  setup() {
    const { labels: runLabels, load: loadRuns } = useRunLabels();
    return {
      notify: useNotifyStore(), pimChannel: usePimChannelStore(), ENRICHMENT_REVIEW_TABS,
      tabPanel: routeTabPanel(ENRICHMENT_REVIEW_TABS, "EnrichmentReview"), runLabels, loadRuns,
    };
  },
  data() {
    return {
      mode: MODES.includes(this.$route.query.mode) ? this.$route.query.mode : "list",
      filters: {
        status: this.$route.query.status || "pending",
        target_module: "__all",
        target_kind: "__all",
        source: "__all",
        confidence_min: "",
        search: "",
        task: this.$route.query.task || "",
      },
      rows: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
      loading: false,
      busy: false,
      searchTimer: null,
      driftVisible: false,
      detail: null,
      bulkAsk: null,
      detailTask: null,
      driftProposal: null,
      importVisible: false,
      previewSku: null,
      previewVisible: false,
      // Bumped by every list read and on leaving: only the latest read lands (a slow answer never undoes a filter).
      fetchSeq: 0,
    };
  },
  computed: {
    // A Studio step's proposal has no product: the drawer names its article.
    detailTitle() {
      if (runUidOf(this.detail)) return this.detail.subject_label || this.$t("enrichment.review.studio_article");
      return subjectName(this.detail);
    },
    // Count of the filters in the filter panel (status lives in its own always-visible
    // chip row, so it's excluded) — the badge on the panel's phone trigger.
    activeFilterCount() {
      let n = 0;
      if (this.filters.target_module !== "__all") n += 1;
      if (this.filters.target_kind !== "__all") n += 1;
      if (this.filters.source !== "__all") n += 1;
      if (this.filters.confidence_min !== "" && this.filters.confidence_min != null)
        n += 1;
      if (this.filters.search) n += 1;
      return n;
    },
    pageActions() {
      return [
        { key: "import", role: "secondary", label: this.$t("enrichment.import.open"),
          testid: "enrichment-import-open", onClick: () => (this.importVisible = true) },
      ];
    },
    modeOptions() {
      return [
        {
          value: "list",
          label: this.$t("enrichment.review.modes.list"),
          testid: "enrichment-mode-list",
        },
        {
          value: "product",
          label: this.$t("enrichment.review.modes.product"),
          testid: "enrichment-mode-product",
        },
        {
          value: "focus",
          label: this.$t("enrichment.review.modes.focus"),
          testid: "enrichment-mode-focus",
        },
      ];
    },
    taskLink() {
      return { name: "EnrichmentRuns", query: { task: String(this.filters.task) } };
    },
    // A filter beyond the status chips narrows the list: its empty state offers to clear them.
    narrowed() {
      const f = this.filters;
      return [f.target_module, f.target_kind, f.source].some((v) => v !== "__all") ||
        !!(f.search || f.task) || (f.confidence_min !== "" && f.confidence_min != null);
    },
    statusOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        ...STATUS_VALUES.map((s) => ({
          value: s,
          label: this.$t(`enrichment.status.${s}`),
        })),
      ];
    },
    moduleOptions() {
      return this.distinctOptions("target_module");
    },
    kindOptions() {
      return this.distinctOptions("target_kind");
    },
    sourceOptions() {
      return this.distinctOptions("source");
    },
  },
  watch: {
    // A run picked from the strip (a link to `?task=<id>`) narrows the list to its proposals; clearing it widens it.
    // (Leaving the page changes the query too: only this route's own query counts.)
    "$route.query.task"(task) {
      if (this.$route.name !== "EnrichmentReview" || (task || "") === this.filters.task) return;
      this.onFilterChange("task", task || "");
    },
    mode(val, old) {
      this.$router.replace({
        path: this.$route.path,
        query: { ...this.$route.query, mode: val },
      });
      // Under "All" Focus reads the pending set only: entering or leaving it reloads from the first page.
      if (this.filters.status === "__all" && (val === "focus") !== (old === "focus")) {
        this.page = 1;
        this.fetchRows();
      }
    },
  },
  mounted() {
    this.fetchRows();
    // The import dialog needs the channel/language list; load it once (no-op if already cached).
    if (!this.pimChannel.channels.length) this.pimChannel.fetchChannels();
  },
  beforeUnmount() {
    this.fetchSeq += 1;
  },
  methods: {
    onImported() {
      // New tasks aren't proposals, so the review list won't change — but refresh so any freshly
      // resolved proposals show up, and keep the view live after the operator imports.
      this.fetchRows();
    },
    // Filter dropdown values are derived from the values actually present in the
    // loaded page plus an "All" sentinel — generic across modules, no hardcoding.
    distinctOptions(field) {
      const seen = new Set();
      for (const r of this.rows) {
        if (r[field]) seen.add(r[field]);
      }
      return [
        { value: "__all", label: this.$t("common.all") },
        ...Array.from(seen).map((v) => ({ value: v, label: v })),
      ];
    },
    buildParams() {
      const params = {
        page: this.page,
        page_size: this.pageSize,
        ordering: "-created_at",
      };
      // The "All" chip asks for every status (no status param would mean only pending); Focus walks what is to decide.
      if (this.filters.status)
        params.status = this.filters.status === "__all" ? (this.mode === "focus" ? "pending" : "all") : this.filters.status;
      if (this.filters.target_module !== "__all")
        params.target_module = this.filters.target_module;
      if (this.filters.target_kind !== "__all")
        params.target_kind = this.filters.target_kind;
      if (this.filters.source !== "__all") params.source = this.filters.source;
      if (
        this.filters.confidence_min !== "" &&
        this.filters.confidence_min != null
      ) {
        params.confidence_min = this.filters.confidence_min;
      }
      if (this.filters.search) params.search = this.filters.search;
      if (this.filters.task) params.task = this.filters.task;
      return params;
    },
    // Server-side filter payload (no pagination) reused by bulk accept/reject.
    bulkFilters() {
      const f = {};
      if (this.filters.target_module !== "__all")
        f.target_module = this.filters.target_module;
      if (this.filters.target_kind !== "__all")
        f.target_kind = this.filters.target_kind;
      if (this.filters.source !== "__all") f.source = this.filters.source;
      if (
        this.filters.confidence_min !== "" &&
        this.filters.confidence_min != null
      ) {
        f.confidence_min = this.filters.confidence_min;
      }
      if (this.filters.search) f.search = this.filters.search;
      return f;
    },
    async fetchRows() {
      const mine = ++this.fetchSeq;
      this.loading = true;
      try {
        const { data } = await GET_Proposals(this.buildParams());
        if (mine !== this.fetchSeq) return;
        this.rows = data.results || [];
        this.totalCount = data.count || 0;
        noteProductNames(this.rows);
        this.loadRuns([...this.rows.map((row) => row.task_id), this.filters.task]);
      } catch (err) {
        if (mine !== this.fetchSeq) return;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        this.rows = [];
        this.totalCount = 0;
      } finally {
        if (mine === this.fetchSeq) this.loading = false;
      }
    },
    onFilterChange(field, value) {
      this.filters[field] = value;
      this.page = 1;
      if (field === "status") {
        this.$router.replace({
          path: this.$route.path,
          query: { ...this.$route.query, status: value },
        });
      }
      this.fetchRows();
    },
    clearFilters() {
      Object.assign(this.filters, DEFAULT_NARROWING);
      this.clearTask();
    },
    clearTask() {
      const query = { ...this.$route.query };
      delete query.task;
      this.$router.replace({ path: this.$route.path, query });
      this.onFilterChange("task", "");
    },
    onSearchChange() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.page = 1;
        this.fetchRows();
      }, 300);
    },
    onPage(page) {
      if (this.loading || this.busy) return;
      this.page = page;
      this.fetchRows();
    },
    async loadNextPage() {
      // Focus mode reached the end of the loaded page — pull the next one.
      if (this.page * this.pageSize >= this.totalCount) return;
      this.page += 1;
      await this.fetchRows();
    },
    exitFocus() {
      // Focus walked the whole filtered set — drop back to List with fresh data.
      this.mode = "list";
      this.page = 1;
      this.notify.spawnNotification({
        type: "informative",
        msg: this.$t("enrichment.review.focus_done"),
      });
      this.fetchRows();
    },
    // A list row opens its detail: the full card (preview, Apply / Edit / Reject) in a side panel.
    async openDetail(row) {
      this.detail = row;
      this.detailTask = null;
      if (row.task_id == null) return;
      try {
        const { data } = await GET_Task(row.task_id);
        if (this.detail?.id === row.id) this.detailTask = data;
      } catch {
        // No task: a translation just shows no source text.
      }
    },
    async detailAccept(proposal) {
      await this.acceptOne(proposal);
      if (!this.driftVisible) this.detail = null;
    },
    async detailReject(payload) {
      await this.rejectOne(payload);
      this.detail = null;
    },
    detailUpdated(proposal) {
      this.patchRow(proposal);
      this.detail = proposal;
    },
    openProductPreview(row) {
      this.previewSku = row.subject_ref;
      this.previewVisible = true;
    },
    closeProductPreview() {
      this.previewVisible = false;
    },
    async acceptOne(proposal) {
      if (this.busy) return;
      this.busy = true;
      try {
        const { data } = await acceptChosen(proposal);
        if (data.status === "drifted") {
          // Live value changed since the proposal — force a conscious re-confirm (D2).
          this.driftProposal = data;
          this.driftVisible = true;
          this.patchRow(data);
          return;
        }
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.review.toast.accepted"),
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
    async rejectOne({ proposal, reason }) {
      if (this.busy) return;
      this.busy = true;
      try {
        await POST_RejectProposal(proposal.id, reason ? { reason } : {});
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.review.toast.rejected"),
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
    // The confirmed bulk action: the dialog closes first, the toast reports what ran.
    runBulk() {
      const action = this.bulkAsk;
      this.bulkAsk = null;
      if (action === "accept") return this.bulkAccept();
      if (action === "reject") return this.bulkReject("");
      return this.bulkUndo();
    },
    async bulkAccept() {
      if (this.busy) return;
      this.busy = true;
      try {
        const { data } = await POST_BulkAcceptProposals(this.bulkFilters());
        // etap-09: sync returns the `applied` list inline, async returns `enqueued`.
        const count = data.enqueued ?? (data.applied ? data.applied.length : 0);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.review.toast.bulk_accepted", { count }),
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
    async bulkUndo() {
      if (this.busy) return;
      this.busy = true;
      try {
        const { data } = await POST_BulkUndoProposals(this.bulkFilters());
        // sync returns `reverted`/`blocked` lists inline, async returns `enqueued`.
        const count =
          data.enqueued ?? (data.reverted ? data.reverted.length : 0);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.review.toast.bulk_undone", { count }),
        });
        // Drift-blocked items stayed applied (someone edited them after apply) — surface separately.
        const blocked = data.blocked ? data.blocked.length : 0;
        if (blocked > 0) {
          this.notify.spawnNotification({
            type: "warning",
            msg: this.$t("enrichment.review.toast.bulk_undo_blocked", {
              count: blocked,
            }),
          });
        }
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
    async bulkReject(reason) {
      if (this.busy) return;
      this.busy = true;
      try {
        const payload = this.bulkFilters();
        if (reason) payload.reason = reason;
        const { data } = await POST_BulkRejectProposals(payload);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.review.toast.bulk_rejected", {
            count: data.rejected ?? 0,
          }),
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
    openDrift(proposal) {
      this.driftProposal = proposal;
      this.driftVisible = true;
    },
    closeDrift() {
      this.driftVisible = false;
      this.driftProposal = null;
    },
    async confirmDrift(proposal) {
      // Operator re-confirmed: a second accept on a `drifted` proposal writes through.
      if (this.busy) return;
      this.busy = true;
      try {
        await acceptChosen(proposal);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.review.toast.accepted"),
        });
        this.closeDrift();
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
    async rejectDrift({ proposal, reason }) {
      this.closeDrift();
      await this.rejectOne({ proposal, reason });
    },
    patchRow(updated) {
      const i = this.rows.findIndex((r) => r.id === updated.id);
      if (i > -1) this.rows.splice(i, 1, updated);
    },
  },
};
</script>

<style lang="scss" scoped>
.enrichment-review__count {
  flex-shrink: 0;
  white-space: nowrap;
}
.enrichment-review__task {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
}
.enrichment-review__search {
  min-width: 180px;
  max-width: 260px;
}
.enrichment-review__confidence {
  max-width: 140px;
}
</style>
