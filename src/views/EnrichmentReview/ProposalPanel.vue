<template>
  <article class="proposal-panel flex-column gap-5" :data-testid="`proposal-panel-${proposal.id}`">
    <header class="flex ai-ct flex-wrap gap-3">
      <h3 class="proposal-panel__field m-0" data-testid="proposal-field">{{ fieldName }}</h3>
      <Tag v-if="language" :label="language.toUpperCase()" data-testid="proposal-language" />
      <StatusBadge v-if="proposal.status !== 'pending'" :label="$t(`enrichment.status.${proposal.status}`)" size="sm" />
      <span class="proposal-panel__cost flex ai-ct gap-2">
        <CostLabel :cost="proposal.cost_usd" data-testid="proposal-cost" />
        <BasicTooltip :text="metaLine">
          <span class="proposal-panel__details-icon t-muted" tabindex="0" :aria-label="metaLine" data-testid="proposal-meta">
            <FontAwesomeIcon :icon="$icons.info" aria-hidden="true" />
          </span>
        </BasicTooltip>
      </span>
    </header>

    <div v-if="sourceLanguage" class="flex-column gap-2" data-testid="proposal-source">
      <span class="fs-200 fw-600 t-secondary">{{ $t("enrichment.review.source_value", { language: sourceLanguage.toUpperCase() }) }}</span>
      <div v-if="sourceIsHtml" class="proposal-panel__source" v-html="sanitizeHtml(source)" />
      <p v-else class="proposal-panel__source m-0">{{ source || "—" }}</p>
    </div>

    <FormField v-if="editing" :label="$t('enrichment.review.edit_label')">
      <BasicTextarea v-model="draft" :rows="8" data-testid="proposal-edit-text" />
      <LengthCounter v-if="rules" :length="draftLength" :rules="rules" />
    </FormField>
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

    <QaWarnings :proposal="proposal" @updated="(p) => $emit('updated', p)" @busy="(value) => (qaBusy = value)" />
    <ProfileUsageNote :proposal="proposal" :task="task" />

    <ProposalCorrection
      v-if="correctable"
      v-show="!editing"
      :proposal="proposal"
      :task="task"
      :selection="selection"
      @updated="(p) => $emit('updated', p)"
      @busy="(value) => (correctionBusy = value)"
    />

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
import ProfileUsageNote from "./ProfileUsageNote.vue";
import ProposalCorrection from "./ProposalCorrection.vue";
import QaWarnings from "./QaWarnings.vue";
import { revisable, uniqueFragment, valueText } from "./correction";
import { useFieldLabels } from "./useFieldLabels";
import { editableText, isHtml, plainText, sourceText, textRules, translationSource, workerOf } from "./reviewLogic";

const ACTIONABLE = ["pending", "drifted"];

// One proposal as a card: the field by its PIM name and the language, the change (DiffRenderer), Apply / Edit /
// Reject. A translation shows its source text; a meta description its search preview. What its AI call cost sits in
// the header; the worker and kind sit behind the info icon. Its QA warnings (with "Check against the standard" and
// "Fix warnings") and what the AI used from the company profile sit under the text. `product` is the product on
// screen, else it is fetched when the view needs it. A pending text or select proposal carries its correction tools
// (ProposalCorrection); a selection in the text narrows them.
export default {
  name: "ProposalPanel",
  components: { CostLabel, DiffRenderer, LengthCounter, ProfileUsageNote, ProposalCorrection, QaWarnings },
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
    return { editing: false, draft: "", saving: false, loaded: null, selection: "", correctionBusy: false, qaBusy: false };
  },
  computed: {
    locator() {
      return this.proposal.target_locator || {};
    },
    language() {
      return this.locator.language || "";
    },
    fieldName() {
      return this.proposalField(this.proposal);
    },
    metaLine() {
      const p = this.proposal;
      const confidence = p.confidence != null ? `${Math.round(Number(p.confidence) * 100)}%` : "";
      return [workerOf(p.source) || p.source, p.target_kind, confidence].filter(Boolean).join(" · ");
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
    snippet() {
      if (!this.rules?.snippet) return null;
      const urlKey = this.productData?.url_key_t9n?.[this.language] || this.productData?.url_key || "";
      return { title: this.productName, url: urlKey ? `/${urlKey}` : "" };
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
    draftLength() {
      return plainText(this.draft).trim().length;
    },
    actions() {
      const off = this.busy || this.saving || this.correctionBusy || this.qaBusy;
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
    async saveEdit() {
      this.saving = true;
      try {
        const proposedValue = { ...this.proposal.proposed_value, text: this.draft };
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value: proposedValue });
        this.editing = false;
        this.$emit("updated", data);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.review.toast.edited") });
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.saving = false;
      }
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
.proposal-panel__details-icon {
  display: inline-flex;
  padding: var(--space-1);
  border-radius: var(--radius-full);
  cursor: help;
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
