<template>
  <div class="text-diff flex-column gap-4" data-testid="text-diff">
    <span v-if="isNew" class="text-diff__label fs-200 t-secondary" data-testid="text-diff-new">
      {{ $t("enrichment.review.new_text") }}
    </span>
    <ReadonlyOff v-else-if="switchable">
      <SegmentedControl v-model="view" :options="viewOptions" class="text-diff__switch" />
    </ReadonlyOff>

    <div v-if="view === 'split' && !isNew" class="text-diff__split">
      <div v-for="pane in splitPanes" :key="pane.key" class="flex-column gap-2">
        <span class="text-diff__label fs-200 t-secondary">{{ pane.label }}</span>
        <div class="text-diff__prose" :class="{ 'text-diff__prose--plain': !html }" v-html="sanitizeHtml(pane.html)" />
      </div>
    </div>
    <div v-else class="text-diff__body" :class="{ 'text-diff__body--capped': capped }">
      <div
        class="text-diff__prose"
        :class="{ 'text-diff__prose--plain': !html }"
        data-testid="text-diff-content"
        v-html="sanitizeHtml(contentHtml)"
      />
    </div>

    <div v-if="snippet" class="flex-column gap-2">
      <span class="text-diff__label fs-200 t-secondary">{{ $t("enrichment.review.search_preview") }}</span>
      <SearchSnippet :title="snippet.text == null ? snippet.title : afterText" :url="snippet.url" :text="snippet.text ?? afterText" />
    </div>

    <div v-if="long || rules" class="flex ai-ct jc-sb flex-wrap gap-3">
      <BasicButton v-if="long" size="sm" variant="ghost" data-testid="text-diff-more" @click="expanded = !expanded">
        {{ expanded ? $t("enrichment.review.show_less") : $t("enrichment.review.show_more") }}
      </BasicButton>
      <LengthCounter v-if="rules" :length="afterText.length" :rules="rules" class="text-diff__counter" />
    </div>
  </div>
</template>

<script>
import { ReadonlyOff } from "@/composables/useReadonly";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import LengthCounter from "./LengthCounter.vue";
import SearchSnippet from "./SearchSnippet.vue";
import { htmlDiff, isBlank, isHtml, plainText, wordDiff } from "./reviewLogic";

const LONG_TEXT = 1200;
const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const WRAP = { added: "mark", removed: "del" };

// A text proposal. Empty before → the new text alone. Otherwise one flow of the changes (inserted / removed words),
// or the text before or after; side by side only where there is room (`wide`). HTML renders sanitised with real
// typography; a long text is capped behind "Show more". `rules` adds a length counter, `snippet` a search preview.
// `switchable` false keeps the changes flow alone (a correction thread's turn).
export default {
  name: "TextDiff",
  components: { ReadonlyOff, LengthCounter, SearchSnippet },
  props: {
    before: { type: [String, Number, Object, Array], default: null },
    after: { type: [String, Number, Object, Array], default: null },
    wide: { type: Boolean, default: false },
    rules: { type: Object, default: null },
    snippet: { type: Object, default: null },
    switchable: { type: Boolean, default: true },
  },
  data() {
    return { view: "changes", expanded: false };
  },
  computed: {
    html() {
      return isHtml(this.before) || isHtml(this.after);
    },
    isNew() {
      return isBlank(this.before);
    },
    afterText() {
      return plainText(this.after).trim();
    },
    long() {
      return this.afterText.length > LONG_TEXT;
    },
    capped() {
      return this.long && !this.expanded;
    },
    viewOptions() {
      const views = ["changes", "before", "after", ...(this.wide ? ["split"] : [])];
      return views.map((value) => ({
        value,
        label: this.$t(`enrichment.review.view_${value}`),
        testid: `text-diff-view-${value}`,
      }));
    },
    contentHtml() {
      if (this.isNew || this.view === "after") return this.render(this.after);
      if (this.view === "before") return this.render(this.before);
      return this.changesHtml();
    },
    splitPanes() {
      return [
        { key: "before", label: this.$t("pim.supplier.diff.before"), html: this.render(this.before) },
        { key: "after", label: this.$t("pim.supplier.diff.after"), html: this.render(this.after) },
      ];
    },
  },
  methods: {
    sanitizeHtml,
    render(value) {
      const text = value == null ? "" : String(value);
      return this.html ? sanitizeHtml(text) : escapeHtml(text);
    },
    changesHtml() {
      if (this.html) return sanitizeHtml(htmlDiff(this.render(this.before), this.render(this.after)));
      return wordDiff(this.before, this.after)
        .map(({ text, type }) => (WRAP[type] ? `<${WRAP[type]}>${escapeHtml(text)}</${WRAP[type]}>` : escapeHtml(text)))
        .join("");
    },
  },
};
</script>

<style lang="scss" scoped>
.text-diff__switch {
  align-self: flex-start;
}
.text-diff__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}
.text-diff__body--capped {
  max-height: 24rem;
  overflow: hidden;
  // Only the alpha of a mask counts: any opaque token fades the cut-off text out.
  mask-image: linear-gradient(to bottom, var(--text-strong) 75%, transparent);
}
.text-diff__counter {
  margin-left: auto;
}
.text-diff__prose {
  max-width: 70ch;
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
  word-break: break-word;

  :deep(> :first-child) {
    margin-top: 0;
  }
  :deep(> :last-child) {
    margin-bottom: 0;
  }
  :deep(p),
  :deep(ul),
  :deep(ol),
  :deep(blockquote) {
    margin: 0 0 var(--space-5);
  }
  :deep(ul),
  :deep(ol) {
    padding-left: var(--space-8);
  }
  :deep(li) {
    margin-bottom: var(--space-2);
  }
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: var(--space-8) 0 var(--space-3);
    font-size: var(--fs-400);
    line-height: 1.3;
  }
  // The global reset drops text decorations: an insertion is tinted and underlined, a deletion struck through (cues
  // that do not hang on colour). The deletion stays quiet — muted, no fill — so the new text is what reads first.
  :deep(mark) {
    background: var(--positive-subtle);
    color: var(--text-strong);
    text-decoration: underline 1px var(--positive);
    text-underline-offset: 3px;
  }
  :deep(del) {
    color: var(--text-muted);
    text-decoration: line-through 1px;
  }
}
.text-diff__prose--plain {
  white-space: pre-wrap;
}
</style>
