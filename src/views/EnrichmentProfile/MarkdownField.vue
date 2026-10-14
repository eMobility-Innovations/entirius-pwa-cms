<template>
  <div class="markdown-field flex-column gap-2" :data-testid="testid">
    <ReadonlyOff>
      <SegmentedControl v-model="view" :options="viewOptions" class="markdown-field__switch" />
    </ReadonlyOff>
    <div
      v-if="view === 'preview'"
      class="markdown-field__preview"
      :data-testid="`${testid}-preview`"
      v-html="sanitizeHtml(html)"
    />
    <BasicTextarea
      v-else
      :model-value="modelValue"
      :rows="8"
      :maxlength="20000"
      :data-testid="`${testid}-text`"
      @update:model-value="(text) => $emit('update:modelValue', text)"
    />
  </div>
</template>

<script>
import { marked } from "marked";
import { ReadonlyOff } from "@/composables/useReadonly";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

// A profile text in markdown: "Write" is the textarea, "Preview" shows how it reads (sanitised).
export default {
  name: "MarkdownField",
  components: { ReadonlyOff },
  props: {
    modelValue: { type: String, default: "" },
    testid: { type: String, default: "markdown-field" },
  },
  emits: ["update:modelValue"],
  data() {
    return { view: "write" };
  },
  computed: {
    viewOptions() {
      return [
        { value: "write", label: this.$t("enrichment.profile.write") },
        { value: "preview", label: this.$t("enrichment.profile.preview") },
      ];
    },
    html() {
      return marked.parse(this.modelValue || "");
    },
  },
  methods: { sanitizeHtml },
};
</script>

<style lang="scss" scoped>
.markdown-field__switch {
  align-self: flex-start;
}
.markdown-field__preview {
  min-height: var(--space-16);
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  font-size: var(--fs-300);
  line-height: 1.6;
  overflow-wrap: break-word;
}
</style>
