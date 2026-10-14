<template>
  <PageLayout class="run-view">
    <template #header>
      <PageHeader :title="title" :crumbs="crumbs" :back="{ name: 'EnrichmentStudio' }">
        <template v-if="run" #meta>
          <StatusBadge :label="$t(`enrichment.studio.run_status.${run.status}`)" :tone="runTone(run.status)" data-testid="run-status" />
          <span class="fs-300 t-secondary">{{ run.definition_label }}</span>
          <span class="flex ai-ct gap-2 fs-300 t-secondary">
            {{ $t("enrichment.studio.run_cost") }}
            <CostLabel :cost="run.cost_usd" :partial="!run.cost_complete" data-testid="run-cost" />
          </span>
        </template>
        <template v-if="run && actions.length" #actions>
          <ActionBar :actions="actions" />
        </template>
      </PageHeader>
    </template>

    <Loader v-if="loading" block />
    <EmptyState
      v-else-if="!run"
      icon="empty"
      size="md"
      :title="$t('enrichment.studio.missing')"
      :message="$t('enrichment.studio.missing_hint')"
      data-testid="run-missing"
    >
      <router-link :to="{ name: 'EnrichmentStudio' }" class="t-accent fw-600">{{ $t("enrichment.studio.back_to_list") }}</router-link>
    </EmptyState>
    <div v-else class="flex-column gap-6">
      <ProfileGate :channel="run.channel" />
      <div class="run-view__grid">
        <StepRail :run="run" :selected="selectedKey" />
        <StepPanel v-if="selectedStep" :key="selectedStep.key" :run="run" :step="selectedStep" @changed="onChanged" />
      </div>
    </div>

    <ConfirmDialog
      v-model:open="confirmCancel"
      tone="danger"
      :title="$t('enrichment.studio.cancel_title')"
      :message="$t('enrichment.studio.cancel_message')"
      :confirm-label="$t('enrichment.studio.cancel_run')"
      :loading="cancelling"
      @confirm="cancelRun"
      @cancel="confirmCancel = false"
    />
  </PageLayout>
</template>

<script>
import { GET_Run, POST_CancelRun } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import ProfileGate from "./ProfileGate.vue";
import StepPanel from "./StepPanel.vue";
import StepRail from "./StepRail.vue";
import { defaultStep, isRunWorking, runTitle, runTone } from "./studioLogic";

const REFRESH_MS = 4000;
const OPEN = ["running", "waiting", "failed"];

// One run of a workflow: the steps rail and the selected step's output with its decisions, the run's state and what
// it has cost so far. While a step works the run refreshes itself; an approval moves on to the next step.
export default {
  name: "RunView",
  components: { CostLabel, ProfileGate, StepPanel, StepRail },
  setup() {
    return { notify: useNotifyStore(), runTone };
  },
  data() {
    return { run: null, loading: true, timer: null, confirmCancel: false, cancelling: false };
  },
  computed: {
    uid() {
      return this.$route.params.uid;
    },
    title() {
      return runTitle(this.run) || this.$t("enrichment.studio.title");
    },
    crumbs() {
      return [{ label: this.$t("enrichment.studio.title"), to: { name: "EnrichmentStudio" } }, { label: this.title }];
    },
    selectedKey() {
      const asked = this.$route.query.step;
      return this.run?.steps.some((s) => s.key === asked) ? asked : defaultStep(this.run);
    },
    selectedStep() {
      return this.run?.steps.find((s) => s.key === this.selectedKey) || null;
    },
    actions() {
      if (!OPEN.includes(this.run.status)) return [];
      return [{ key: "cancel", role: "danger", mutates: true, label: this.$t("enrichment.studio.cancel_run"),
        testid: "run-cancel", onClick: () => (this.confirmCancel = true) }];
    },
  },
  watch: {
    uid: { immediate: true, handler: "load" },
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    async load() {
      this.loading = true;
      await this.refresh();
      this.loading = false;
    },
    async refresh() {
      clearTimeout(this.timer);
      try {
        const { data } = await GET_Run(this.uid);
        this.setRun(data);
      } catch (err) {
        if (err?.response?.status !== 404) this.failed(err);
        if (!this.run) return;
        this.schedule();
      }
    },
    setRun(run) {
      this.run = run;
      this.schedule();
    },
    schedule() {
      clearTimeout(this.timer);
      if (isRunWorking(this.run)) this.timer = setTimeout(this.refresh, REFRESH_MS);
    },
    onChanged(run, { advance } = {}) {
      this.setRun(run);
      if (advance) this.$router.replace({ query: { step: defaultStep(run) } });
    },
    async cancelRun() {
      this.cancelling = true;
      try {
        const { data } = await POST_CancelRun(this.uid);
        this.setRun(data);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.studio.cancelled_toast") });
      } catch (err) {
        this.failed(err);
      } finally {
        this.cancelling = false;
        this.confirmCancel = false;
      }
    },
    failed(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.run-view__grid {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--space-8);
  align-items: start;

  @include max-tablet {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
  }
}
</style>
