<template>
  <span class="ai-results__trigger">
    <IconButton icon="enrich" variant="outline" :label="triggerLabel" data-testid="ai-results" @click="open = true" />
    <span v-if="proposals.length" class="ai-results__count" aria-hidden="true" data-testid="ai-results-count">{{ countLabel }}</span>
    <span v-else-if="failing" class="ai-results__dot ai-results__dot--failed" data-testid="ai-results-failed" />
    <span v-if="working" class="ai-results__dot ai-results__dot--running" data-testid="ai-results-running" />
    <span v-else-if="running" class="ai-results__dot ai-results__dot--queued" data-testid="ai-results-queued" />
  </span>

  <SideDrawer :visible="open" :title="$t('enrichment.ai.results_title', { name: product?.name || sku })" width="720px" @close="open = false">
    <div class="flex-column gap-10" data-testid="ai-results-drawer">
      <section class="flex-column gap-3" aria-labelledby="ai-results-run-title">
        <div class="flex ai-ct jc-sb flex-wrap gap-3">
          <h3 id="ai-results-run-title" class="ai-results__heading m-0">{{ $t("enrichment.ai.run_title") }}</h3>
          <router-link :to="{ name: 'EnrichmentTemplates' }" class="ai-results__link" data-testid="ai-results-templates">
            {{ $t("enrichment.ai.manage_templates") }}
          </router-link>
        </div>
        <AiToolboxHint />
        <ProfileGate v-if="open" :channel="pimChannel.activeChannelIdx" />
        <p v-if="!workers.length" class="fs-200 t-muted m-0">{{ $t("enrichment.ai.no_workers") }}</p>
        <div v-else class="flex flex-wrap gap-3">
          <BasicButton
            v-for="template in templates"
            :key="template.key"
            mutates
            :disabled="!usable"
            :data-testid="`ai-template-${template.key}`"
            @click="run(template.key)"
          >
            {{ template.label }}
          </BasicButton>
          <BasicButton mutates variant="ghost" :disabled="!usable" data-testid="ai-run-custom" @click="run('')">
            {{ $t("enrichment.run.custom") }}
          </BasicButton>
        </div>
      </section>

      <section v-if="tasks.length" class="flex-column gap-3" aria-labelledby="ai-results-tasks-title">
        <h3 id="ai-results-tasks-title" class="ai-results__heading m-0">{{ $t("enrichment.ai.recent_tasks") }}</h3>
        <AiTaskList
          :tasks="tasks"
          :workers="workers"
          :templates="allTemplates"
          :selected="taskFilter"
          :retrying="retrying"
          :usable="usable"
          @select="(id) => (taskFilter = id)"
          @retry="retryTask"
        />
      </section>

      <section class="flex-column gap-5" aria-labelledby="ai-results-proposals-title">
        <div class="flex ai-ct jc-sb flex-wrap gap-3">
          <h3 id="ai-results-proposals-title" class="ai-results__heading m-0">
            {{ $t("enrichment.ai.to_review") }}
            <CountBadge v-if="shown.length" :count="shown.length" />
          </h3>
          <router-link :to="{ name: 'EnrichmentReview' }" class="ai-results__link mr-auto" data-testid="ai-results-review">
            {{ $t("enrichment.ai.open_review") }}
          </router-link>
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

        <div v-if="taskFilter" class="ai-results__filter flex ai-ct flex-wrap gap-3 fs-200" data-testid="ai-results-filter">
          <span>{{ $t("enrichment.ai.filtered", { worker: filterLabel }) }}</span>
          <BasicButton variant="ghost" size="sm" @click="taskFilter = null">{{ $t("enrichment.ai.show_all") }}</BasicButton>
          <BatchCorrection v-if="correctable.length" class="ml-auto" :task-id="taskFilter" @queued="refresh" />
        </div>

        <EmptyState
          v-if="!loading && !shown.length"
          icon="enrich"
          size="md"
          :title="$t(taskFilter ? 'enrichment.ai.filtered_empty' : 'enrichment.ai.results_empty')"
          :message="emptyMessage"
          data-testid="ai-results-empty"
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
import { POST_AcceptProposal } from "@/api/enrichment/api";
import { useProposalActions } from "@/views/EnrichmentReview/useProposalActions";
import { useTaskRetry } from "@/views/EnrichmentReview/useTaskRetry";
import ProposalPanel from "@/views/EnrichmentReview/ProposalPanel.vue";
import DriftModal from "@/views/EnrichmentReview/DriftModal.vue";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import BatchCorrection from "@/views/EnrichmentReview/BatchCorrection.vue";
import ProfileGate from "@/views/EnrichmentStudio/ProfileGate.vue";
import { usePimChannelStore } from "@/stores/pimChannel";
import AiTaskList from "./AiTaskList.vue";
import { runName } from "@/views/EnrichmentReview/runLabel";
import { groupTasks, isActive, isQueued } from "./productAi";
import { useProductAi } from "./useProductAi";

// The AI of the product on screen: one header icon (the Enricher's) with the pending count, a pulsing dot while a
// task runs (a still one while it only waits in the queue) or a warning dot after a failure, opening a drawer: Run AI (the templates in their order, then
// "Custom…" — `run` with the template key, "" for custom; a link to manage the templates and the incomplete-profile
// warning of the channel), the
// product's tasks in plain words and its pending proposals as cards, reviewed in place (Apply all
// when there are several). Picking a task shows only its proposals, with "Correct all" for the whole run. An applied proposal goes to the page
// (`applied`) so the product form shows the new value. A run the page just started (`track`) opens the drawer on it:
// its proposals land there when it finishes. A failed task offers Try again: its failed products run as a new task,
// which `track` then shows like any other (the failed one stays in History).
export default {
  name: "ProductAiResults",
  components: { ProposalPanel, DriftModal, AiTaskList, AiToolboxHint, BatchCorrection, ProfileGate },
  props: {
    sku: { type: String, required: true },
    product: { type: Object, default: null },
    workers: { type: Array, default: () => [] },
    templates: { type: Array, default: () => [] },
    // Every template (useAiWorkers.allTemplates): a task's label, also when it ran from one this menu does not offer.
    allTemplates: { type: Array, default: () => [] },
    // The AI toolbox can take a run (configHealth.aiUsable); off, the run buttons wait behind the toolbox hint.
    usable: { type: Boolean, default: false },
  },
  emits: ["applied", "run"],
  expose: ["track"],
  setup(props, { emit }) {
    const nameOf = (task) => runName(task, props.workers, props.allTemplates);
    const { track: watchTask, ...ai } = useProductAi(toRef(props, "sku"), nameOf);
    const drop = (proposal) => (ai.proposals.value = ai.proposals.value.filter((p) => p.id !== proposal.id));
    const applied = (proposal) => {
      drop(proposal);
      emit("applied", proposal);
    };
    const actions = useProposalActions({ onApplied: applied, onRejected: drop, afterAction: ai.syncTasks });
    return { ...ai, ...actions, ...useTaskRetry(), watchTask, applied, notify: useNotifyStore(), pimChannel: usePimChannelStore() };
  },
  data() {
    // `?ai=1`: the drawer is part of the product's URL — a reload or a shared link opens it again.
    return { open: this.$route?.query?.ai === "1", taskFilter: null };
  },
  computed: {
    // "AI / Enricher", with what waits: the pending count, a running task, a failure.
    triggerLabel() {
      const base = this.$t("enrichment.ai.trigger");
      if (this.proposals.length) return `${base} · ${this.$t("enrichment.ai.trigger_pending", { count: this.proposals.length })}`;
      if (this.working) return `${base} · ${this.$t("enrichment.ai.outcome.running")}`;
      if (this.running) return `${base} · ${this.$t("enrichment.ai.outcome.queued")}`;
      return this.failing ? `${base} · ${this.$t("enrichment.ai.trigger_failed")}` : base;
    },
    // A task the worker is on; `running` (useProductAi) also counts the queued ones.
    working() {
      return this.tasks.some((task) => isActive(task) && !isQueued(task));
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
    // Whether "Correct all" shows: the picked task has pending proposals here (it reaches all of the run's products).
    correctable() {
      return this.shown.filter((p) => p.status === "pending");
    },
    // While a task runs its proposals are on the way; otherwise the run buttons above are the next step.
    emptyMessage() {
      if (this.running) return this.$t("enrichment.ai.results_running");
      return this.taskFilter ? "" : this.$t("enrichment.ai.results_empty_hint");
    },
    filterLabel() {
      const task = this.tasks.find((t) => t.id === this.taskFilter);
      return runName(task, this.workers, this.allTemplates);
    },
  },
  watch: {
    open(isOpen) {
      if (!this.$router) return;
      const query = { ...this.$route.query, ai: isOpen ? "1" : undefined };
      this.$router.replace({ query, hash: this.$route.hash });
    },
  },
  methods: {
    // The run dialog opens over the page; the task then runs in the background, shown by the pulsing dot.
    run(templateKey) {
      this.open = false;
      this.$emit("run", templateKey);
    },
    // A task just started from the page: watched, and the drawer opens on it.
    track(task) {
      this.watchTask(task);
      this.taskFilter = task.id;
      this.open = true;
    },
    // Try again on a failed task: the failed products run as a new task, shown and watched like one started above.
    async retryTask(task) {
      const next = await this.retry(task);
      if (next) this.track(next);
    },
    taskOf(proposal) {
      return this.tasks.find((t) => t.id === proposal.task_id) || null;
    },
    replace(proposal) {
      this.proposals = this.proposals.map((p) => (p.id === proposal.id ? proposal : p));
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
.ai-results__dot--queued {
  top: auto;
  bottom: calc(var(--space-1) * -1);
  background: var(--info);
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
.ai-results__link {
  font-size: var(--fs-200);
  font-weight: 600;
  color: var(--text-accent);
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
