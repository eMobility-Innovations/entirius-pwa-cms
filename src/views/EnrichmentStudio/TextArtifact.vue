<template>
  <div class="text-artifact flex-column gap-5" data-testid="text-artifact">
    <StepCallout v-if="warnings.length" tone="warning" icon="warning" data-testid="text-artifact-warnings">
      <ul class="text-artifact__warnings m-0 p-0 flex-column gap-1">
        <li v-for="(warning, index) in warnings" :key="index">{{ warning.message }}</li>
      </ul>
    </StepCallout>
    <div class="text-artifact__body" data-testid="text-artifact-body" v-html="sanitizeHtml(html)" />
  </div>
</template>

<script>
import { marked } from "marked";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import StepCallout from "./StepCallout.vue";

// A text step (outline, draft) as it reads: the quality warnings first, then the text at a reading width with its
// headings. The correction tools (Correct with AI, Versions, the editor) sit in the step panel's footer.
export default {
  name: "TextArtifact",
  components: { StepCallout },
  props: {
    proposal: { type: Object, required: true },
  },
  methods: { sanitizeHtml },
  computed: {
    html() {
      return marked.parse(this.proposal.proposed_value?.text || "");
    },
    warnings() {
      return this.proposal.warnings || [];
    },
  },
};
</script>

<style lang="scss" scoped>
.text-artifact__warnings {
  list-style: none;
}
.text-artifact__body {
  max-width: 68ch;
  line-height: 1.7;
  overflow-wrap: anywhere;
  color: var(--text-body);

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: var(--space-6) 0 var(--space-2);
    line-height: 1.3;
    font-weight: 600;
    color: var(--text-strong);
  }
  // One step under the step's own title.
  :deep(h1),
  :deep(h2) {
    font-size: var(--fs-400);
  }
  :deep(h3),
  :deep(h4) {
    font-size: var(--fs-300);
  }
  :deep(> :first-child) {
    margin-top: 0;
  }
  :deep(p),
  :deep(ul),
  :deep(ol) {
    margin: 0 0 var(--space-3);
  }
  :deep(ul),
  :deep(ol) {
    padding-left: var(--space-6);
  }
  :deep(ul) {
    list-style: disc;
  }
  :deep(ol) {
    list-style: decimal;
  }
  :deep(li + li) {
    margin-top: var(--space-1);
  }
}
</style>
