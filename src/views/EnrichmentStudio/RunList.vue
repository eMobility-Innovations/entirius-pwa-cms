<template>
  <PageLayout class="run-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('enrichment.studio.title')" :description="$t('enrichment.studio.description')">
        <template #actions>
          <ActionBar :actions="actions" />
        </template>
      </PageHeader>
    </template>

    <Loader v-show="loading" block />
    <DataTable
      v-show="!loading"
      empty-size="md"
      :columns="columns"
      :rows="rows"
      row-key="uid"
      :row-attrs="(row) => ({ 'data-testid': `run-row-${row.uid}` })"
      :empty-text="$t('enrichment.studio.empty')"
      data-testid="runs-table"
      @row-click="open"
    >
      <template #cell-status="{ row }">
        <StatusBadge :label="$t(`enrichment.studio.run_status.${row.status}`)" :tone="runTone(row.status)" />
      </template>
      <template #cell-cost="{ row }">
        <CostLabel :cost="row.cost_usd" :partial="!row.cost_complete" />
      </template>
      <template #cell-age="{ row }">
        <span class="fs-200 t-muted" :title="formatDate(row.created_at)">{{ formatRelative(row.created_at) }}</span>
      </template>
    </DataTable>

    <template v-if="pages > 1" #footer>
      <Pagination v-model:page="page" :pages="pages" />
    </template>

    <NewRunDialog v-model:open="creating" @started="open" />
  </PageLayout>
</template>

<script>
import { GET_Runs } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { formatDate, formatRelative } from "@/utils/format";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import NewRunDialog from "./NewRunDialog.vue";
import { currentStepLabel, runTitle, runTone } from "./studioLogic";

const PAGE_SIZE = 20;

// The Studio: every workflow run, newest first — what it makes, its brief's title, its state, the step it is on,
// what it cost and when it started. "New" picks a workflow and a brief; a row opens the run.
export default {
  name: "RunList",
  components: { CostLabel, NewRunDialog },
  setup() {
    return { notify: useNotifyStore(), formatDate, formatRelative, runTone };
  },
  data() {
    return { runs: [], count: 0, page: 1, loading: false, creating: false };
  },
  computed: {
    columns() {
      return [
        { key: "title", label: this.$t("enrichment.studio.col_title"), width: "2fr" },
        { key: "definition_label", label: this.$t("enrichment.studio.col_workflow"), width: "1fr", priority: 2 },
        { key: "status", label: this.$t("enrichment.studio.col_status"), width: "max-content" },
        { key: "step", label: this.$t("enrichment.studio.col_step"), width: "1fr", priority: 2 },
        { key: "cost", label: this.$t("enrichment.cost.label"), width: "90px", priority: 3 },
        { key: "age", label: this.$t("enrichment.studio.col_age"), width: "110px", priority: 2 },
      ];
    },
    rows() {
      return this.runs.map((run) => ({ ...run, title: runTitle(run), step: currentStepLabel(run) || "—" }));
    },
    pages() {
      return Math.ceil(this.count / PAGE_SIZE);
    },
    actions() {
      return [{ key: "new", role: "primary", mutates: true, label: this.$t("enrichment.studio.new"), testid: "studio-new",
        onClick: () => (this.creating = true) }];
    },
  },
  watch: {
    page: "fetchRuns",
  },
  mounted() {
    this.fetchRuns();
  },
  methods: {
    async fetchRuns() {
      this.loading = true;
      try {
        const { data } = await GET_Runs({ page: this.page, page_size: PAGE_SIZE });
        this.runs = data.results || [];
        this.count = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
    open(row) {
      this.$router.push({ name: "EnrichmentStudioRun", params: { uid: row.uid } });
    },
  },
};
</script>
