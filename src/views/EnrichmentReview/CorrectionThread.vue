<template>
  <div class="correction-thread flex-column gap-3" data-testid="correction-thread">
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

    <ol class="correction-thread__list m-0" :aria-label="$t('enrichment.thread.label')">
      <template v-for="turn in visibleTurns" :key="turn.number">
        <li v-if="turn.ask" class="correction-thread__ask" :data-testid="`thread-ask-${turn.number}`">
          <CorrectionAsk :ask="turn.ask" />
        </li>
        <li class="correction-thread__bubble flex-column" :data-testid="`version-${turn.number}`">
          <div class="correction-thread__head flex ai-ct flex-wrap gap-2 rg-1">
            <FontAwesomeIcon
              :icon="$icons[ICONS[turn.author]]"
              class="correction-thread__icon"
              :class="`correction-thread__icon--${turn.author}`"
              aria-hidden="true"
            />
            <span class="correction-thread__title" data-testid="version-author">{{ turn.title }}</span>
            <StatusBadge v-if="turn.current" :label="$t('enrichment.versions.current')" tone="accent" size="sm" />
            <span class="correction-thread__meta fs-200 t-muted">
              <CostLabel v-if="turn.author === 'ai'" :cost="turn.revision.cost_usd" />
              <span v-if="turn.author === 'ai'" aria-hidden="true">·</span>
              <span>{{ relative(turn.revision.created_at) }}</span>
            </span>
          </div>
          <p v-if="turn.previous && unchanged(turn)" class="correction-thread__note m-0" data-testid="version-unchanged">
            <FontAwesomeIcon :icon="$icons.info" class="correction-thread__note-icon" aria-hidden="true" />
            {{ $t("enrichment.thread.unchanged") }}
          </p>
          <div v-else-if="turn.previous && isOpen(turn.number)" class="correction-thread__diff">
            <TextDiff :before="valueText(turn.previous.value)" :after="valueText(turn.revision.value)" :switchable="false" />
          </div>
          <p v-else class="correction-thread__text m-0" data-testid="version-text">{{ valueText(turn.revision.value) }}</p>
          <div v-if="hasActions(turn)" class="correction-thread__actions flex ai-ct flex-wrap gap-1">
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
        </li>
      </template>

      <li v-if="asking" class="correction-thread__ask" data-testid="thread-asking">
        <CorrectionAsk :ask="asking" />
      </li>
      <li v-if="asking" class="correction-thread__bubble flex-column" role="status" data-testid="correction-busy">
        <span class="correction-thread__typing flex ai-ct gap-2">
          <FontAwesomeIcon :icon="$icons.enrich" class="correction-thread__icon correction-thread__icon--ai" aria-hidden="true" />
          {{ $t("enrichment.thread.writing") }}
          <span class="correction-thread__dots" aria-hidden="true"><i /><i /><i /></span>
        </span>
        <span class="fs-200 t-muted">{{ $t("enrichment.correct.busy") }}</span>
      </li>

      <li v-if="candidates.length">
        <VariantPicker
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
const ICONS = { ai: "enrich", user: "author", restore: "history" };

// The versions of a proposal as a conversation, newest at the bottom: each AI correction is the operator's request
// (a tinted right-hand bubble: the quick action by its label, their own words, the fragment it was narrowed to) and the
// AI's answer (a neutral left-hand bubble: who by its icon, version, cost, time, "Show changes" against the version
// before); a manual edit and a restore are a turn of their own. `asking` adds the request in flight with a "writing" turn, `candidates` the variants to pick from.
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
    return { ICONS };
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
.correction-thread__earlier {
  align-self: center;
}
// A request and its answer read as one exchange: close together, the exchanges further apart.
.correction-thread__list {
  list-style: none;
  padding: 0;

  > li + li {
    margin-top: var(--space-5);
  }

  > .correction-thread__ask + li {
    margin-top: var(--space-2);
  }
}
.correction-thread__ask {
  display: flex;
  justify-content: flex-end;
}
// The AI's answer (and your edits) in a quiet left-hand bubble, its tail corner at the top: who and when on one line,
// the text of that version — or, opened, what it changed against the one before — and its actions under it.
.correction-thread__bubble {
  min-width: 0;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  border-top-left-radius: var(--radius-base);
  background: var(--surface-raised);
}
.correction-thread__icon {
  font-size: var(--fs-200);
  color: var(--text-muted);
}
.correction-thread__icon--ai {
  color: var(--accent);
}
.correction-thread__title {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
.correction-thread__meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
}
// The version's own text, three lines at most: "Show changes" opens it in full against the one before.
.correction-thread__text {
  display: -webkit-box;
  max-width: 68ch;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
  white-space: pre-wrap;
  word-break: break-word;
}
.correction-thread__note {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--fs-250);
  line-height: 1.5;
  color: var(--text-secondary);
}
.correction-thread__note-icon {
  color: var(--warning);
}
// Ghost buttons flush with the text: their own padding moves out to the bubble's edge.
.correction-thread__actions {
  margin-left: calc(-1 * var(--space-3));
}
.correction-thread__diff {
  max-height: 18rem;
  overflow-y: auto;
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
