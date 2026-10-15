<template>
  <PageLayout class="run-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('enrichment.studio.title')" :description="$t('enrichment.studio.description')">
        <template #actions>
          <ActionBar :actions="actions" />
        </template>
      </PageHeader>
    </template>

    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-8 rg-3">
        <div class="filter-chip-row" role="group" :aria-label="$t('enrichment.studio.filters')">
          <FilterChip
            :label="$t('enrichment.studio.filter_your_turn')"
            :active="yourTurn"
            :count="waitingCount"
            :aria-pressed="String(yourTurn)"
            data-testid="runs-your-turn"
            @click="toggleYourTurn"
          />
        </div>
      </div>
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
      <template v-if="yourTurn" #empty>
        <EmptyState icon="empty" size="md" :title="$t('enrichment.studio.empty_your_turn')" data-testid="runs-empty-your-turn">
          <BasicButton data-testid="runs-show-all" @click="toggleYourTurn">{{ $t("enrichment.studio.show_all") }}</BasicButton>
        </EmptyState>
      </template>
      <template #cell-title="{ row }">
        <span class="run-list__title flex-column">
          <span class="run-list__line">{{ row.title }}</span>
          <span v-if="row.step" class="run-list__line run-list__step-line fs-200 t-secondary" :title="row.step">{{ row.step }}</span>
        </span>
      </template>
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

    <StartWorkDialog v-model:open="choosing" :templates="aiWritable ? aiTemplates : []" @task="openTask" @guided="openGuided" />
    <NewRunDialog v-model:open="creating" :copy-from="copyFrom" :initial-definition="definition" @started="open" />
    <RunAiTaskDialog
      v-if="aiWritable"
      :open="taskOpen"
      :workers="aiWorkers"
      :templates="aiTemplates"
      :initial-template="taskTemplate"
      pick-targets
      @close="taskOpen = false"
      @template-saved="reloadAiTemplates"
    />
  </PageLayout>
</template>

<script>
import { GET_Runs } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { formatDate, formatRelative } from "@/utils/format";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import NewRunDialog from "./NewRunDialog.vue";
import StartWorkDialog from "./StartWorkDialog.vue";
import RunAiTaskDialog from "@/views/Pim/components/enrichment/RunAiTaskDialog.vue";
import { useAiWorkers } from "@/views/Pim/components/enrichment/useAiWorkers";
import { nextAction, openFirst, runTitle, runTone } from "./studioLogic";

const PAGE_SIZE = 20;
const STEP_KINDS = ["your_turn", "writing", "failed"];

// The Studio: every workflow run — open ones first (your turn, failed, working), then the rest newest first — what it
// makes, its brief's title, its state, whose turn it is on which step, what it cost and when it started. "Your turn"
// keeps the runs that wait for the operator, with their count. "New" is the one place to start AI work
// (StartWorkDialog): a task (a template run on products picked in RunAiTaskDialog, its run then on Review → Runs) or
// guided work (a workflow and its brief, NewRunDialog; `?new=1`, with `from=<uid>` to start from another run's brief,
// goes straight there); a row opens the run.
export default {
  name: "RunList",
  components: { CostLabel, NewRunDialog, StartWorkDialog, RunAiTaskDialog },
  setup() {
    const { workers: aiWorkers, templates: aiTemplates, writable: aiWritable, reloadTemplates: reloadAiTemplates } = useAiWorkers();
    return { notify: useNotifyStore(), aiWorkers, aiTemplates, aiWritable, reloadAiTemplates, formatDate, formatRelative, runTone };
  },
  data() {
    return {
      runs: [], count: 0, waitingCount: null, page: 1, yourTurn: false, loading: false,
      choosing: false, creating: false, copyFrom: "", definition: "", taskOpen: false, taskTemplate: "",
    };
  },
  computed: {
    columns() {
      return [
        { key: "title", label: this.$t("enrichment.studio.col_title"), width: "2fr", truncate: true, title: (row) => row.title },
        { key: "definition_label", label: this.$t("enrichment.studio.col_workflow"), width: "1fr", priority: 2 },
        { key: "status", label: this.$t("enrichment.studio.col_status"), width: "max-content" },
        { key: "step", label: this.$t("enrichment.studio.col_step"), width: "1fr", priority: 2 },
        { key: "cost", label: this.$t("enrichment.cost.label"), width: "90px", priority: 3 },
        { key: "age", label: this.$t("enrichment.studio.col_age"), width: "110px", priority: 2 },
      ];
    },
    rows() {
      return openFirst(this.runs).map((run) => ({ ...run, title: runTitle(run), step: this.stepText(run) }));
    },
    pages() {
      return Math.ceil(this.count / PAGE_SIZE);
    },
    actions() {
      return [{ key: "new", role: "primary", mutates: true, label: this.$t("enrichment.studio.new"), testid: "studio-new",
        onClick: () => (this.choosing = true) }];
    },
  },
  watch: {
    page: "fetchRuns",
  },
  mounted() {
    this.openFromQuery();
    this.fetchRuns();
  },
  methods: {
    // "Start new content" and "same brief" links land here with ?new=1 (&from=<uid>); the query goes once read.
    openFromQuery() {
      const { new: asked, from } = this.$route.query;
      if (!asked) return;
      this.copyFrom = typeof from === "string" ? from : "";
      this.creating = true;
      this.$router.replace({ query: {} });
    },
    // Whose turn it is and on which step: "Your turn: Outline", "AI writing: Draft", "Failed: Search phrases".
    stepText(run) {
      const { kind, step } = nextAction(run);
      return STEP_KINDS.includes(kind) ? this.$t(`enrichment.studio.list_step.${kind}`, { step: step.label }) : "";
    },
    toggleYourTurn() {
      this.yourTurn = !this.yourTurn;
      if (this.page === 1) this.fetchRuns();
      else this.page = 1;
    },
    async fetchRuns() {
      this.loading = true;
      try {
        const params = { page: this.page, page_size: PAGE_SIZE, ...(this.yourTurn ? { status: "waiting" } : {}) };
        const [{ data }, waiting] = await Promise.all([GET_Runs(params), GET_Runs({ status: "waiting", page_size: 1 })]);
        this.runs = data.results || [];
        this.count = data.count || 0;
        this.waitingCount = waiting.data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
    openTask(key) {
      this.taskTemplate = key;
      this.taskOpen = true;
    },
    openGuided(key) {
      this.copyFrom = "";
      this.definition = key;
      this.creating = true;
    },
    open(row) {
      this.$router.push({ name: "EnrichmentStudioRun", params: { uid: row.uid } });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.run-list__title {
  min-width: 0;
}
.run-list__line {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
// The step has its own column above a phone; on one it is the title's second line.
.run-list__step-line {
  display: none;

  @include max-tablet {
    display: block;
  }
}
</style>
