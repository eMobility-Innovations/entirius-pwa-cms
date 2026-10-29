<template>
  <article class="proposal-panel flex-column gap-5" :data-testid="`proposal-panel-${proposal.id}`">
    <header class="flex ai-ct flex-wrap gap-3">
      <h3 class="proposal-panel__field m-0" data-testid="proposal-field">{{ fieldName }}</h3>
      <Tag v-if="language" :label="language.toUpperCase()" data-testid="proposal-language" />
      <StatusBadge v-if="proposal.status !== 'pending'" :label="$t(`enrichment.status.${proposal.status}`)" size="sm" />
      <span class="proposal-panel__cost flex ai-ct gap-1">
        <CostLabel :cost="proposal.cost_usd" data-testid="proposal-cost" />
        <ProposalDetails :proposal="proposal" :task="task" />
      </span>
    </header>

    <div v-if="sourceLanguage" class="flex-column gap-2" data-testid="proposal-source">
      <span class="fs-200 fw-600 t-secondary">{{ $t("enrichment.review.source_value", { language: sourceLanguage.toUpperCase() }) }}</span>
      <div v-if="sourceIsHtml" class="proposal-panel__source" v-html="sanitizeHtml(source)" />
      <p v-else class="proposal-panel__source m-0">{{ source || "—" }}</p>
    </div>

    <FormField v-if="editing" :label="$t('enrichment.review.edit_label')">
      <BasicTextarea v-model="draft" :rows="8" data-testid="proposal-edit-text" />
      <div class="flex ai-ct jc-sb flex-wrap gap-3 mt-2">
        <LengthCounter v-if="rules" :length="draftLength" :rules="rules" />
        <!-- Long texts (an HTML description) read better full screen; an unsaved draft is saved first. -->
        <BasicButton
          size="sm"
          variant="ghost"
          icon="fullscreen"
          class="proposal-panel__full"
          mutates
          :disabled="saving"
          data-testid="proposal-full-editor"
          @click="openFullEditor"
        >
          {{ $t("enrichment.review.full_editor") }}
        </BasicButton>
      </div>
    </FormField>
    <!-- A Studio step's output is read and edited on its run, never here as raw data. -->
    <div v-else-if="runUid" class="flex-column gap-3" data-testid="proposal-studio">
      <p class="m-0 fs-300">{{ $t("enrichment.review.studio_note") }}</p>
      <router-link
        :to="{ name: 'EnrichmentStudioRun', params: { uid: runUid } }"
        class="proposal-panel__studio t-accent fw-600"
        data-testid="proposal-studio-link"
      >
        {{ $t("enrichment.review.open_in_studio") }}
      </router-link>
    </div>
    <div v-else ref="view" class="flex-column" data-testid="proposal-view" @mouseup="captureSelection" @keyup="captureSelection">
      <DiffRenderer
        :target-kind="proposal.target_kind"
        :proposed="proposal.proposed_value"
        :current="proposal.current_snapshot"
        :proposal-id="proposal.id"
        :subject-label="productName"
        :wide="wide"
        :rules="rules"
        :snippet="snippet"
        :locator="locator"
      />
    </div>

    <QaWarnings v-if="!editing" :proposal="proposal" @busy="(value) => (qaBusy = value)" />

    <!-- One row of tools under the content: Refine with AI, then the guidelines check and its state. -->
    <ProposalCorrection
      v-if="correctable"
      v-show="!editing"
      :proposal="proposal"
      :task="task"
      :selection="selection"
      :editor="false"
      @updated="(p) => $emit('updated', p)"
      @busy="(value) => (correctionBusy = value)"
    >
      <template #trail>
        <QaCheckStatus :proposal="proposal" @updated="(p) => $emit('updated', p)" @busy="(value) => (checkBusy = value)" />
      </template>
    </ProposalCorrection>

    <!-- A picture made from one of the product's pictures: added next to it (default) or in its place. -->
    <FormField v-if="replaceable" :label="$t('enrichment.apply_mode.label')" data-testid="proposal-apply-mode">
      <BasicRadioGroup
        :model-value="applyMode"
        :options="modeOptions"
        :name="`apply-mode-${proposal.id}`"
        :disabled="locked"
        @update:model-value="(mode) => chooseMode(proposal, mode)"
      />
      <p v-if="applyMode === 'replace'" class="fs-200 t-secondary m-0 mt-2" data-testid="proposal-apply-mode-hint">
        {{ $t("enrichment.apply_mode.replace_hint") }}
      </p>
    </FormField>

    <ActionBar :actions="actions" :labelled="false" />
  </article>
</template>

<script>
import { usePimChannelStore } from "@/stores/pimChannel";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { GET_Product } from "@/api/pim/api";
import { PATCH_Proposal } from "@/api/enrichment/api";
import CostLabel from "./CostLabel.vue";
import DiffRenderer from "./DiffRenderer.vue";
import LengthCounter from "./LengthCounter.vue";
import ProposalCorrection from "./ProposalCorrection.vue";
import ProposalDetails from "./ProposalDetails.vue";
import QaCheckStatus from "./QaCheckStatus.vue";
import QaWarnings from "./QaWarnings.vue";
import { revisable, uniqueFragment, valueText } from "./correction";
import { MODE_ADD, MODE_REPLACE, canReplace, chooseMode, modeOf } from "./applyMode";
import { useFieldLabels } from "./useFieldLabels";
import { editableText, isHtml, plainText, runUidOf, sourceText, textRules, translationSource } from "./reviewLogic";

const ACTIONABLE = ["pending", "drifted"];

// One proposal as a card, in three bands: the content (the field by its PIM name and the language, the change in
// DiffRenderer — a translation with its source text, a meta description with its search preview and length — and
// the QA warnings under it), one row of tools (Refine with AI, the guidelines check and its state), the decisions
// (Reject, Edit, Apply). What the AI call cost sits in the header; the ⓘ next to it opens the details: cost, model,
// worker and what the AI used from the company profile. Edit is in place; for a long text it leads on to the full
// editor. `product` is the product on screen, else it is fetched when the view needs it. A selection in the text
// narrows a correction. A picture made from one of the product's pictures asks, above Apply, whether it goes next to the
// original or replaces it (applyMode — the pick is what every Apply of this proposal sends).
export default {
  name: "ProposalPanel",
  components: { CostLabel, DiffRenderer, LengthCounter, ProposalCorrection, ProposalDetails, QaCheckStatus, QaWarnings },
  props: {
    proposal: { type: Object, required: true },
    task: { type: Object, default: null },
    busy: { type: Boolean, default: false },
    wide: { type: Boolean, default: false },
    product: { type: Object, default: null },
  },
  emits: ["accept", "reject", "updated"],
  setup() {
    return { pimChannel: usePimChannelStore(), notify: useNotifyStore(), ...useFieldLabels() };
  },
  data() {
    return {
      editing: false, draft: "", saving: false, loaded: null, selection: "", correctionBusy: false, qaBusy: false, checkBusy: false,
    };
  },
  computed: {
    locator() {
      return this.proposal.target_locator || {};
    },
    language() {
      return this.locator.language || "";
    },
    runUid() {
      return runUidOf(this.proposal);
    },
    fieldName() {
      return this.proposalField(this.proposal);
    },
    rules() {
      return textRules(this.locator.feature_idx, this.feature(this.locator.feature_idx));
    },
    sourceLanguage() {
      return translationSource(this.task, this.proposal);
    },
    productData() {
      return this.product || this.loaded;
    },
    productName() {
      const p = this.productData;
      return p?.name_t9n?.[this.language] || p?.name || this.proposal.subject_label || this.proposal.subject_ref;
    },
    // A meta description reads under the product's name; a meta title is the result's title over its description.
    snippet() {
      if (!this.rules?.snippet) return null;
      const urlKey = this.productData?.url_key_t9n?.[this.language] || this.productData?.url_key || "";
      const url = urlKey ? `/${urlKey}` : "";
      if (this.locator.feature_idx !== "meta_title") return { title: this.productName, url };
      const description = sourceText(this.productData, "meta_description", this.language);
      return { url, text: plainText(description) };
    },
    source() {
      return sourceText(this.productData, this.locator.feature_idx, this.sourceLanguage);
    },
    sourceIsHtml() {
      return isHtml(this.source);
    },
    // A tab switch keeps the language but changes the proposal: either one reloads the product when it is needed.
    productKey() {
      const needed = !this.product && (this.sourceLanguage || this.rules?.snippet);
      return needed ? `${this.proposal.id}:${this.sourceLanguage || ""}` : "";
    },
    channel() {
      return this.locator.channel || this.task?.params?.channel || this.pimChannel.activeChannelIdx;
    },
    correctable() {
      return revisable(this.proposal);
    },
    canEdit() {
      return this.proposal.status === "pending" && editableText(this.proposal) !== null;
    },
    replaceable() {
      return canReplace(this.proposal) && ACTIONABLE.includes(this.proposal.status);
    },
    applyMode() {
      return modeOf(this.proposal);
    },
    modeOptions() {
      return [
        { label: this.$t("enrichment.apply_mode.add"), value: MODE_ADD, testid: "proposal-apply-mode-add" },
        { label: this.$t("enrichment.apply_mode.replace"), value: MODE_REPLACE, testid: "proposal-apply-mode-replace" },
      ];
    },
    locked() {
      return this.busy || this.saving || this.correctionBusy || this.qaBusy || this.checkBusy;
    },
    draftLength() {
      return plainText(this.draft).trim().length;
    },
    actions() {
      const off = this.locked;
      if (this.editing) {
        return [
          { key: "cancel", role: "secondary", label: this.$t("common.cancel"), disabled: off, onClick: this.cancelEdit },
          { key: "save", role: "primary", mutates: true, label: this.$t("common.save"), disabled: off,
            loading: this.saving, testid: "proposal-save", onClick: this.saveEdit },
        ];
      }
      if (!ACTIONABLE.includes(this.proposal.status)) return [];
      return [
        { key: "reject", role: "danger", label: this.$t("common.reject"), disabled: off, testid: "proposal-reject",
          onClick: () => this.$emit("reject", { proposal: this.proposal, reason: "" }) },
        this.canEdit && { key: "edit", role: "secondary", mutates: true, label: this.$t("common.edit"), disabled: off,
          testid: "proposal-edit", onClick: this.startEdit },
        { key: "accept", role: "primary", mutates: true, label: this.$t("enrichment.review.apply"), disabled: off,
          testid: "proposal-accept", onClick: () => this.$emit("accept", this.proposal) },
      ].filter(Boolean);
    },
  },
  watch: {
    productKey: { immediate: true, handler: "loadProduct" },
    "proposal.id"() {
      this.editing = false;
      this.selection = "";
    },
    // A new version may no longer hold the selected fragment.
    "proposal.proposed_value"() {
      this.selection = "";
    },
  },
  methods: {
    sanitizeHtml,
    chooseMode,
    async loadProduct() {
      const key = this.productKey;
      if (!key) return;
      try {
        const { data } = await GET_Product(this.channel, this.proposal.subject_ref);
        if (key === this.productKey) this.loaded = data;
      } catch {
        if (key === this.productKey) this.loaded = null;
      }
    },
    // The text the operator selected in the change view narrows a correction — only when it occurs exactly once in
    // the stored proposed text (contract A3 § 1). A selection over removed words or rendered HTML does not; the
    // full-screen editor selects in the source.
    captureSelection() {
      const selection = window.getSelection?.();
      const inside = selection?.anchorNode && this.$refs.view?.contains(selection.anchorNode);
      const fragment = inside ? selection.toString().trim() : "";
      this.selection = uniqueFragment(valueText(this.proposal.proposed_value), fragment);
    },
    startEdit() {
      this.draft = editableText(this.proposal);
      this.editing = true;
    },
    cancelEdit() {
      this.editing = false;
    },
    /** Saves the draft as a new version; false when it failed (the toast says why). */
    async saveEdit() {
      this.saving = true;
      try {
        const proposedValue = { ...this.proposal.proposed_value, text: this.draft };
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value: proposedValue });
        this.editing = false;
        this.$emit("updated", data);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.review.toast.edited") });
        return true;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
        return false;
      } finally {
        this.saving = false;
      }
    },
    async openFullEditor() {
      if (this.draft !== editableText(this.proposal) && !(await this.saveEdit())) return;
      this.$router.push({ name: "EnrichmentProposalEditor", params: { proposalId: String(this.proposal.id) } });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.proposal-panel {
  padding: var(--space-8);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);

  // A phone has the drawer's padding around the card already: the text keeps the width.
  @include max-tablet {
    padding: var(--space-5);
  }
}
.proposal-panel__field {
  font-size: var(--fs-400);
  font-weight: 600;
  color: var(--text-strong);
}
.proposal-panel__cost {
  margin-left: auto;
}
.proposal-panel__full {
  margin-left: auto;
}
.proposal-panel__studio {
  align-self: flex-start;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
.proposal-panel__source {
  padding: var(--space-5);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  font-size: var(--fs-300);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
