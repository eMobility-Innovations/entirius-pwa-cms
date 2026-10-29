<template>
  <BasicCard class="step-panel" :data-testid="`step-panel-${step.key}`">
    <div class="flex-column gap-6">
      <p v-if="approved" class="step-panel__approved m-0" data-testid="step-approved">
        <FontAwesomeIcon :icon="$icons.success" class="step-panel__approved-icon" aria-hidden="true" />
        <span>{{ $t("enrichment.studio.approved_bar") }}</span>
        <template v-if="proposal">
          <span aria-hidden="true">·</span>
          <CostLabel :cost="proposal.cost_usd" />
        </template>
      </p>

      <header class="step-panel__head">
        <span class="step-panel__number" :class="`step-panel__number--${tone}`" aria-hidden="true">{{ number }}</span>
        <div class="step-panel__heading flex-column gap-1">
          <div class="step-panel__title-row">
            <h2 class="step-panel__title m-0">{{ step.label }}</h2>
            <StatusBadge v-if="!approved" :label="statusLabel" :tone="tone" size="sm" />
            <p v-if="caption || (proposal && !approved)" class="step-panel__caption m-0" data-testid="step-caption">
              <span v-if="caption">{{ caption }}</span>
              <span v-if="caption && proposal && !approved" aria-hidden="true">·</span>
              <CostLabel v-if="proposal && !approved" :cost="proposal.cost_usd" />
            </p>
          </div>
          <p v-if="purpose && !approved && !stopped" class="m-0 fs-300 t-secondary" data-testid="step-purpose">{{ purpose }}</p>
        </div>
        <BasicTooltip
          v-if="explainer"
          variant="help"
          :text="explainer"
          placement="left"
          class="step-panel__help"
          data-testid="step-explainer"
        />
      </header>

      <EmptyState v-if="stopped" icon="info" size="sm" :title="$t('enrichment.studio.stopped')" data-testid="step-stopped" />
      <EmptyState
        v-else-if="step.status === 'waiting'"
        icon="scheduled"
        size="sm"
        class="step-panel__waiting"
        :title="$t('enrichment.studio.waiting_for', { steps: neededLabels })"
        data-testid="step-waiting"
      >
        <router-link
          v-for="other in reviewBlockers"
          :key="other.key"
          :to="{ query: { step: other.key } }"
          replace
          class="t-accent fw-600 fs-250"
        >
          {{ $t("enrichment.studio.go_to", { step: other.label }) }}
        </router-link>
      </EmptyState>
      <div v-else-if="step.status === 'running' && !stale" class="flex-column gap-4" role="status" data-testid="step-running">
        <div class="flex-column gap-1">
          <p class="step-panel__running m-0">
            <FontAwesomeIcon :icon="$icons.running" spin class="step-panel__spinner" aria-hidden="true" />
            {{ $t("enrichment.studio.running", { step: step.label }) }}
          </p>
          <p class="m-0 fs-250 t-secondary">{{ $t("enrichment.studio.running_for", { time: elapsed }) }}</p>
        </div>
        <div class="step-panel__skeleton flex-column gap-3" aria-hidden="true">
          <span v-for="(width, index) in SKELETON" :key="index" class="step-panel__bar" :style="{ width }" />
        </div>
      </div>
      <StepCallout v-else-if="stale" tone="warning" icon="scheduled" data-testid="step-stale">
        <p class="m-0">{{ $t("enrichment.studio.stale") }}</p>
      </StepCallout>
      <StepCallout v-else-if="step.status === 'failed'" tone="negative" icon="warning" role="alert" :title="failureTitle" data-testid="step-failed">
        <p class="m-0">{{ $t("enrichment.studio.failed_hint") }}</p>
      </StepCallout>
      <Loader v-else-if="loading" block />

      <template v-if="proposal && step.status !== 'running'">
        <QuestionsForm v-if="kind === 'questions'" ref="output" :proposal="proposal" @updated="setProposal" @state="(s) => (form = s)" />
        <CoverVariants v-else-if="kind === 'cover'" ref="output" :proposal="proposal" @updated="setProposal" @state="(s) => (form = s)" />
        <DocumentSummary v-else-if="kind === 'document'" :proposal="proposal" :run="run" />
        <KeywordsTable v-else-if="kind === 'keywords'" :proposal="proposal" @updated="setProposal" @busy="(b) => (picking = b)" />
        <MetaCards v-else-if="kind === 'meta'" :proposal="proposal" />
        <ScenesList v-else-if="kind === 'scenes'" :proposal="proposal" />
        <TextArtifact v-else-if="kind === 'text'" :proposal="proposal" />
        <pre v-else class="step-panel__data m-0" data-testid="step-data">{{ dataText }}</pre>
      </template>

      <footer v-if="decisions.length" class="step-panel__footer" data-testid="step-footer">
        <ProposalCorrection
          v-if="correctable"
          size="md"
          :proposal="proposal"
          @updated="setProposal"
          @busy="(b) => (correcting = b)"
        >
          <template #lead>
            <BasicButton v-if="canRegenerate" mutates variant="ghost" icon="refresh" :disabled="off" data-testid="step-regenerate" @click="openRegenerate">
              {{ $t("enrichment.studio.regenerate") }}
            </BasicButton>
          </template>
          <template #trail>
            <div class="step-panel__decide">
              <span v-if="saveNote" class="fs-250 t-secondary" :data-testid="saveNote.testid">{{ saveNote.text }}</span>
              <ActionBar :actions="decisions" :labelled="false" />
            </div>
          </template>
        </ProposalCorrection>
        <div v-else class="step-panel__tools flex ai-ct flex-wrap gap-3">
          <BasicButton v-if="canRegenerate" mutates variant="ghost" icon="refresh" :disabled="off" data-testid="step-regenerate" @click="openRegenerate">
            {{ $t("enrichment.studio.regenerate") }}
          </BasicButton>
          <div class="step-panel__decide">
            <span v-if="saveNote" class="fs-250 t-secondary" :data-testid="saveNote.testid">{{ saveNote.text }}</span>
            <ActionBar :actions="decisions" :labelled="false" />
          </div>
        </div>
      </footer>
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
import { GET_Proposal, GET_Run, GET_Task, POST_AcceptProposal, POST_RegenerateStep } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import ProposalCorrection from "@/views/EnrichmentReview/ProposalCorrection.vue";
import { revisable } from "@/views/EnrichmentReview/correction";
import { pluralKey } from "@/utils/plural";
import CoverVariants from "./CoverVariants.vue";
import DocumentSummary from "./DocumentSummary.vue";
import KeywordsTable from "./KeywordsTable.vue";
import MetaCards from "./MetaCards.vue";
import QuestionsForm from "./QuestionsForm.vue";
import ScenesList from "./ScenesList.vue";
import StepCallout from "./StepCallout.vue";
import TextArtifact from "./TextArtifact.vue";
import {
  blockers,
  elapsedLabel,
  failureCode,
  isRunClosed,
  isRunStale,
  isStepStopped,
  nextStep,
  outputKind,
  readingStats,
  stepTone,
} from "./studioLogic";

// The shape of a text that is still being written.
const SKELETON = ["40%", "92%", "86%", "70%", "55%"];
// Outputs the operator fills in before approving (answers, a cover pick): Approve saves them first (`prepare()`).
const FORM_KINDS = ["questions", "cover"];
const TICK_MS = 1000;
// A toolbox HTTP failure (`SEO_BRIEF_TOOLBOX_HTTP_404`): a service behind the AI did not answer.
const SERVICE_DOWN = /_HTTP_\d+$/;

// One step of a run in one shell: number, name, status and what the step is for (a help mark on the right explains
// what the step does in two or three sentences, also once it is approved); then its state (waiting for other
// steps, being written, slow, failed, stopped) or its output by type (questions, search phrases, text, metadata,
// cover scenes, cover variants, document); then the footer — tools on the left (Regenerate, and for text Correct with AI, Versions, the editor),
// the one primary on the right named by what it does next. A failed or slow step offers Try again (primary) and Try
// with an instruction. An approved step reads as a summary under an "Approved · cost" bar. A changed run goes up as
// `changed` (`advance` after an approval: the view moves on to the next step).
export default {
  name: "StepPanel",
  components: {
    CostLabel,
    CoverVariants,
    DocumentSummary,
    KeywordsTable,
    MetaCards,
    ProposalCorrection,
    QuestionsForm,
    ScenesList,
    StepCallout,
    TextArtifact,
  },
  props: {
    run: { type: Object, required: true },
    step: { type: Object, required: true },
  },
  emits: ["changed"],
  setup() {
    return { notify: useNotifyStore(), SKELETON };
  },
  data() {
    return {
      proposal: null,
      loading: false,
      busy: false,
      correcting: false,
      // A keyword pick saving: the step is approved with the set the operator picked, never the one before.
      picking: false,
      regenerating: false,
      instruction: "",
      form: null,
      failure: "",
      now: Date.now(),
      ticker: null,
    };
  },
  computed: {
    number() {
      return this.run.steps.findIndex((s) => s.key === this.step.key) + 1;
    },
    tone() {
      return this.stopped ? "neutral" : stepTone(this.step.status);
    },
    statusLabel() {
      return this.$t(this.stopped ? "enrichment.studio.rail.stopped" : `enrichment.studio.step_status.${this.step.status}`);
    },
    approved() {
      return this.step.status === "approved";
    },
    kind() {
      return outputKind(this.step, this.proposal?.proposed_value);
    },
    purpose() {
      return this.known(`enrichment.studio.purpose.${this.step.key}`) || this.known(`enrichment.studio.purpose_output.${this.step.output}`);
    },
    explainer() {
      return this.known(`enrichment.studio.explainer.${this.step.key}`) || this.known(`enrichment.studio.explainer_output.${this.step.output}`);
    },
    caption() {
      if (this.kind === "questions" && this.form?.total) {
        return this.$t("enrichment.studio.questions.answered", { count: this.form.answered, total: this.form.total });
      }
      if (this.kind === "cover" && this.form?.total) {
        if (this.form.chosen !== null) return this.$t("enrichment.studio.cover.chosen_caption", { n: this.form.chosen + 1 });
        return this.$t("enrichment.studio.cover.variants_caption", { count: this.form.total });
      }
      if (this.kind === "scenes") return this.scenesCaption();
      if (this.kind !== "text" || !this.proposal) return "";
      return this.$t("enrichment.studio.text.reading", readingStats(this.proposal.proposed_value?.text));
    },
    // What it still waits for (every step it needs, when those are all approved and it is about to start).
    neededLabels() {
      const open = blockers(this.run, this.step);
      const steps = open.length ? open : this.run.steps.filter((s) => (this.step.needs || []).includes(s.key));
      return steps.map((s) => s.label).join(", ");
    },
    // The steps this one waits for that wait for the operator: a link to each.
    reviewBlockers() {
      return blockers(this.run, this.step).filter((other) => other.status === "review");
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
      return this.step.status === "running" && isRunStale(this.run, this.now);
    },
    ticking() {
      return this.step.status === "running" && !this.stale && !isRunClosed(this.run);
    },
    elapsed() {
      return elapsedLabel(this.now - Date.parse(this.run.modified_at));
    },
    stopped() {
      return isStepStopped(this.run, this.step);
    },
    failedTask() {
      return this.step.status === "failed" ? this.step.task_id : null;
    },
    failureTitle() {
      return this.failure || this.$t("enrichment.studio.failed");
    },
    // An answer saving on its own (the field just left) never blocks Approve: the tap that left the field lands on it,
    // and approve() waits for that save (busy meanwhile, so a second tap sends nothing) before it accepts.
    off() {
      return this.busy || this.correcting || this.picking || this.loading;
    },
    canRetry() {
      return this.step.status === "failed" || this.stale;
    },
    canRegenerate() {
      return this.step.status === "review";
    },
    canApprove() {
      return this.step.status === "review" && this.proposal?.status === "pending";
    },
    // A cover is approved with a variant picked: until then Approve stays off (the note above the images says why).
    unpicked() {
      return this.kind === "cover" && this.form?.chosen == null;
    },
    correctable() {
      return this.kind === "text" && this.canApprove && revisable(this.proposal);
    },
    approveLabel() {
      if (this.kind === "document") return this.$t("enrichment.studio.create_draft");
      const next = nextStep(this.run, this.step.key);
      return next ? this.$t("enrichment.studio.approve_to", { step: next.label }) : this.$t("enrichment.studio.approve");
    },
    // The decision on the right of the footer: one primary, named by what it does next.
    decisions() {
      if (isRunClosed(this.run)) return [];
      if (this.canRetry) {
        return [
          { key: "regenerate", role: "secondary", mutates: true, label: this.$t("enrichment.studio.try_instruction"),
            disabled: this.busy, testid: "step-regenerate", onClick: this.openRegenerate },
          { key: "retry", role: "primary", mutates: true, label: this.$t("enrichment.studio.try_again"),
            disabled: this.busy, loading: this.busy, testid: "step-retry", onClick: this.retry },
        ];
      }
      if (!this.canApprove) return [];
      return [{ key: "approve", role: "primary", mutates: true, label: this.approveLabel, disabled: this.off || this.unpicked,
        loading: this.busy, testid: "step-approve", onClick: this.approve }];
    },
    // The save state of answers or a cover pick beside the primary.
    saveNote() {
      const form = FORM_KINDS.includes(this.kind) && this.canApprove ? this.form : null;
      if (!form) return null;
      if (form.saving) return { text: this.$t("enrichment.studio.questions.saving"), testid: "answers-saving" };
      if (form.dirty) return { text: this.$t("enrichment.studio.questions.unsaved"), testid: "answers-dirty" };
      return form.saved ? { text: this.$t("enrichment.studio.questions.saved"), testid: "answers-saved" } : null;
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
    failedTask: { immediate: true, handler: "loadFailure" },
    ticking: { immediate: true, handler: "tick" },
  },
  beforeUnmount() {
    clearInterval(this.ticker);
  },
  methods: {
    // The scenes are read-only: say how many there are and in which step the picture is picked, also once approved.
    scenesCaption() {
      const picker = nextStep(this.run, this.step.key);
      if (!picker) return "";
      const count = this.proposal.proposed_value.data.scenes.length;
      return this.$t(`enrichment.studio.cover.scenes_${pluralKey(count)}`, { count, step: picker.label });
    },
    known(path) {
      const text = this.$t(path);
      return text === path ? "" : text;
    },
    tick(on) {
      clearInterval(this.ticker);
      this.now = Date.now();
      if (on) this.ticker = setInterval(() => (this.now = Date.now()), TICK_MS);
    },
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
    // Why the step failed, in people's words; nothing on the surface when the reason cannot be read.
    async loadFailure(taskId) {
      this.failure = "";
      if (!taskId) return;
      try {
        const { data } = await GET_Task(taskId);
        if (taskId === this.failedTask) this.failure = this.reason(failureCode(data));
      } catch {
        this.failure = "";
      }
    },
    reason(code) {
      if (!code) return "";
      if (SERVICE_DOWN.test(code)) return this.$t("enrichment.studio.failure_service");
      return this.known(`enrichment.ai.error.${code}`) || this.$t("enrichment.ai.error.unknown");
    },
    setProposal(proposal) {
      this.proposal = proposal;
    },
    async approve() {
      await this.act(async () => {
        if (FORM_KINDS.includes(this.kind) && !(await this.$refs.output.prepare())) return false;
        await POST_AcceptProposal(this.proposal.id);
        const { data } = await GET_Run(this.run.uid);
        this.$emit("changed", data, { advance: true });
      }, "enrichment.studio.approved_toast");
    },
    openRegenerate() {
      this.instruction = "";
      this.regenerating = true;
    },
    retry() {
      return this.regenerate();
    },
    async regenerate() {
      const instruction = this.instruction.trim();
      await this.act(async () => {
        const { data } = await POST_RegenerateStep(this.run.uid, this.step.key, instruction ? { instruction } : {});
        this.regenerating = false;
        this.$emit("changed", data, { advance: false });
      }, "enrichment.studio.regenerating_toast");
    },
    // One decision at a time: a second tap while one is on its way sends nothing. `work` returning false = not done.
    async act(work, toastKey) {
      if (this.busy) return;
      this.busy = true;
      try {
        if ((await work()) === false) return;
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
@import "@/assets/scss/utils/media-query";

.step-panel__approved {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--positive-subtle);
  color: var(--text-strong);
  font-size: var(--fs-250);
  font-weight: 600;
}
.step-panel__approved-icon {
  color: var(--positive);
}
.step-panel__head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}
.step-panel__number {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  background: var(--surface-hover);
  color: var(--text-secondary);
  font-weight: 600;
}
.step-panel__number--warning,
.step-panel__number--info {
  background: var(--accent-fill);
  color: var(--text-on-accent-fill);
}
.step-panel__number--positive {
  background: var(--positive-subtle);
  color: var(--text-strong);
}
.step-panel__number--negative {
  background: var(--negative-subtle);
  color: var(--text-strong);
}
.step-panel__heading {
  flex: 1;
  min-width: 0;
}
// As tall as the title row, so the mark sits on the title's line.
.step-panel__help {
  display: inline-flex;
  flex: none;
  align-items: center;
  min-height: var(--space-8);
}
.step-panel__title {
  font-size: var(--fs-500);
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-strong);
}
.step-panel__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-3);
  min-height: var(--space-8);
}
.step-panel__caption {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  font-size: var(--fs-200);
  color: var(--text-muted);
  white-space: nowrap;
}
// More specific than EmptyState's own one-line look: a tinted strip that starts at the left.
.step-panel .step-panel__waiting {
  justify-content: flex-start;
  flex-wrap: wrap;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.step-panel__running {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
  color: var(--text-strong);
}
.step-panel__spinner {
  color: var(--info);
}
.step-panel__bar {
  display: block;
  height: var(--space-3);
  border-radius: var(--radius-full);
  background: var(--surface-hover);
  animation: step-panel-pulse 1.6s ease-in-out infinite;

  &:first-child {
    height: var(--space-5);
    margin-bottom: var(--space-2);
  }
}
@keyframes step-panel-pulse {
  50% {
    opacity: 0.5;
  }
}
@media (prefers-reduced-motion: reduce) {
  .step-panel__bar {
    animation: none;
  }
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
.step-panel__footer {
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-subtle);
}
.step-panel__decide {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-left: auto;
}

// A phone keeps the decision in reach: the footer sticks to the bottom of the screen while the step scrolls. It sits
// flush on the scroll body's edge through PageLayout's padding (as its own footer does), so no strip of the step
// shows cut off beneath it, and it keeps the FAB's corner lane clear.
@include max-shell {
  .step-panel__footer {
    position: sticky;
    bottom: calc(-1 * var(--page-layout-pad-y, var(--space-5)));
    z-index: 1;
    padding-bottom: var(--space-3);
    padding-right: var(--fab-lane, 0px);
    background: var(--surface-base);
  }
}
@include max-tablet {
  .step-panel__head {
    gap: var(--space-3);
  }
  .step-panel__caption {
    flex-basis: 100%;
    margin-left: 0;
    white-space: normal;
  }
  .step-panel__decide {
    justify-content: flex-start;
  }
  // "Saving…" appears after Approve, so it never pushes the button away from a tap.
  .step-panel__decide > span {
    order: 1;
  }
}
</style>
