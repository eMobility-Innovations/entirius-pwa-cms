<template>
  <div class="proposal-correction flex-column gap-4" data-testid="proposal-correction">
    <div class="proposal-correction__tools flex ai-ct flex-wrap gap-3">
      <slot name="lead" />
      <ReadonlyOff>
        <BasicButton
          :size="size"
          variant="ghost"
          icon="enrich"
          :aria-expanded="String(open)"
          data-testid="correction-toggle"
          @click="toggle"
        >
          {{ $t("enrichment.correct.open") }}
          <CountBadge v-if="corrections" :count="corrections" class="ml-2" />
        </BasicButton>
        <router-link v-if="editor && shape === 'text'" :to="editorLink" class="proposal-correction__editor" data-testid="open-editor">
          <FontAwesomeIcon :icon="$icons.edit" aria-hidden="true" />
          {{ $t("enrichment.editor.open") }}
        </router-link>
      </ReadonlyOff>
      <slot name="trail" />
    </div>

    <section v-if="open" class="proposal-correction__chat flex-column" :aria-label="$t('enrichment.correct.open')">
      <Loader v-if="!revisions" :size="32" />
      <CorrectionThread
        v-else
        :revisions="revisions"
        :busy="busy"
        :asking="asking"
        :candidates="candidates"
        :landed="landed"
        @restore="restore"
        @pick="saveValue"
        @dismiss="candidates = []"
      />
      <CorrectionBar ref="bar" :shape="shape" :selection="selection" :busy="busy" @submit="correct" />
      <RuleChips
        :rules="rules"
        :busy="busy"
        :has-template="!!task?.params?.template"
        :has-worker="hasWorker"
        @change="setRules"
        @promote="promote"
      />
    </section>
  </div>
</template>

<script>
import { toRef } from "vue";
import { ReadonlyOff } from "@/composables/useReadonly";
import CorrectionBar from "./CorrectionBar.vue";
import CorrectionThread from "./CorrectionThread.vue";
import RuleChips from "./RuleChips.vue";
import { useProposalCorrection } from "./useProposalCorrection";
import { valueShape } from "./correction";
import { workerOf } from "./reviewLogic";

// The correction tools under a pending proposal card: "Refine with AI" opens a small conversation — the versions as
// a thread (each request and the AI's answer with its changes, Undo / Restore), the composer with the quick actions
// as suggestions, and the rules folded under it — and, for text, the full-screen editor. One row of ghost buttons
// (`size` sm or md), with the caller's own controls before them (`lead` slot) and after them (`trail` slot, the step
// decision in Studio). `selection` is the fragment the operator selected in the card's text view. Every new value goes
// up as `updated` with the proposal.
export default {
  name: "ProposalCorrection",
  components: { ReadonlyOff, CorrectionBar, CorrectionThread, RuleChips },
  props: {
    proposal: { type: Object, required: true },
    task: { type: Object, default: null },
    selection: { type: String, default: "" },
    size: { type: String, default: "sm" },
    // The "Open editor" link; the review card reaches the full editor from its Edit instead.
    editor: { type: Boolean, default: true },
  },
  emits: ["updated", "busy"],
  setup(props, { emit }) {
    return useProposalCorrection(toRef(props, "proposal"), (proposal) => emit("updated", proposal));
  },
  data() {
    return { open: false };
  },
  computed: {
    shape() {
      return valueShape(this.proposal.proposed_value);
    },
    rules() {
      return this.proposal.rules || [];
    },
    hasWorker() {
      return !!workerOf(this.proposal.source);
    },
    editorLink() {
      return { name: "EnrichmentProposalEditor", params: { proposalId: String(this.proposal.id) } };
    },
    // The versions after the first draft, once the thread has been opened.
    corrections() {
      return Math.max(0, (this.revisions?.length || 0) - 1);
    },
  },
  watch: {
    busy(value) {
      this.$emit("busy", value);
    },
  },
  methods: {
    toggle() {
      this.open = !this.open;
      if (this.open && !this.revisions) this.loadVersions();
    },
    async correct(request) {
      // A suggestion alone leaves what was typed for the next message.
      if ((await this.revise(request)) && request.instruction.trim()) this.$refs.bar?.reset();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.proposal-correction__editor {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--space-6);
  padding: 0 var(--space-3);
  border-radius: var(--radius-base);
  font-size: var(--fs-200);
  font-weight: 500;
  color: var(--text-body);
  text-decoration: none;

  &:hover {
    background: var(--surface-hover);
  }
}
// The conversation as one framed panel: the thread, the composer and the rules under it, apart by space (R4).
.proposal-correction__chat {
  gap: var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}

// On a phone the card is narrow already: no second frame, the bubbles and the composer take its full width.
@include max-tablet {
  .proposal-correction__chat {
    padding: 0;
    border: 0;
  }
}
</style>
