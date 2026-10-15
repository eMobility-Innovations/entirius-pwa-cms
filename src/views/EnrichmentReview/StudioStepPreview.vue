<template>
  <div class="studio-step-preview" data-testid="studio-step-preview">
    <QuestionsForm v-if="kind === 'questions'" :proposal="readOnly" />
    <DocumentSummary v-else-if="kind === 'document'" :proposal="readOnly" :run="NO_RUN" />
    <KeywordsTable v-else-if="kind === 'keywords'" :proposal="readOnly" />
    <MetaCards v-else-if="kind === 'meta'" :proposal="readOnly" />
    <TextArtifact v-else-if="kind === 'text'" :proposal="readOnly" />
    <dl v-else-if="fields.length" class="studio-step-preview__fields m-0" data-testid="studio-step-fields">
      <template v-for="field in fields" :key="field.key">
        <dt class="studio-step-preview__name">{{ field.label }}</dt>
        <dd class="studio-step-preview__value m-0">
          <span v-if="field.chips" class="flex flex-wrap gap-2">
            <Tag v-for="(chip, index) in field.chips" :key="index" :label="chip" />
          </span>
          <ul v-else-if="field.items" class="studio-step-preview__items m-0">
            <li v-for="(item, index) in field.items" :key="index">{{ item }}</li>
          </ul>
          <template v-else>{{ field.text }}</template>
        </dd>
      </template>
    </dl>
    <p v-else class="m-0 t-muted">{{ $t("enrichment.review.focus.step_empty") }}</p>
  </div>
</template>

<script>
import DocumentSummary from "@/views/EnrichmentStudio/DocumentSummary.vue";
import KeywordsTable from "@/views/EnrichmentStudio/KeywordsTable.vue";
import MetaCards from "@/views/EnrichmentStudio/MetaCards.vue";
import QuestionsForm from "@/views/EnrichmentStudio/QuestionsForm.vue";
import TextArtifact from "@/views/EnrichmentStudio/TextArtifact.vue";
import { artifactKind, readableFields } from "./studioStep";

// The Studio renderers edit a pending step in place; here they only read: they get the step as a non-pending one.
const READ_ONLY = "read_only";
// No run at hand: the document summary shows the facts, never the "open the draft" link.
const NO_RUN = Object.freeze({});

// A Studio step's output as the Studio shows it (search phrases, metadata, the text, the questions, the document),
// read-only; a shape the Studio has no renderer for reads as a list of its fields.
export default {
  name: "StudioStepPreview",
  components: { DocumentSummary, KeywordsTable, MetaCards, QuestionsForm, TextArtifact },
  props: {
    proposal: { type: Object, required: true },
  },
  setup() {
    return { NO_RUN };
  },
  computed: {
    kind() {
      return artifactKind(this.proposal.proposed_value);
    },
    readOnly() {
      return { ...this.proposal, status: READ_ONLY };
    },
    fields() {
      return readableFields(this.proposal.proposed_value);
    },
  },
};
</script>

<style lang="scss" scoped>
.studio-step-preview {
  min-width: 0;
  overflow-wrap: anywhere;
}
.studio-step-preview__fields {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-3) var(--space-6);
  align-items: baseline;
}
.studio-step-preview__name {
  font-size: var(--fs-250);
  font-weight: 600;
  color: var(--text-secondary);
}
.studio-step-preview__value {
  color: var(--text-body);
  line-height: 1.6;
  white-space: pre-wrap;
}
.studio-step-preview__items {
  padding-left: var(--space-6);
  list-style: disc;
  white-space: normal;
}
</style>
