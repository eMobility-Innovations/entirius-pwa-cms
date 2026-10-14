<template>
  <div class="correction-bar flex-column gap-4" data-testid="correction-bar">
    <FormField :label="$t('enrichment.correct.instruction')">
      <BasicInput
        v-model="instruction"
        :placeholder="$t('enrichment.correct.instruction_placeholder')"
        :disabled="busy"
        :maxlength="2000"
        data-testid="correction-instruction"
        @on-key-down="submit(null)"
      />
    </FormField>

    <div v-if="selection && !batch" class="flex ai-ct flex-wrap gap-3" data-testid="correction-scope">
      <SegmentedControl v-model="scope" :options="scopeOptions" :disabled="busy" />
      <span v-if="scope === 'selection'" class="correction-bar__excerpt fs-200 t-secondary" :title="selection">
        “{{ excerpt }}”
      </span>
    </div>

    <div class="flex ai-ct flex-wrap gap-3">
      <BasicButton
        v-for="action in quickActions"
        :key="action"
        size="sm"
        mutates
        :disabled="busy"
        :data-testid="`correction-quick-${action}`"
        @click="submit(action)"
      >
        {{ $t(`enrichment.correct.quick.${action}`) }}
      </BasicButton>
      <BasicButton
        class="correction-bar__send"
        size="sm"
        mutates
        :disabled="busy || !instruction.trim()"
        data-testid="correction-send"
        @click="submit(null)"
      >
        {{ $t(batch ? "enrichment.correct.send_all" : "enrichment.correct.send") }}
      </BasicButton>
    </div>

    <p v-if="busy" class="flex ai-ct gap-3 fs-300 t-secondary m-0" role="status" data-testid="correction-busy">
      <Loader />
      {{ $t("enrichment.correct.busy") }}
    </p>
  </div>
</template>

<script>
import { quickActionsFor } from "./correction";

const EXCERPT = 60;

// The correction bar of a proposal (or of a whole task with `batch`): a free instruction, the scope (the whole text
// or the fragment selected in the text view) and the quick actions. It only asks — `submit` carries
// { instruction, quickAction, selection }; the caller calls the API and sets `busy` while the AI works.
export default {
  name: "CorrectionBar",
  props: {
    shape: { type: String, default: "text" },
    batch: { type: Boolean, default: false },
    selection: { type: String, default: "" },
    busy: { type: Boolean, default: false },
  },
  emits: ["submit"],
  data() {
    return { instruction: "", scope: "all" };
  },
  computed: {
    quickActions() {
      return quickActionsFor(this.shape, { batch: this.batch });
    },
    scopeOptions() {
      return [
        { value: "all", label: this.$t("enrichment.correct.scope_all"), testid: "correction-scope-all" },
        { value: "selection", label: this.$t("enrichment.correct.scope_selection"), testid: "correction-scope-selection" },
      ];
    },
    excerpt() {
      return this.selection.length > EXCERPT ? `${this.selection.slice(0, EXCERPT)}…` : this.selection;
    },
  },
  watch: {
    // A new selection is what the operator wants to change; none left → the whole text again.
    selection(text) {
      this.scope = text ? "selection" : "all";
    },
  },
  methods: {
    submit(quickAction) {
      if (this.busy || (!quickAction && !this.instruction.trim())) return;
      const selection = this.scope === "selection" && !this.batch ? this.selection : "";
      this.$emit("submit", { instruction: this.instruction, quickAction, selection });
    },
    // The caller clears the instruction once the correction landed.
    reset() {
      this.instruction = "";
    },
  },
};
</script>

<style lang="scss" scoped>
.correction-bar {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.correction-bar__excerpt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.correction-bar__send {
  margin-left: auto;
}
</style>
