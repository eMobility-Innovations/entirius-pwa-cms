<template>
  <div class="text-artifact flex-column gap-5" data-testid="text-artifact">
    <div class="text-artifact__body" data-testid="text-artifact-body" v-html="sanitizeHtml(html)" />

    <ul v-if="warnings.length" class="text-artifact__warnings m-0 flex-column gap-2" data-testid="text-artifact-warnings">
      <li v-for="(warning, index) in warnings" :key="index" class="flex gap-2">
        <FontAwesomeIcon :icon="$icons.warning" class="text-artifact__warning-icon" aria-hidden="true" />
        <span>{{ warning.message }}</span>
      </li>
    </ul>

    <ProposalCorrection v-if="correctable" :proposal="proposal" @updated="(p) => $emit('updated', p)" @busy="(b) => $emit('busy', b)" />
  </div>
</template>

<script>
import { marked } from "marked";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import ProposalCorrection from "@/views/EnrichmentReview/ProposalCorrection.vue";
import { revisable } from "@/views/EnrichmentReview/correction";

// A text step (outline, draft) as the proposal card of the review: the text as it reads, the quality warnings, and
// the correction tools — Correct with AI, Versions, the full-screen editor.
export default {
  name: "TextArtifact",
  components: { ProposalCorrection },
  props: {
    proposal: { type: Object, required: true },
  },
  emits: ["updated", "busy"],
  methods: { sanitizeHtml },
  computed: {
    html() {
      return marked.parse(this.proposal.proposed_value?.text || "");
    },
    warnings() {
      return this.proposal.warnings || [];
    },
    correctable() {
      return revisable(this.proposal);
    },
  },
};
</script>

<style lang="scss" scoped>
.text-artifact__body {
  line-height: 1.7;
  word-break: break-word;
  color: var(--text-body);
}
.text-artifact__warnings {
  list-style: none;
  padding: var(--space-4);
  border-radius: var(--radius-base);
  background: var(--warning-subtle);
  color: var(--text-strong);
}
.text-artifact__warning-icon {
  color: var(--warning);
  margin-top: 3px;
}
</style>
