<template>
  <div v-if="!readonly" class="correction-bar flex-column gap-3" data-testid="correction-bar">
    <div
      v-if="quickActions.length"
      class="correction-bar__chips"
      role="group"
      :aria-label="$t('enrichment.correct.suggestions')"
    >
      <FilterChip
        v-for="action in quickActions"
        :key="action"
        :label="$t(`enrichment.correct.quick.${action}`)"
        :active="picked === action"
        :aria-pressed="batch ? String(picked === action) : undefined"
        :disabled="busy"
        :data-testid="`correction-quick-${action}`"
        @click="onChip(action)"
      />
    </div>

    <div v-if="selection && !batch" class="flex ai-ct flex-wrap gap-3 rg-2" data-testid="correction-scope">
      <SegmentedControl v-model="scope" :options="scopeOptions" :disabled="busy" />
      <span v-if="scope === 'selection'" class="correction-bar__excerpt fs-200 t-secondary" :title="selection">
        “{{ excerpt }}”
      </span>
    </div>

    <div class="correction-bar__box" :class="{ 'correction-bar__box--busy': busy }">
      <BasicTextarea
        v-model="instruction"
        class="correction-bar__input"
        autogrow
        :rows="1"
        :placeholder="$t(batch ? 'enrichment.correct.batch_placeholder' : 'enrichment.correct.instruction_placeholder')"
        :aria-label="$t('enrichment.correct.instruction')"
        :disabled="busy"
        data-testid="correction-instruction"
        @keydown="onKeydown"
      />
      <IconButton
        v-if="!batch"
        class="correction-bar__send"
        icon="send"
        variant="primary"
        mutates
        :label="$t('enrichment.correct.send')"
        :disabled="busy || !instruction.trim()"
        data-testid="correction-send"
        @click="submit(null)"
      />
    </div>
    <span v-if="!batch" class="correction-bar__hint fs-200 t-muted">{{ $t("enrichment.correct.enter_hint") }}</span>

    <p v-if="busy && batch" class="flex ai-ct gap-3 fs-300 t-secondary m-0" role="status" data-testid="correction-busy">
      {{ $t("enrichment.correct.busy") }}
    </p>
  </div>
</template>

<script>
import FilterChip from "@/boots/FilterChip/index.vue";
import { useReadonly } from "@/composables/useReadonly";
import { quickActionsFor } from "./correction";

const EXCERPT = 60;

// The composer of a correction (of one proposal, or of a whole task with `batch`): the quick actions as suggestion
// chips above a growing text box with a send button — Enter sends, Shift+Enter breaks the line. A chip asks for that
// action alone (what is typed stays for the next message); in a batch a chip is picked instead and the caller's
// footer sends (`draft` reports the request as it changes). A selection in the text narrows the scope. It only asks —
// `submit` carries { instruction, quickAction, selection }; the caller calls the API and sets `busy`.
export default {
  name: "CorrectionBar",
  components: { FilterChip },
  props: {
    shape: { type: String, default: "text" },
    batch: { type: Boolean, default: false },
    selection: { type: String, default: "" },
    busy: { type: Boolean, default: false },
  },
  emits: ["submit", "draft"],
  setup() {
    return { readonly: useReadonly() };
  },
  data() {
    return { instruction: "", scope: "all", picked: null };
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
    request() {
      const selection = this.scope === "selection" && !this.batch ? this.selection : "";
      return { instruction: this.instruction, quickAction: this.picked, selection };
    },
  },
  watch: {
    // A new selection is what the operator wants to change; none left → the whole text again.
    selection(text) {
      this.scope = text ? "selection" : "all";
    },
    request: {
      immediate: true,
      handler(request) {
        if (this.batch) this.$emit("draft", { ...request, ready: !!(request.quickAction || request.instruction.trim()) });
      },
    },
  },
  methods: {
    onChip(action) {
      if (this.batch) this.picked = this.picked === action ? null : action;
      else this.ask({ ...this.request, instruction: "", quickAction: action });
    },
    onKeydown(event) {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      this.submit(this.picked);
    },
    submit(quickAction) {
      this.ask({ ...this.request, quickAction });
    },
    ask(request) {
      if (this.busy || (!request.quickAction && !request.instruction.trim())) return;
      this.$emit("submit", request);
    },
    // The caller clears the instruction once the correction landed.
    reset() {
      this.instruction = "";
      this.picked = null;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// Suggestions wrap on a wide screen; on a phone they are one row that scrolls sideways.
// The row fades out at its right edge on a phone, so the chips cut there read as "more this way".
.correction-bar__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);

  @include max-tablet {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-block: var(--space-1);
    padding-right: var(--space-8);
    scrollbar-width: none;
    mask-image: linear-gradient(to right, var(--surface-base) calc(100% - var(--space-8)), transparent);
  }
}
// Suggestions are no filter and no primary: a quiet raised chip in secondary text, so they never out-shout the thread
// or the send button; a picked one (batch) keeps the boot's accent fill. Disabled while the AI works.
.correction-bar__chips :deep(.filter-chip) {
  flex-shrink: 0;
  font-family: inherit;

  &:not(.filter-chip--active) {
    border-color: var(--border-subtle);
    background-color: var(--surface-raised);
    color: var(--text-secondary);
  }

  &:not(.filter-chip--active):hover:not(:disabled) {
    background-color: var(--surface-hover);
    color: var(--text-body);
  }

  &:disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
  }
}
.correction-bar__excerpt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.correction-bar__box {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-lg);
  background: var(--surface-sunken);
  transition: border-color 0.15s ease;

  // The field's own focus ring moves to the box (as the text fields draw it, src/assets/scss/utils/_reset.scss).
  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 calc(var(--space-1) / 2) color-mix(in srgb, var(--accent) 30%, transparent);
  }
}
.correction-bar__box--busy {
  background: var(--surface-disabled);
}
.correction-bar__input {
  flex: 1;
  min-width: 0;

  // The box draws the frame; the text area is bare inside it and grows to four lines, then scrolls.
  :deep(.basic-textarea__field) {
    min-height: 0;
    max-height: calc(4 * 1.5em + 2 * var(--space-2));
    padding: var(--space-2) 0;
    border: 0;
    background: transparent;
    font-size: var(--fs-300);
    line-height: 1.5;
    resize: none;
    box-shadow: none;
  }
}
// The keys show while typing, on a keyboard screen only: a phone keyboard has no Shift+Enter, the send button is the way
// there.
.correction-bar__hint {
  display: none;
  align-self: flex-end;
  margin-top: calc(-1 * var(--space-1));
}
@include min-tablet {
  .correction-bar__box:focus-within + .correction-bar__hint {
    display: inline;
  }
}
</style>
