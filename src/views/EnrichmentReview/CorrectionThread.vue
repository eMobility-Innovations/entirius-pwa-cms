<template>
  <div class="correction-thread flex-column gap-4" data-testid="correction-thread">
    <BasicButton
      v-if="hiddenCount"
      class="correction-thread__earlier"
      size="sm"
      variant="ghost"
      icon="history"
      data-testid="thread-earlier"
      @click="showAll = true"
    >
      {{ $t("enrichment.thread.earlier", { count: hiddenCount }) }}
    </BasicButton>

    <ol class="correction-thread__list flex-column gap-4 m-0" :aria-label="$t('enrichment.thread.label')">
      <template v-for="turn in visibleTurns" :key="turn.number">
        <li v-if="turn.ask" class="correction-thread__ask" :data-testid="`thread-ask-${turn.number}`">
          <CorrectionAsk :ask="turn.ask" />
        </li>
        <li class="correction-thread__turn flex gap-3" :data-testid="`version-${turn.number}`">
          <span class="correction-thread__avatar" :class="`correction-thread__avatar--${turn.author}`" aria-hidden="true">
            <FontAwesomeIcon :icon="$icons[AVATARS[turn.author]]" />
          </span>
          <div class="correction-thread__bubble flex-column" :class="{ 'correction-thread__bubble--current': turn.current }">
            <div class="correction-thread__head flex ai-ct flex-wrap gap-3 rg-1">
              <span class="correction-thread__title" data-testid="version-author">{{ turn.title }}</span>
              <StatusBadge v-if="turn.current" :label="$t('enrichment.versions.current')" tone="accent" size="sm" />
              <span class="correction-thread__meta fs-200 t-muted">
                <CostLabel v-if="turn.author === 'ai'" :cost="turn.revision.cost_usd" />
                <span v-if="turn.author === 'ai'" aria-hidden="true">·</span>
                <span>{{ relative(turn.revision.created_at) }}</span>
              </span>
            </div>
            <p v-if="turn.previous && unchanged(turn)" class="correction-thread__note m-0" data-testid="version-unchanged">
              <FontAwesomeIcon :icon="$icons.info" aria-hidden="true" />
              {{ $t("enrichment.thread.unchanged") }}
            </p>
            <div v-else-if="turn.previous && isOpen(turn.number)" class="correction-thread__diff">
              <TextDiff :before="valueText(turn.previous.value)" :after="valueText(turn.revision.value)" :switchable="false" />
            </div>
            <p v-else class="correction-thread__text m-0" data-testid="version-text">{{ valueText(turn.revision.value) }}</p>
            <div v-if="hasActions(turn)" class="correction-thread__actions flex ai-ct flex-wrap gap-2">
              <BasicButton
                v-if="turn.previous && !unchanged(turn)"
                size="sm"
                variant="ghost"
                :icon="isOpen(turn.number) ? 'hide' : 'preview'"
                :aria-expanded="String(isOpen(turn.number))"
                :data-testid="`version-toggle-${turn.number}`"
                @click="toggle(turn.number)"
              >
                {{ isOpen(turn.number) ? $t("enrichment.versions.hide_changes") : $t("enrichment.versions.show_changes") }}
              </BasicButton>
              <BasicButton
                v-if="undoable(turn)"
                size="sm"
                variant="ghost"
                icon="history"
                mutates
                :disabled="busy"
                :data-testid="`version-undo-${turn.number}`"
                @click="$emit('restore', turn.previous.number)"
              >
                {{ $t("enrichment.thread.undo") }}
              </BasicButton>
              <BasicButton
                v-if="!turn.current && restorable"
                size="sm"
                variant="ghost"
                icon="history"
                mutates
                :disabled="busy"
                :data-testid="`version-restore-${turn.number}`"
                @click="$emit('restore', turn.number)"
              >
                {{ $t("enrichment.versions.restore") }}
              </BasicButton>
            </div>
          </div>
        </li>
      </template>

      <li v-if="asking" class="correction-thread__ask" data-testid="thread-asking">
        <CorrectionAsk :ask="asking" />
      </li>
      <li v-if="asking" class="correction-thread__turn flex gap-3" role="status" data-testid="correction-busy">
        <span class="correction-thread__avatar correction-thread__avatar--ai" aria-hidden="true">
          <FontAwesomeIcon :icon="$icons.enrich" />
        </span>
        <div class="correction-thread__bubble flex-column gap-1">
          <span class="correction-thread__typing flex ai-ct gap-2">
            {{ $t("enrichment.thread.writing") }}
            <span class="correction-thread__dots" aria-hidden="true"><i /><i /><i /></span>
          </span>
          <span class="fs-200 t-muted">{{ $t("enrichment.correct.busy") }}</span>
        </div>
      </li>

      <li v-if="candidates.length" class="correction-thread__turn flex gap-3">
        <span class="correction-thread__avatar correction-thread__avatar--ai" aria-hidden="true">
          <FontAwesomeIcon :icon="$icons.enrich" />
        </span>
        <VariantPicker
          class="correction-thread__variants"
          :candidates="candidates"
          :busy="busy"
          @pick="(candidate) => $emit('pick', candidate)"
          @cancel="$emit('dismiss')"
        />
      </li>
    </ol>
  </div>
</template>

<script>
import { formatRelative } from "@/utils/format";
import CorrectionAsk from "./CorrectionAsk.vue";
import CostLabel from "./CostLabel.vue";
import TextDiff from "./TextDiff.vue";
import VariantPicker from "./VariantPicker.vue";
import { LATEST } from "./useProposalCorrection";
import { valueText, versionInfo } from "./correction";

const RECENT = 4;
const AVATARS = { ai: "enrich", user: "author", restore: "history" };

// The versions of a proposal as a conversation, newest at the bottom: each AI correction is the operator's request
// (a right-hand bubble: the quick action by its label, their own words, the fragment it was narrowed to) and the AI's
// answer (version, cost, time, "Show changes" against the version before); a manual edit and a restore are a turn of
// their own. `asking` adds the request in flight with a "writing" turn, `candidates` the variants to pick from.
// `landed` (a version number or LATEST) opens that version's changes and offers Undo — a restore of the one before.
// Only the last few turns show until "Show earlier".
export default {
  name: "CorrectionThread",
  components: { CorrectionAsk, CostLabel, TextDiff, VariantPicker },
  props: {
    revisions: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    restorable: { type: Boolean, default: true },
    asking: { type: Object, default: null },
    candidates: { type: Array, default: () => [] },
    landed: { type: [Number, String], default: null },
  },
  emits: ["restore", "pick", "dismiss"],
  setup() {
    return { AVATARS };
  },
  data() {
    return { open: {}, showAll: false };
  },
  computed: {
    turns() {
      const last = this.revisions.length - 1;
      return this.revisions.map((revision, index) => this.turnOf(revision, index, index === last));
    },
    hiddenCount() {
      return this.showAll ? 0 : Math.max(0, this.turns.length - RECENT);
    },
    visibleTurns() {
      return this.turns.slice(this.hiddenCount);
    },
    landedNumber() {
      if (this.landed !== LATEST) return this.landed;
      return this.revisions.at(-1)?.number ?? null;
    },
  },
  watch: {
    // A version that just landed shows what it changed; the older answers fold back.
    landedNumber: {
      immediate: true,
      handler(number) {
        if (number != null) this.open = { [number]: true };
      },
    },
  },
  methods: {
    valueText,
    turnOf(revision, index, current) {
      const info = versionInfo(revision);
      const ask = info.author === "ai" && index > 0 && (info.quickAction || info.instruction) ? info : null;
      return { number: revision.number, revision, author: info.author, title: this.titleOf(info, revision, index),
        ask, current, previous: this.revisions[index - 1] || null };
    },
    titleOf(info, revision, index) {
      if (info.author === "restore") return this.$t("enrichment.thread.restored", { number: info.restoredFrom });
      if (info.author === "user") return this.$t("enrichment.thread.your_edit", { number: revision.number });
      if (index === 0) return this.$t("enrichment.thread.first_draft");
      return this.$t("enrichment.thread.version", { number: revision.number });
    },
    unchanged(turn) {
      return valueText(turn.previous.value) === valueText(turn.revision.value);
    },
    undoable(turn) {
      return turn.current && turn.number === this.landedNumber && !!turn.previous && this.restorable;
    },
    hasActions(turn) {
      return (turn.previous && !this.unchanged(turn)) || this.undoable(turn) || (!turn.current && this.restorable);
    },
    isOpen(number) {
      return !!this.open[number];
    },
    toggle(number) {
      this.open = { ...this.open, [number]: !this.open[number] };
    },
    relative(iso) {
      return formatRelative(iso);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.correction-thread__earlier {
  align-self: center;
}
.correction-thread__list {
  list-style: none;
  padding: 0;
}
.correction-thread__ask {
  display: flex;
  justify-content: flex-end;
}
.correction-thread__turn {
  align-items: flex-start;
  min-width: 0;
}
.correction-thread__avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  font-size: var(--fs-200);
  color: var(--text-secondary);
  background: var(--surface-raised);
}
// A phone gives the bubbles the full width.
@include max-tablet {
  .correction-thread__turn > .correction-thread__avatar {
    display: none;
  }
}
.correction-thread__avatar--ai {
  color: var(--accent);
  background: var(--accent-subtle);
}
// The AI's answer (and your edits) in a bubble: who and when, the text of that version — or, opened, what it changed
// against the one before — and its actions in a footer. The current version carries the accent edge.
.correction-thread__bubble {
  flex: 1;
  min-width: 0;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  border-top-left-radius: var(--radius-base);
  background: var(--surface-base);
}
.correction-thread__bubble--current {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border-subtle));
  border-left: var(--space-1) solid var(--accent);
}
.correction-thread__variants {
  flex: 1;
  min-width: 0;
}
.correction-thread__title {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
.correction-thread__meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  white-space: nowrap;
}
// The version's own text, three lines at most: "Show changes" opens it in full against the one before.
.correction-thread__text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  font-size: var(--fs-300);
  line-height: 1.55;
  color: var(--text-body);
  white-space: pre-wrap;
  word-break: break-word;
}
.correction-thread__note {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-base);
  background: var(--warning-subtle);
  font-size: var(--fs-200);
  color: var(--text-body);
}
// The answer's actions: a footer under a hairline, flush with the text.
.correction-thread__actions {
  margin: 0 calc(-1 * var(--space-3)) calc(-1 * var(--space-2));
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}
.correction-thread__diff {
  max-height: 18rem;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-base);
  background: var(--surface-sunken);
}
.correction-thread__typing {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
.correction-thread__dots {
  display: inline-flex;
  gap: 3px;

  i {
    width: 5px;
    height: 5px;
    border-radius: var(--radius-full);
    background: var(--accent);
    animation: correction-thread-dot 1.2s infinite ease-in-out;
  }

  i:nth-child(2) {
    animation-delay: 0.15s;
  }

  i:nth-child(3) {
    animation-delay: 0.3s;
  }

  @media (prefers-reduced-motion: reduce) {
    i {
      animation: none;
    }
  }
}

@keyframes correction-thread-dot {
  0%,
  80%,
  100% {
    opacity: 0.25;
  }

  40% {
    opacity: 1;
  }
}
</style>
