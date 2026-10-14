<template>
  <div class="proposal-correction flex-column gap-4" data-testid="proposal-correction">
    <ReadonlyOff>
      <div class="flex ai-ct flex-wrap gap-3">
        <BasicButton
          size="sm"
          variant="ghost"
          :aria-expanded="String(correcting)"
          data-testid="correction-toggle"
          @click="correcting = !correcting"
        >
          <FontAwesomeIcon :icon="$icons.enrich" class="mr-2" aria-hidden="true" />
          {{ $t("enrichment.correct.open") }}
          <CountBadge v-if="rules.length" :count="rules.length" class="ml-2" />
        </BasicButton>
        <BasicButton
          size="sm"
          variant="ghost"
          :aria-expanded="String(showVersions)"
          data-testid="versions-toggle"
          @click="toggleVersions"
        >
          <FontAwesomeIcon :icon="$icons.history" class="mr-2" aria-hidden="true" />
          {{ $t("enrichment.versions.title") }}
        </BasicButton>
        <router-link v-if="shape === 'text'" :to="editorLink" class="proposal-correction__editor fs-300 t-accent fw-600" data-testid="open-editor">
          {{ $t("enrichment.editor.open") }}
        </router-link>
      </div>
    </ReadonlyOff>

    <template v-if="correcting">
      <CorrectionBar ref="bar" :shape="shape" :selection="selection" :busy="busy" @submit="correct" />
      <VariantPicker v-if="candidates.length" :candidates="candidates" :busy="busy" @pick="pick" @cancel="candidates = []" />
      <RuleChips
        :rules="rules"
        :busy="busy"
        :has-template="!!task?.params?.template"
        :has-worker="hasWorker"
        @change="setRules"
        @promote="promote"
      />
    </template>

    <template v-if="showVersions">
      <Loader v-if="!revisions" />
      <VersionTimeline v-else :revisions="revisions" :busy="busy" @restore="restore" />
    </template>
  </div>
</template>

<script>
import { toRef } from "vue";
import { ReadonlyOff } from "@/composables/useReadonly";
import CorrectionBar from "./CorrectionBar.vue";
import RuleChips from "./RuleChips.vue";
import VariantPicker from "./VariantPicker.vue";
import VersionTimeline from "./VersionTimeline.vue";
import { useProposalCorrection } from "./useProposalCorrection";
import { valueShape } from "./correction";
import { workerOf } from "./reviewLogic";

// The correction tools under a pending proposal card: "Correct with AI" (the bar, the 3 variants to pick from and
// the rules), "Versions" (v1…vN with restore) and, for text, the full-screen editor. `selection` is the fragment the
// operator selected in the card's text view. Every new value goes up as `updated` with the proposal.
export default {
  name: "ProposalCorrection",
  components: { ReadonlyOff, CorrectionBar, RuleChips, VariantPicker, VersionTimeline },
  props: {
    proposal: { type: Object, required: true },
    task: { type: Object, default: null },
    selection: { type: String, default: "" },
  },
  emits: ["updated", "busy"],
  setup(props, { emit }) {
    return useProposalCorrection(toRef(props, "proposal"), (proposal) => emit("updated", proposal));
  },
  data() {
    return { correcting: false, showVersions: false };
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
  },
  watch: {
    busy(value) {
      this.$emit("busy", value);
    },
  },
  methods: {
    toggleVersions() {
      this.showVersions = !this.showVersions;
      if (this.showVersions) this.loadVersions();
    },
    async correct(request) {
      if (await this.revise(request)) this.$refs.bar?.reset();
    },
    pick(candidate) {
      return this.saveValue(candidate);
    },
  },
};
</script>

<style lang="scss" scoped>
.proposal-correction__editor {
  margin-left: auto;
}
</style>
