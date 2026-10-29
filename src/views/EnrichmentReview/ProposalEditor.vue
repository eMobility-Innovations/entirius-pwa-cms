<template>
  <PageLayout class="proposal-editor">
    <template #header>
      <PageHeader :title="title" :crumbs="crumbs" :back="goBack">
        <template v-if="proposal" #meta>
          <Tag v-if="language" :label="language.toUpperCase()" />
          <span class="fs-300 t-secondary">{{ subject }}</span>
        </template>
        <template v-if="proposal" #actions>
          <ActionBar :actions="actions" />
        </template>
      </PageHeader>
    </template>

    <Loader v-if="loading" block />
    <EmptyState
      v-else-if="loadFailed"
      icon="empty"
      size="md"
      :title="$t('enrichment.editor.load_error')"
      :message="$t('enrichment.editor.load_error_hint')"
      data-testid="editor-load-error"
    />
    <EmptyState
      v-else-if="!proposal || shape !== 'text'"
      icon="empty"
      size="md"
      :title="$t(proposal ? 'enrichment.editor.no_text' : 'enrichment.editor.missing')"
      :message="$t('enrichment.editor.missing_hint')"
      data-testid="editor-missing"
    >
      <router-link to="/enrichment" class="t-accent fw-600" data-testid="editor-missing-back">
        {{ $t("enrichment.editor.back_to_review") }}
      </router-link>
    </EmptyState>
    <div v-else class="proposal-editor__grid">
      <div class="flex-column gap-8">
        <BasicCard>
          <div class="flex-column gap-5">
            <ReadonlyOff>
              <SegmentedControl v-model="view" :options="viewOptions" class="proposal-editor__switch" />
            </ReadonlyOff>
            <div
              v-if="view === 'edit'"
              class="flex-column gap-2"
              @mouseup="captureSelection"
              @keyup="captureSelection"
              @select="captureSelection"
            >
              <FormField :label="$t('enrichment.editor.text')">
                <BasicTextarea v-model="draft" :rows="22" :disabled="!editable || busy" data-testid="editor-text" />
              </FormField>
              <span v-if="dirty" class="fs-200 t-secondary" data-testid="editor-dirty">{{ $t("enrichment.editor.unsaved") }}</span>
            </div>
            <div v-else-if="view === 'preview'" class="proposal-editor__preview" data-testid="editor-preview" v-html="sanitizeHtml(previewSource)" />
            <TextDiff v-else :before="valueText(proposal.current_snapshot)" :after="draft" />
          </div>
        </BasicCard>
      </div>

      <aside class="flex-column gap-8">
        <BasicCard :title="$t('enrichment.correct.open')" gap>
          <div class="flex-column gap-5">
            <Loader v-if="!revisions" :size="32" />
            <CorrectionThread
              v-else
              :revisions="revisions"
              :busy="busy"
              :restorable="editable"
              :asking="asking"
              :candidates="candidates"
              :landed="landed"
              @restore="restoreVersion"
              @pick="pick"
              @dismiss="candidates = []"
            />
            <template v-if="editable">
              <CorrectionBar ref="bar" :shape="shape" :selection="selection" :busy="busy" @submit="correct" />
              <RuleChips
                :rules="proposal.rules || []"
                :busy="busy"
                :has-template="!!task?.params?.template"
                :has-worker="hasWorker"
                @change="setRules"
                @promote="promote"
              />
            </template>
          </div>
        </BasicCard>
      </aside>
    </div>

    <DriftModal :visible="!!drifted" :proposal="drifted" :busy="applying" @confirm="confirmDrift" @reject="rejectDrift" @close="drifted = null" />
    <ConfirmDialog
      :open="!!pendingNav"
      :title="$t('unsaved.title')"
      :message="$t('unsaved.message')"
      :confirm-label="$t('unsaved.save_and_leave')"
      :discard-label="$t('unsaved.discard')"
      @confirm="saveAndLeave"
      @discard="confirmLeave"
      @cancel="cancelLeave"
    />
  </PageLayout>
</template>

<script>
import { computed, ref } from "vue";
import { marked } from "marked";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { ReadonlyOff } from "@/composables/useReadonly";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { isNotFound } from "@/api/createClient";
import { GET_Proposal, GET_Task, POST_RejectProposal } from "@/api/enrichment/api";
import CorrectionBar from "./CorrectionBar.vue";
import CorrectionThread from "./CorrectionThread.vue";
import DriftModal from "./DriftModal.vue";
import RuleChips from "./RuleChips.vue";
import TextDiff from "./TextDiff.vue";
import { useFieldLabels } from "./useFieldLabels";
import { useProposalCorrection } from "./useProposalCorrection";
import { revisable, textareaSelection, uniqueFragment, valueShape, valueText, withText } from "./correction";
import { isHtml, workerOf } from "./reviewLogic";
import { acceptChosen } from "./applyMode";

// The full-screen editor of one long text proposal (`/enrichment/edit/:proposalId`): the text as it is stored (HTML
// or markdown) with a preview and the changes against the live value, AI corrections scoped to the selected
// fragment — the versions as a correction thread with its composer and the rules beside the text. "Save version" keeps a manual edit; Apply saves it first and
// writes the value (a drifted field asks again). Leaving with a manual edit not saved as a version asks first.
export default {
  name: "ProposalEditor",
  components: { ReadonlyOff, CorrectionBar, CorrectionThread, DriftModal, RuleChips, TextDiff },
  setup() {
    const proposal = ref(null);
    const draft = ref("");
    const setProposal = (value) => {
      proposal.value = value;
      draft.value = valueText(value.proposed_value);
    };
    const correction = useProposalCorrection(computed(() => proposal.value || {}), setProposal);
    return { proposal, draft, setProposal, ...correction, notify: useNotifyStore(), ...useFieldLabels(), ...useUnsavedChanges() };
  },
  data() {
    return { loading: true, loadFailed: false, task: null, view: "edit", selection: "", applying: false, drifted: null };
  },
  computed: {
    title() {
      return this.proposal ? this.proposalField(this.proposal) : this.$t("enrichment.editor.title");
    },
    crumbs() {
      return [{ label: this.$t("enrichment.review.title"), to: "/enrichment" }, { label: this.title }];
    },
    language() {
      return this.proposal?.target_locator?.language || "";
    },
    subject() {
      return this.proposal?.subject_label || this.proposal?.subject_ref || "";
    },
    shape() {
      return valueShape(this.proposal?.proposed_value);
    },
    editable() {
      return revisable(this.proposal) && this.shape === "text";
    },
    hasWorker() {
      return !!workerOf(this.proposal?.source);
    },
    dirty() {
      return !!this.proposal && this.draft !== valueText(this.proposal.proposed_value);
    },
    // HTML as it is; anything else read as markdown (plain text stays paragraphs).
    previewSource() {
      return isHtml(this.draft) ? this.draft : marked.parse(this.draft || "");
    },
    viewOptions() {
      return ["edit", "preview", "changes"].map((value) => ({
        value,
        label: this.$t(`enrichment.editor.view_${value}`),
        testid: `editor-view-${value}`,
      }));
    },
    actions() {
      if (!this.editable) return [];
      const off = this.busy || this.applying;
      return [
        { key: "save", role: "secondary", mutates: true, label: this.$t("enrichment.editor.save_version"),
          disabled: off || !this.dirty, testid: "editor-save", onClick: this.saveDraft },
        { key: "apply", role: "primary", mutates: true, label: this.$t("enrichment.review.apply"), disabled: off,
          loading: this.applying, testid: "editor-apply", onClick: this.apply },
      ];
    },
  },
  watch: {
    // Every new version (a correction, a restore, a save) may no longer hold the selected fragment.
    proposal() {
      this.selection = "";
    },
    dirty(on) {
      this.isDirty = on;
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  mounted() {
    this.load();
  },
  methods: {
    async saveAndLeave() {
      if (await this.saveDraft()) this.confirmLeave();
    },
    valueText,
    sanitizeHtml,
    async load() {
      await this.loadProposal();
      this.loading = false;
      if (this.proposal?.task_id != null) await this.loadTask(this.proposal.task_id);
    },
    // A 404 shows "gone"; any other failure says so and shows the load error.
    async loadProposal() {
      try {
        const { data } = await GET_Proposal(this.$route.params.proposalId);
        this.setProposal(data);
        this.loadVersions();
      } catch (err) {
        if (isNotFound(err)) return;
        this.loadFailed = true;
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      }
    },
    async loadTask(taskId) {
      try {
        this.task = (await GET_Task(taskId)).data;
      } catch {
        // A missing task only hides the template promotion.
      }
    },
    captureSelection(event) {
      this.selection = uniqueFragment(this.draft, textareaSelection(event.target));
    },
    // Manual edits become a version before the AI sees the text.
    async saveDraft() {
      if (!this.dirty) return true;
      return this.saveValue(withText(this.proposal.proposed_value, this.draft));
    },
    async correct(request) {
      if (!(await this.saveDraft())) return;
      if ((await this.revise(request)) && request.instruction.trim()) this.$refs.bar?.reset();
    },
    pick(candidate) {
      return this.saveValue(candidate);
    },
    restoreVersion(number) {
      return this.restore(number);
    },
    async apply() {
      if (!(await this.saveDraft())) return;
      await this.accept();
    },
    async accept() {
      this.applying = true;
      try {
        const { data } = await acceptChosen(this.proposal);
        if (data.status === "drifted") {
          this.drifted = data;
          return;
        }
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.review.toast.accepted") });
        this.goBack();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.applying = false;
      }
    },
    async confirmDrift() {
      this.drifted = null;
      await this.accept();
    },
    async rejectDrift({ proposal, reason }) {
      this.drifted = null;
      try {
        await POST_RejectProposal(proposal.id, reason ? { reason } : {});
        this.goBack();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      }
    },
    goBack() {
      if (window.history.state?.back) this.$router.back();
      else this.$router.push("/enrichment");
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.proposal-editor__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 24rem);
  gap: var(--space-8);
  align-items: start;

  @include max-shell {
    grid-template-columns: minmax(0, 1fr);
  }
}
.proposal-editor__switch {
  align-self: flex-start;
}
.proposal-editor__preview {
  max-width: 70ch;
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
  word-break: break-word;
}
</style>
