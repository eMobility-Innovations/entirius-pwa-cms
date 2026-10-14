<template>
  <span class="ai-results__trigger">
    <IconButton icon="enrich" variant="outline" :label="triggerLabel" data-testid="ai-results" @click="open = true" />
    <span v-if="proposals.length" class="ai-results__count" aria-hidden="true" data-testid="ai-results-count">{{ countLabel }}</span>
    <span v-else-if="failing" class="ai-results__dot ai-results__dot--failed" data-testid="ai-results-failed" />
    <span v-if="running" class="ai-results__dot ai-results__dot--running" data-testid="ai-results-running" />
  </span>

  <SideDrawer :visible="open" :title="$t('enrichment.ai.results_title', { sku })" width="720px" @close="open = false">
    <div class="flex-column gap-10" data-testid="ai-results-drawer">
      <section class="flex-column gap-3" aria-labelledby="ai-results-run-title">
        <h3 id="ai-results-run-title" class="ai-results__heading m-0">{{ $t("enrichment.ai.run_title") }}</h3>
        <AiToolboxHint />
        <p v-if="!workers.length" class="fs-200 t-muted m-0">{{ $t("enrichment.ai.no_workers") }}</p>
        <div v-else class="flex flex-wrap gap-3">
          <BasicButton
            v-for="worker in workers"
            :key="worker.key"
            mutates
            :disabled="!usable"
            :data-testid="`ai-worker-${worker.key}`"
            @click="run(worker.key)"
          >
            {{ worker.label || worker.key }}
          </BasicButton>
        </div>
      </section>

      <section v-if="tasks.length" class="flex-column gap-3" aria-labelledby="ai-results-tasks-title">
        <h3 id="ai-results-tasks-title" class="ai-results__heading m-0">{{ $t("enrichment.ai.recent_tasks") }}</h3>
        <AiTaskList :tasks="tasks" :workers="workers" :selected="taskFilter" @select="(id) => (taskFilter = id)" />
      </section>

      <section class="flex-column gap-5" aria-labelledby="ai-results-proposals-title">
        <div class="flex ai-ct jc-sb flex-wrap gap-3">
          <h3 id="ai-results-proposals-title" class="ai-results__heading m-0">
            {{ $t("enrichment.ai.to_review") }}
            <CountBadge v-if="shown.length" :count="shown.length" />
          </h3>
          <BasicButton
            v-if="shown.length > 1"
            mutates
            :disabled="busy"
            :loading="busy"
            data-testid="ai-results-apply-all"
            @click="applyAll"
          >
            {{ $t("enrichment.ai.apply_all", { count: shown.length }) }}
          </BasicButton>
        </div>

        <div v-if="taskFilter" class="ai-results__filter flex ai-ct gap-3 fs-200" data-testid="ai-results-filter">
          <span>{{ $t("enrichment.ai.filtered", { worker: filterLabel }) }}</span>
          <BasicButton variant="ghost" size="sm" @click="taskFilter = null">{{ $t("enrichment.ai.show_all") }}</BasicButton>
        </div>

        <EmptyState
          v-if="!loading && !shown.length"
          icon="enrich"
          size="sm"
          :title="$t(taskFilter ? 'enrichment.ai.filtered_empty' : 'enrichment.ai.results_empty')"
          :message="running ? $t('enrichment.ai.results_running') : ''"
        />
        <Loader v-else-if="loading && !shown.length" block />
        <ProposalPanel
          v-for="proposal in shown"
          :key="proposal.id"
          :proposal="proposal"
          :task="taskOf(proposal)"
          :product="product"
          :busy="busy"
          @accept="accept"
          @reject="reject"
          @updated="replace"
        />
      </section>
    </div>
  </SideDrawer>

  <DriftModal :visible="!!drifted" :proposal="drifted" :busy="busy" @confirm="confirmDrift" @reject="rejectDrift" @close="drifted = null" />
</template>

<script>
import { toRef } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { POST_AcceptProposal, POST_RejectProposal } from "@/api/enrichment/api";
import ProposalPanel from "@/views/EnrichmentReview/ProposalPanel.vue";
import DriftModal from "@/views/EnrichmentReview/DriftModal.vue";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import AiTaskList from "./AiTaskList.vue";
import { groupTasks } from "./productAi";
import { useProductAi } from "./useProductAi";

// The AI of the product on screen: one header icon (the Enricher's) with the pending count, a pulsing dot while a
// task runs or a warning dot after a failure, opening a drawer: Run AI (one button per worker, `run`), the
// product's tasks in plain words and its pending proposals as cards, reviewed in place (Apply all
// when there are several). Picking a task shows only its proposals. An applied proposal goes to the page
// (`applied`) so the product form shows the new value.
export default {
  name: "ProductAiResults",
  components: { ProposalPanel, DriftModal, AiTaskList, AiToolboxHint },
  props: {
    sku: { type: String, required: true },
    product: { type: Object, default: null },
    workers: { type: Array, default: () => [] },
    // The AI toolbox can take a run (configHealth.aiUsable); off, the run buttons wait behind the toolbox hint.
    usable: { type: Boolean, default: false },
  },
  emits: ["applied", "run"],
  expose: ["track"],
  setup(props) {
    const ai = useProductAi(toRef(props, "sku"));
    return { ...ai, notify: useNotifyStore() };
  },
  data() {
    return { open: false, busy: false, drifted: null, taskFilter: null };
  },
  computed: {
    // "AI / Enricher", with what waits: the pending count, a running task, a failure.
    triggerLabel() {
      const base = this.$t("enrichment.ai.trigger");
      if (this.proposals.length) return `${base} · ${this.$t("enrichment.ai.trigger_pending", { count: this.proposals.length })}`;
      if (this.running) return `${base} · ${this.$t("enrichment.ai.outcome.running")}`;
      return this.failing ? `${base} · ${this.$t("enrichment.ai.trigger_failed")}` : base;
    },
    countLabel() {
      return this.proposals.length > 99 ? "99+" : String(this.proposals.length);
    },
    failing() {
      return groupTasks(this.tasks).current.some((task) => task.status === "failed");
    },
    shown() {
      if (!this.taskFilter) return this.proposals;
      return this.proposals.filter((p) => p.task_id === this.taskFilter);
    },
    filterLabel() {
      const task = this.tasks.find((t) => t.id === this.taskFilter);
      return this.workers.find((w) => w.key === task?.type)?.label || task?.type || `#${this.taskFilter}`;
    },
  },
  methods: {
    // The run dialog opens over the page; the task then runs in the background, shown by the pulsing dot.
    run(workerKey) {
      this.open = false;
      this.$emit("run", workerKey);
    },
    taskOf(proposal) {
      return this.tasks.find((t) => t.id === proposal.task_id) || null;
    },
    replace(proposal) {
      this.proposals = this.proposals.map((p) => (p.id === proposal.id ? proposal : p));
    },
    drop(proposal) {
      this.proposals = this.proposals.filter((p) => p.id !== proposal.id);
    },
    async accept(proposal) {
      await this.act(async () => {
        const { data } = await POST_AcceptProposal(proposal.id);
        if (data.status === "drifted") this.drifted = data;
        else this.applied(data, this.$t("enrichment.review.toast.accepted"));
      });
    },
    // One by one: each is drift-checked; a drifted one stays in the list for its own conscious re-confirm.
    async applyAll() {
      await this.act(async () => {
        const results = [];
        for (const proposal of [...this.shown]) results.push(await this.applyOne(proposal));
        const drifted = results.filter((written) => !written).length;
        const applied = results.length - drifted;
        const key = drifted ? "enrichment.ai.applied_some" : "enrichment.review.toast.bulk_accepted";
        this.notify.spawnNotification({ type: drifted ? "warning" : "positive", msg: this.$t(key, { count: applied, drifted }) });
      });
    },
    async applyOne(proposal) {
      const { data } = await POST_AcceptProposal(proposal.id);
      if (data.status === "drifted") {
        this.replace(data);
        return false;
      }
      this.applied(data);
      return true;
    },
    async confirmDrift(proposal) {
      await this.act(async () => {
        const { data } = await POST_AcceptProposal(proposal.id);
        this.drifted = null;
        this.applied(data, this.$t("enrichment.review.toast.accepted"));
      });
    },
    applied(proposal, toast = "") {
      this.drop(proposal);
      if (toast) this.notify.spawnNotification({ type: "positive", msg: toast });
      this.$emit("applied", proposal);
    },
    async reject({ proposal, reason }) {
      await this.act(async () => {
        await POST_RejectProposal(proposal.id, reason ? { reason } : {});
        this.drop(proposal);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.review.toast.rejected") });
      });
    },
    rejectDrift(payload) {
      this.drifted = null;
      return this.reject(payload);
    },
    async act(work) {
      this.busy = true;
      try {
        await work();
        this.syncTasks();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.ai-results__trigger {
  position: relative;
  display: inline-flex;
}
.ai-results__count {
  position: absolute;
  top: calc(var(--space-2) * -1);
  right: calc(var(--space-2) * -1);
  min-width: 18px;
  height: 18px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--accent);
  color: var(--text-inverse);
  font-size: var(--fs-150);
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
  z-index: 1;
}
.ai-results__dot {
  position: absolute;
  top: calc(var(--space-1) * -1);
  right: calc(var(--space-1) * -1);
  width: 10px;
  height: 10px;
  border: 2px solid var(--surface-base);
  border-radius: var(--radius-full);
  pointer-events: none;
  z-index: 1;
}
.ai-results__dot--running {
  top: auto;
  bottom: calc(var(--space-1) * -1);
  background: var(--accent);
  animation: ai-results-pulse 1.4s ease-in-out infinite;
}
.ai-results__dot--failed {
  background: var(--warning);
}
@keyframes ai-results-pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ai-results__dot--running {
    animation: none;
  }
}
.ai-results__heading {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-secondary);
}
.ai-results__filter {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
}
</style>
