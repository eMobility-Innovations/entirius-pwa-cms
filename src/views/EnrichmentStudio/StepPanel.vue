<template>
  <BasicCard class="step-panel" :data-testid="`step-panel-${step.key}`">
    <div class="flex-column gap-6">
      <header class="flex ai-ct flex-wrap gap-3">
        <h2 class="step-panel__title m-0">{{ step.label }}</h2>
        <StatusBadge :label="$t(`enrichment.studio.step_status.${step.status}`)" :tone="tone" size="sm" />
        <CostLabel v-if="proposal" class="step-panel__cost" :cost="proposal.cost_usd" />
      </header>

      <p v-if="stopped" class="m-0 t-secondary" data-testid="step-stopped">
        {{ $t("enrichment.studio.stopped") }}
      </p>
      <p v-else-if="step.status === 'waiting'" class="m-0 t-secondary" data-testid="step-waiting">
        {{ $t("enrichment.studio.waiting_for", { steps: neededLabels }) }}
      </p>
      <div v-else-if="step.status === 'running' && !stale" class="flex ai-ct gap-3 t-secondary" data-testid="step-running">
        <Loader />
        <span>{{ $t("enrichment.studio.running") }}</span>
      </div>
      <p v-else-if="step.status === 'running'" class="m-0 t-secondary" data-testid="step-stale">
        {{ $t("enrichment.studio.stale") }}
      </p>
      <p v-else-if="step.status === 'failed'" class="m-0 step-panel__failed" role="alert" data-testid="step-failed">
        {{ $t("enrichment.studio.failed") }}
      </p>
      <Loader v-else-if="loading" block />

      <template v-if="proposal && step.status !== 'running'">
        <QuestionsForm v-if="kind === 'questions'" ref="output" :proposal="proposal" @updated="setProposal" />
        <DocumentSummary v-else-if="kind === 'document'" :proposal="proposal" :run="run" />
        <KeywordsTable v-else-if="kind === 'keywords'" :proposal="proposal" @updated="setProposal" />
        <MetaCards v-else-if="kind === 'meta'" :proposal="proposal" />
        <TextArtifact v-else-if="kind === 'text'" :proposal="proposal" @updated="setProposal" @busy="(b) => (correcting = b)" />
        <pre v-else class="step-panel__data m-0" data-testid="step-data">{{ dataText }}</pre>
      </template>

      <ActionBar v-if="actions.length" :actions="actions" />
    </div>

    <BasicModal
      v-model:open="regenerating"
      :title="$t('enrichment.studio.regenerate_title', { step: step.label })"
      size="sm"
      :persistent="busy"
      :actions="regenerateActions"
      data-testid="regenerate-dialog"
    >
      <FormField :label="$t('enrichment.studio.instruction')" :hint="$t('enrichment.studio.instruction_hint')">
        <BasicTextarea v-model="instruction" :rows="3" :maxlength="1000" data-testid="regenerate-instruction" />
      </FormField>
    </BasicModal>
  </BasicCard>
</template>

<script>
import { GET_Proposal, GET_Run, POST_AcceptProposal, POST_RegenerateStep } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import DocumentSummary from "./DocumentSummary.vue";
import KeywordsTable from "./KeywordsTable.vue";
import MetaCards from "./MetaCards.vue";
import QuestionsForm from "./QuestionsForm.vue";
import TextArtifact from "./TextArtifact.vue";
import { isRunClosed, isRunStale, outputKind, stepLook } from "./studioLogic";

const REGENERABLE = ["review", "failed"];

// One step of a run: its output by type (questions form, text card, search phrases, metadata, document summary) and
// its decisions — Approve (the next steps start) and Regenerate with an optional instruction. A changed run goes up
// as `changed` (`advance` after an approval: the view moves on to the next step).
export default {
  name: "StepPanel",
  components: { CostLabel, DocumentSummary, KeywordsTable, MetaCards, QuestionsForm, TextArtifact },
  props: {
    run: { type: Object, required: true },
    step: { type: Object, required: true },
  },
  emits: ["changed"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { proposal: null, loading: false, busy: false, correcting: false, regenerating: false, instruction: "" };
  },
  computed: {
    tone() {
      return stepLook(this.step.status).tone;
    },
    kind() {
      return outputKind(this.step, this.proposal?.proposed_value);
    },
    neededLabels() {
      const labels = Object.fromEntries(this.run.steps.map((s) => [s.key, s.label]));
      return (this.step.needs || []).map((key) => labels[key] || key).join(", ");
    },
    dataText() {
      return JSON.stringify(this.proposal?.proposed_value?.data ?? this.proposal?.proposed_value, null, 2);
    },
    // A new output or a new state of the same one reloads the proposal.
    outputKey() {
      return this.step.proposal_id ? `${this.step.proposal_id}:${this.step.status}` : "";
    },
    // Re-evaluated on every refresh of the run; the view stops refreshing once the run has gone quiet.
    stale() {
      return this.step.status === "running" && isRunStale(this.run);
    },
    stopped() {
      return this.run.status === "cancelled" && this.step.status !== "approved";
    },
    canRegenerate() {
      return REGENERABLE.includes(this.step.status) || this.stale;
    },
    canApprove() {
      return this.step.status === "review" && this.proposal?.status === "pending";
    },
    actions() {
      if (isRunClosed(this.run)) return [];
      const off = this.busy || this.correcting || this.loading;
      return [
        this.canRegenerate && {
          key: "regenerate", role: "secondary", mutates: true, label: this.$t("enrichment.studio.regenerate"),
          disabled: off, testid: "step-regenerate", onClick: this.openRegenerate,
        },
        this.canApprove && {
          key: "approve", role: "primary", mutates: true, label: this.$t("enrichment.studio.approve"),
          disabled: off, loading: this.busy, testid: "step-approve", onClick: this.approve,
        },
      ].filter(Boolean);
    },
    regenerateActions() {
      return [
        { key: "cancel", role: "secondary", mutates: false, label: this.$t("common.cancel"), disabled: this.busy,
          onClick: () => (this.regenerating = false) },
        { key: "regenerate", role: "primary", mutates: true, label: this.$t("enrichment.studio.regenerate"),
          loading: this.busy, testid: "regenerate-confirm", onClick: this.regenerate },
      ];
    },
  },
  watch: {
    outputKey: { immediate: true, handler: "loadProposal" },
  },
  methods: {
    async loadProposal() {
      const key = this.outputKey;
      if (!key) {
        this.proposal = null;
        return;
      }
      if (this.proposal?.id !== this.step.proposal_id) {
        this.proposal = null;
        this.loading = true;
      }
      try {
        const { data } = await GET_Proposal(this.step.proposal_id);
        if (key === this.outputKey) this.proposal = data;
      } catch (err) {
        this.failed(err);
      } finally {
        this.loading = false;
      }
    },
    setProposal(proposal) {
      this.proposal = proposal;
    },
    async approve() {
      if (this.kind === "questions" && !(await this.$refs.output.prepare())) return;
      await this.act(async () => {
        await POST_AcceptProposal(this.proposal.id);
        const { data } = await GET_Run(this.run.uid);
        this.$emit("changed", data, { advance: true });
      }, "enrichment.studio.approved_toast");
    },
    openRegenerate() {
      this.instruction = "";
      this.regenerating = true;
    },
    async regenerate() {
      const instruction = this.instruction.trim();
      await this.act(async () => {
        const { data } = await POST_RegenerateStep(this.run.uid, this.step.key, instruction ? { instruction } : {});
        this.regenerating = false;
        this.$emit("changed", data, { advance: false });
      }, "enrichment.studio.regenerating_toast");
    },
    async act(work, toastKey) {
      this.busy = true;
      try {
        await work();
        this.notify.spawnNotification({ type: "positive", msg: this.$t(toastKey) });
      } catch (err) {
        this.regenerating = false;
        this.failed(err);
      } finally {
        this.busy = false;
      }
    },
    failed(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>

<style lang="scss" scoped>
.step-panel__title {
  font-size: var(--fs-500);
  font-weight: 600;
  color: var(--text-strong);
}
.step-panel__cost {
  margin-left: auto;
}
.step-panel__failed {
  color: var(--negative);
}
.step-panel__data {
  padding: var(--space-4);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  font-family: var(--font-mono);
  font-size: var(--fs-200);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
