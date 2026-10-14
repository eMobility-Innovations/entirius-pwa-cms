<template>
  <p v-if="!revisions.length" class="fs-200 t-muted m-0" data-testid="versions-empty">{{ $t("enrichment.versions.empty") }}</p>
  <ol v-else class="version-timeline flex-column gap-3 m-0" data-testid="version-timeline">
    <li
      v-for="(revision, index) in revisions"
      :key="revision.number"
      class="version-timeline__item flex-column gap-3"
      :class="{ 'version-timeline__item--current': isCurrent(index) }"
      :data-testid="`version-${revision.number}`"
    >
      <div class="flex ai-ct flex-wrap gap-3">
        <span class="version-timeline__number">{{ $t("enrichment.versions.number", { number: revision.number }) }}</span>
        <span class="fs-200 t-secondary" data-testid="version-author">{{ authorLabel(revision) }}</span>
        <StatusBadge v-if="isCurrent(index)" :label="$t('enrichment.versions.current')" tone="accent" size="sm" />
        <span class="version-timeline__time fs-200 t-muted">{{ relative(revision.created_at) }}</span>
      </div>
      <p v-if="info(revision).instruction" class="version-timeline__instruction fs-300 m-0" data-testid="version-instruction">
        {{ info(revision).instruction }}
      </p>
      <div class="flex ai-ct flex-wrap gap-3">
        <ReadonlyOff v-if="index > 0">
          <BasicButton
            size="sm"
            variant="ghost"
            :aria-expanded="String(open === revision.number)"
            :data-testid="`version-toggle-${revision.number}`"
            @click="toggle(revision.number)"
          >
            {{ open === revision.number ? $t("enrichment.versions.hide_changes") : $t("enrichment.versions.show_changes") }}
          </BasicButton>
        </ReadonlyOff>
        <BasicButton
          v-if="!isCurrent(index) && restorable"
          size="sm"
          mutates
          :disabled="busy"
          :data-testid="`version-restore-${revision.number}`"
          @click="$emit('restore', revision.number)"
        >
          {{ $t("enrichment.versions.restore") }}
        </BasicButton>
      </div>
      <TextDiff
        v-if="open === revision.number"
        :before="valueText(revisions[index - 1].value)"
        :after="valueText(revision.value)"
      />
    </li>
  </ol>
</template>

<script>
import { ReadonlyOff } from "@/composables/useReadonly";
import { formatRelative } from "@/utils/format";
import TextDiff from "./TextDiff.vue";
import { valueText, versionInfo } from "./correction";

// The versions of a proposal, v1 (the AI's first answer) to vN (the current value): who made each (AI, you, a
// restore) and the instruction behind it, the changes against the version before (TextDiff), and Restore — which
// adds a new version with the old value (`restore` with its number).
export default {
  name: "VersionTimeline",
  components: { ReadonlyOff, TextDiff },
  props: {
    revisions: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    restorable: { type: Boolean, default: true },
  },
  emits: ["restore"],
  data() {
    return { open: null };
  },
  methods: {
    valueText,
    info(revision) {
      return versionInfo(revision);
    },
    isCurrent(index) {
      return index === this.revisions.length - 1;
    },
    authorLabel(revision) {
      const { author, restoredFrom } = this.info(revision);
      if (author === "restore") return this.$t("enrichment.versions.restored", { number: restoredFrom });
      return this.$t(author === "ai" ? "enrichment.versions.by_ai" : "enrichment.versions.by_you");
    },
    relative(iso) {
      return formatRelative(iso);
    },
    toggle(number) {
      this.open = this.open === number ? null : number;
    },
  },
};
</script>

<style lang="scss" scoped>
.version-timeline {
  list-style: none;
  padding: 0;
}
.version-timeline__item {
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.version-timeline__item--current {
  border-color: var(--accent);
}
.version-timeline__number {
  font-weight: 600;
  color: var(--text-strong);
}
.version-timeline__time {
  margin-left: auto;
  white-space: nowrap;
}
.version-timeline__instruction {
  color: var(--text-body);
  word-break: break-word;
}
</style>
