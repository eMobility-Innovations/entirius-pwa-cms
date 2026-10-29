<template>
  <PageLayout class="task-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('enrichment.review.title')" :crumbs="[]">
        <template #tabs>
          <RouteTabs :tabs="ENRICHMENT_REVIEW_TABS" />
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="flex ai-ct gap-5">
        <div class="filter-chip-row" role="group" :aria-label="$t('enrichment.tasks.col_status')">
          <FilterChip
            v-if="taskFilter"
            :label="pickedLabel"
            active
            data-testid="enrichment-task-single"
            @click="onFilterChange(ALL)"
          />
          <FilterChip
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :active="!taskFilter && statusFilter === opt.value"
            :data-testid="`enrichment-task-status-${opt.value}`"
            @click="onFilterChange(opt.value)"
          />
        </div>
        <span class="task-list__count fs-200 t-muted ml-auto">
          {{ $t("enrichment.tasks.matching", { count: totalCount }) }}
        </span>
      </div>
    </template>

    <div class="flex-column gap-8" v-bind="tabPanel">
      <WorkerAlerts />
      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="tasks"
        row-key="id"
        :empty-text="$t('enrichment.tasks.empty')"
        @row-click="onRowClick"
      >
        <template v-if="statusFilter !== ALL || taskFilter" #empty>
          <EmptyState icon="empty" size="md" :title="$t('enrichment.tasks.empty_filtered')" data-testid="tasks-empty-filtered">
            <BasicButton data-testid="tasks-show-all" @click="onFilterChange(ALL)">{{ $t("enrichment.tasks.show_all") }}</BasicButton>
          </EmptyState>
        </template>
        <template #cell-task="{ row }">
          <span class="task-list__task flex-column">
            <span class="task-list__name fw-600 t-strong" :title="nameOf(row)">{{ nameOf(row) }}</span>
            <span v-if="scopeOf(row)" class="task-list__name fs-200 t-muted" :title="scopeOf(row)">{{ scopeOf(row) }}</span>
          </span>
        </template>
        <template #cell-status="{ row }">
          <span v-if="isQueued(row)" class="flex-column gap-1" data-testid="enrichment-task-queued">
            <StatusBadge :label="$t('enrichment.task_status.queued')" tone="info" />
            <span class="fs-200 t-muted">{{ queuedText(row.queued_ahead) }}</span>
          </span>
          <StatusBadge
            v-else
            :label="$t(`enrichment.task_status.${row.status}`)"
            :tone="statusVariant(row.status)"
          />
        </template>
        <template #cell-progress="{ row }">
          <span class="t-secondary">{{ formatCounts(row.counts) }}</span>
        </template>
        <template #cell-cost="{ row }">
          <CostLabel :cost="row.cost_usd" :partial="!row.cost_complete" />
        </template>
        <template #cell-created="{ row }">
          <span class="fs-200 t-muted">{{ formatDate(row.created_at) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <IconButton
            v-if="isRetryable(row.raw)"
            mutates
            icon="refresh"
            size="sm"
            :label="$t('enrichment.ai.try_again')"
            :disabled="retrying.includes(row.id)"
            :data-testid="`enrichment-task-retry-${row.id}`"
            @click="retryTask(row)"
          />
          <IconButton
            icon="next"
            size="sm"
            :label="$t('enrichment.tasks.open')"
            :data-testid="`enrichment-task-open-${row.id}`"
            @click="openQueue(row)"
          />
        </template>
      </DataTable>

      <RunProposals v-if="selectedDone" :task="selected.raw" @changed="fetchTasks({ silent: true })" />
      <p v-else-if="selectedRunning" class="m-0 t-secondary" data-testid="enrichment-task-running">
        {{ $t("enrichment.ai.results_running") }}
      </p>
    </div>

    <template v-if="totalCount > pageSize" #footer>
      <Pagination
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>

    <TaskQueueDrawer
      :visible="queueVisible"
      :task-id="queueTaskId"
      :task-label="queueLabel"
      :outcome="queueOutcome"
      :progress="queueProgress"
      @close="closeQueue"
    />
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_Task, GET_Tasks, GET_Templates, GET_Workers } from "@/api/enrichment/api";
import { formatDate } from "@/utils/format";
import RouteTabs from "@/components/Navigation/RouteTabs.vue";
import { ENRICHMENT_REVIEW_TABS, routeTabPanel } from "@/components/Navigation/nav-routes";
import { isActive, isQueued, isRetryable, outcomeText } from "@/views/Pim/components/enrichment/productAi";
import { pluralKey } from "@/utils/plural";
import CostLabel from "./CostLabel.vue";
import RunProposals from "./RunProposals.vue";
import TaskQueueDrawer from "./TaskQueueDrawer.vue";
import WorkerAlerts from "./WorkerAlerts.vue";
import { loadProductNames, runName, runScope, runTitle } from "./runLabel";
import { needsRefresh, opensDrawer, orderedCounts, taskStatusTone } from "./taskProgress";
import { useTaskRetry } from "./useTaskRetry";
import { listOf } from "@/api/enrichment/listOf";

const REFRESH_MS = 5000;

// Mirrors django_enrichment.enums.TaskStatus.
const TASK_STATUSES = ["open", "in_progress", "done", "cancelled", "failed"];
const ALL = "__all";

// Enricher → Review → Runs: every AI run, newest first. A finished run is picked in place (`?task=<id>`, the list
// narrows to it) and its proposals are reviewed below it; a run still going or failed opens its drawer (its products,
// what it came to). Each run reads in plain words: its template or worker, what it ran on, never its key. A failed run,
// or one done with failed products, has Try again in its row.
export default {
  name: "RunsPage",
  components: { CostLabel, RouteTabs, RunProposals, TaskQueueDrawer, WorkerAlerts },
  setup() {
    const notify = useNotifyStore();
    const tabPanel = routeTabPanel(ENRICHMENT_REVIEW_TABS, "EnrichmentRuns");
    return { notify, formatDate, ALL, isQueued, isRetryable, ENRICHMENT_REVIEW_TABS, tabPanel, ...useTaskRetry() };
  },
  data() {
    return {
      tasks: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      // Every task by default: a first visit shows what has run, not an empty "Open" filter.
      statusFilter: this.$route.query.status || ALL,
      // `?task=<id>`: the one run picked here, or the one the "Run AI task" dialog links to.
      taskFilter: this.$route.query.task || "",
      refreshTimer: null,
      // Bumped by every list read and on leaving: only the latest read lands (a late refresh never undoes a filter).
      fetchSeq: 0,
      loading: false,
      queueVisible: false,
      queueTaskId: null,
      queueLabel: "",
      queueOutcome: "",
      queueProgress: "",
      workers: [],
      templates: [],
    };
  },
  computed: {
    statusOptions() {
      return [
        { value: ALL, label: this.$t("common.all") },
        ...TASK_STATUSES.map((s) => ({
          value: s,
          label: this.$t(`enrichment.task_status.${s}`),
        })),
      ];
    },
    columns() {
      return [
        { key: "task", label: this.$t("enrichment.tasks.col_task"), width: "minmax(180px, 2fr)" },
        { key: "status", label: this.$t("enrichment.tasks.col_status"), width: "max-content" },
        { key: "progress", label: this.$t("enrichment.tasks.col_progress"), width: "1fr", priority: 2 },
        { key: "cost", label: this.$t("enrichment.cost.label"), width: "90px", priority: 2 },
        { key: "created", label: this.$t("enrichment.tasks.col_created"), width: "max-content", priority: 2 },
        { key: "actions", label: "", actions: true },
      ];
    },
    // The picked run's chip: the run as it reads everywhere, "AI task" until its row is in.
    pickedLabel() {
      return this.selected ? runTitle(this.selected.raw, this.workers, this.templates) : this.$t("enrichment.tasks.generic");
    },
    // The picked run, once its row is loaded.
    selected() {
      return this.tasks.find((row) => String(row.id) === String(this.taskFilter)) || null;
    },
    selectedDone() {
      return !!this.selected && !opensDrawer(this.selected.raw);
    },
    selectedRunning() {
      return !!this.selected && isActive(this.selected.raw);
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
      this.fetchTasks();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchTasks();
    this.loadNames();
  },
  beforeUnmount() {
    this.fetchSeq += 1;
    clearTimeout(this.refreshTimer);
  },
  methods: {
    // `silent`: the auto-refresh of a running task updates the rows in place, without the loader.
    async fetchTasks({ silent = false } = {}) {
      clearTimeout(this.refreshTimer);
      const mine = ++this.fetchSeq;
      if (!silent) this.loading = true;
      try {
        const { results, count } = await this.loadPage();
        if (mine !== this.fetchSeq) return;
        // Flatten nested fields the DataTable can't reach via row[col.key].
        this.tasks = results.map((t) => ({
          raw: t,
          id: t.id,
          type: t.type,
          status: t.status,
          queued_ahead: t.queued_ahead,
          counts: t.counts,
          created_at: t.created_at,
          cost_usd: t.cost_usd,
          cost_complete: t.cost_complete,
          check: t.scope_spec?.check ?? "—",
        }));
        this.totalCount = count;
        loadProductNames(results); // a one-product run reads by its product once the name is in
        this.scheduleRefresh();
      } catch (err) {
        if (mine !== this.fetchSeq) return;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        if (mine === this.fetchSeq) this.loading = false;
      }
    },
    async loadPage() {
      if (this.taskFilter) {
        const { data } = await GET_Task(this.taskFilter);
        return { results: [data], count: 1 };
      }
      const params = { page: this.currentPage, page_size: this.pageSize };
      if (this.statusFilter !== ALL) params.status = this.statusFilter;
      const { data } = await GET_Tasks(params);
      return { results: data.results || [], count: data.count || 0 };
    },
    // Worker and template names for the task column; without them a row still reads in plain words.
    async loadNames() {
      try {
        const [workers, templates] = await Promise.all([GET_Workers(), GET_Templates()]);
        this.workers = listOf(workers.data);
        this.templates = listOf(templates.data);
      } catch {
        this.workers = [];
        this.templates = [];
      }
    },
    // A run as it reads everywhere (runLabel): what ran, and what it covered — one product by its name.
    nameOf(row) {
      return runName(row.raw, this.workers, this.templates);
    },
    scopeOf(row) {
      return runScope(row.raw);
    },
    scheduleRefresh() {
      if (!needsRefresh(this.tasks, !!this.taskFilter)) return;
      this.refreshTimer = setTimeout(() => this.fetchTasks({ silent: true }), REFRESH_MS);
    },
    // "N ahead" in the queue, or "starts next".
    queuedText(ahead) {
      if (!ahead) return this.$t("enrichment.tasks.starts_next");
      return this.$t(`enrichment.tasks.ahead_${pluralKey(ahead)}`, { count: ahead });
    },
    statusVariant(status) {
      return taskStatusTone(status);
    },
    formatCounts(counts) {
      const entries = orderedCounts(counts);
      const named = entries.map(([k, v]) => [this.countLabel(k), v]).filter(([label]) => label);
      return named.length ? named.map(([label, v]) => `${label}: ${v}`).join(", ") : "—";
    },
    // A count the CMS has no words for is left out, never shown by its key.
    countLabel(key) {
      const path = `enrichment.tasks.counts.${key}`;
      const label = this.$t(path);
      return label === path ? "" : label;
    },
    onFilterChange(value) {
      this.statusFilter = value;
      this.taskFilter = "";
      this.currentPage = 1;
      const query = { ...this.$route.query, status: value };
      delete query.task;
      this.$router.replace({ path: this.$route.path, query });
      this.fetchTasks();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    // A finished run shows its proposals here; one still going or failed opens its drawer.
    onRowClick(row) {
      if (opensDrawer(row.raw)) return this.openQueue(row);
      this.taskFilter = String(row.id);
      this.$router.replace({ path: this.$route.path, query: { ...this.$route.query, task: this.taskFilter } });
      this.fetchTasks({ silent: true });
    },
    // Try again: the failed products run as a new task; the list shows every run again, the new one on top.
    async retryTask(row) {
      const next = await this.retry(row.raw);
      if (next) this.onFilterChange(ALL);
    },
    openQueue(row) {
      this.queueTaskId = row.id;
      this.queueLabel = runTitle(row.raw, this.workers, this.templates);
      this.queueOutcome = outcomeText(row.raw, this.workers.find((w) => w.key === row.type));
      this.queueProgress = orderedCounts(row.counts).length ? this.formatCounts(row.counts) : "";
      this.queueVisible = true;
    },
    closeQueue() {
      this.queueVisible = false;
    },
  },
};
</script>

<style lang="scss" scoped>
.task-list {
  display: flex;
  flex-direction: column;
}
.task-list__count {
  flex-shrink: 0;
  white-space: nowrap;
}
.task-list__task {
  min-width: 0;
}
.task-list__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
