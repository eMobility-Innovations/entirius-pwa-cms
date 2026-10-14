<template>
  <PageLayout class="task-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('enrichment.tasks.title')" />
    </template>
    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-2">
        <FilterChip
          v-if="taskFilter"
          :label="$t('enrichment.tasks.single', { id: taskFilter })"
          active
          data-testid="enrichment-task-single"
          @click="onFilterChange('__all')"
        />
        <FilterChip
          v-for="opt in statusOptions"
          :key="opt.value"
          :label="opt.label"
          :active="!taskFilter && statusFilter === opt.value"
          :data-testid="`enrichment-task-status-${opt.value}`"
          @click="onFilterChange(opt.value)"
        />
        <span class="fs-200 t-muted ml-auto">
          {{ $t("enrichment.tasks.matching", { count: totalCount }) }}
        </span>
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="tasks"
        row-key="id"
        :empty-text="$t('enrichment.tasks.empty')"
        @row-click="openQueue"
      >
        <template #cell-status="{ value }">
          <StatusBadge
            :label="$t(`enrichment.task_status.${value}`)"
            :tone="statusVariant(value)"
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
      </DataTable>

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
      @close="closeQueue"
    />
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_Task, GET_Tasks } from "@/api/enrichment/api";
import { formatDate } from "@/utils/format";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import TaskQueueDrawer from "./TaskQueueDrawer.vue";
import { needsRefresh, orderedCounts, taskStatusTone } from "./taskProgress";

const REFRESH_MS = 5000;

// Mirrors django_enrichment.enums.TaskStatus.
const TASK_STATUSES = ["open", "in_progress", "done", "cancelled", "failed"];
export default {
  name: "TaskList",
  components: { CostLabel, TaskQueueDrawer },
  setup() {
    const notify = useNotifyStore();
    return { notify, formatDate };
  },
  data() {
    return {
      tasks: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      statusFilter: this.$route.query.status || "open",
      // `?task=<id>`: the one task the "Run AI task" dialog links to.
      taskFilter: this.$route.query.task || "",
      refreshTimer: null,
      loading: false,
      queueVisible: false,
      queueTaskId: null,
      queueLabel: "",
    };
  },
  computed: {
    statusOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        ...TASK_STATUSES.map((s) => ({
          value: s,
          label: this.$t(`enrichment.task_status.${s}`),
        })),
      ];
    },
    columns() {
      return [
        { key: "id", label: this.$t("enrichment.tasks.col_id"), width: "70px" },
        { key: "type", label: this.$t("enrichment.tasks.col_type"), width: "1fr" },
        { key: "check", label: this.$t("enrichment.tasks.col_check"), width: "1.2fr" },
        { key: "rule", label: this.$t("enrichment.tasks.col_rule"), width: "1.2fr" },
        { key: "status", label: this.$t("enrichment.tasks.col_status"), width: "120px" },
        { key: "progress", label: this.$t("enrichment.tasks.col_progress"), width: "1fr" },
        { key: "cost", label: this.$t("enrichment.cost.label"), width: "90px", priority: 2 },
        { key: "created", label: this.$t("enrichment.tasks.col_created"), width: "170px" },
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
      this.fetchTasks();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchTasks();
  },
  beforeUnmount() {
    clearTimeout(this.refreshTimer);
  },
  methods: {
    // `silent`: the auto-refresh of a running task updates the rows in place, without the loader.
    async fetchTasks({ silent = false } = {}) {
      clearTimeout(this.refreshTimer);
      if (!silent) this.loading = true;
      try {
        const { results, count } = await this.loadPage();
        // Flatten nested fields the DataTable can't reach via row[col.key].
        this.tasks = results.map((t) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          counts: t.counts,
          created_at: t.created_at,
          check: t.scope_spec?.check ?? "—",
          rule: t.params?.spawn_rule ?? "—",
        }));
        this.totalCount = count;
        this.scheduleRefresh();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async loadPage() {
      if (this.taskFilter) {
        const { data } = await GET_Task(this.taskFilter);
        return { results: [data], count: 1 };
      }
      const params = { page: this.currentPage, page_size: this.pageSize };
      if (this.statusFilter !== "__all") params.status = this.statusFilter;
      const { data } = await GET_Tasks(params);
      return { results: data.results || [], count: data.count || 0 };
    },
    scheduleRefresh() {
      if (!needsRefresh(this.tasks, !!this.taskFilter)) return;
      this.refreshTimer = setTimeout(() => this.fetchTasks({ silent: true }), REFRESH_MS);
    },
    statusVariant(status) {
      return taskStatusTone(status);
    },
    formatCounts(counts) {
      const entries = orderedCounts(counts);
      return entries.length
        ? entries.map(([k, v]) => `${this.countLabel(k)}: ${v}`).join(", ")
        : "—";
    },
    countLabel(key) {
      const path = `enrichment.tasks.counts.${key}`;
      const label = this.$t(path);
      return label === path ? key : label;
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
    openQueue(row) {
      this.queueTaskId = row.id;
      this.queueLabel = row.rule !== "—" ? row.rule : row.type;
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
</style>
