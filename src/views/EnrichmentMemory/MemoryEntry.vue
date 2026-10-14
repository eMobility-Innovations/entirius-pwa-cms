<template>
  <article class="memory-entry flex-column gap-3" :class="{ 'memory-entry--pending': pending }" :data-testid="`memory-entry-${entry.id}`">
    <header class="flex ai-ct flex-wrap gap-3">
      <Tag :label="$t(`enrichment.memory.kind.${entry.kind}`)" />
      <StatusBadge :label="$t(`enrichment.memory.status.${entry.status}`)" :tone="tone" size="sm" />
      <StatusBadge v-if="expired" :label="$t('enrichment.memory.expired')" tone="neutral" size="sm" data-testid="memory-expired" />
      <span class="memory-entry__meta fs-200 t-muted">{{ subject }} · {{ scope }} · {{ formatDate(entry.created_at) }}</span>
    </header>

    <h3 class="memory-entry__title m-0">{{ entry.title }}</h3>

    <dl v-if="entry.kind === 'seo_brief'" class="memory-entry__brief m-0" data-testid="memory-brief">
      <dt class="field-label">{{ $t("enrichment.studio.keywords.primary") }}</dt>
      <dd class="m-0 fw-600" data-testid="memory-brief-primary">{{ brief.primary || "—" }}</dd>
      <dt class="field-label">{{ $t("enrichment.studio.keywords.secondary") }}</dt>
      <dd class="m-0" data-testid="memory-brief-secondary">{{ brief.secondary.join(", ") || "—" }}</dd>
      <dt class="field-label">{{ $t("enrichment.studio.keywords.intent") }}</dt>
      <dd class="m-0">{{ intentLabel(brief.intent) }}</dd>
      <dt class="field-label">{{ $t("enrichment.memory.expires") }}</dt>
      <dd class="m-0" data-testid="memory-brief-expiry">{{ entry.expires_at ? formatDate(entry.expires_at) : "—" }}</dd>
    </dl>
    <p v-else-if="entry.text" class="memory-entry__text m-0">{{ entry.text }}</p>

    <div class="flex ai-ct flex-wrap gap-3">
      <BasicButton v-if="target" size="sm" mutates :disabled="busy" data-testid="memory-promote" @click="$emit('promote', entry)">
        {{ $t("enrichment.memory.promote") }}
      </BasicButton>
      <BasicButton v-if="entry.status === 'active'" size="sm" mutates :disabled="busy" data-testid="memory-dismiss" @click="$emit('status', entry, 'dismissed')">
        {{ $t("enrichment.memory.dismiss") }}
      </BasicButton>
      <BasicButton v-if="entry.status === 'dismissed'" size="sm" mutates :disabled="busy" data-testid="memory-activate" @click="$emit('status', entry, 'active')">
        {{ $t("enrichment.memory.activate") }}
      </BasicButton>
      <IconButton
        class="memory-entry__delete"
        icon="delete"
        variant="danger"
        mutates
        :disabled="busy"
        :label="$t('common.delete')"
        data-testid="memory-delete"
        @click="$emit('delete', entry)"
      />
    </div>
  </article>
</template>

<script>
import { formatDate } from "@/utils/format";
import { useProfileChannels } from "@/views/EnrichmentProfile/useProfileChannels";
import { briefOf, isExpired, isPendingSuggestion, promoteTarget, subjectKey } from "./memoryLogic";

const TONES = { active: "positive", dismissed: "neutral", promoted: "accent" };

// One memory entry: what kind, its state, what it is about, the text (an SEO brief as its phrases, intent and
// expiry), and the operator's actions — "Add to profile" for a waiting suggestion, Dismiss / Use again, Delete.
export default {
  name: "MemoryEntry",
  props: {
    entry: { type: Object, required: true },
    busy: { type: Boolean, default: false },
  },
  emits: ["promote", "status", "delete"],
  setup() {
    const { options: channelOptions } = useProfileChannels();
    return { formatDate, channelOptions };
  },
  computed: {
    pending() {
      return isPendingSuggestion(this.entry);
    },
    target() {
      return this.pending ? promoteTarget(this.entry) : null;
    },
    expired() {
      return isExpired(this.entry);
    },
    tone() {
      return TONES[this.entry.status] || "neutral";
    },
    brief() {
      return briefOf(this.entry);
    },
    subject() {
      return this.$t(`enrichment.memory.subject.${subjectKey(this.entry)}`);
    },
    scope() {
      const channel = this.channelOptions.find((option) => option.value === this.entry.channel);
      return channel?.label || this.$t("enrichment.memory.a_channel");
    },
  },
  methods: {
    intentLabel(intent) {
      if (!intent) return "—";
      const path = `enrichment.studio.keywords.intents.${intent}`;
      const label = this.$t(path);
      return label === path ? intent : label;
    },
  },
};
</script>

<style lang="scss" scoped>
.memory-entry {
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}
.memory-entry--pending {
  border-color: var(--accent);
}
.memory-entry__meta {
  margin-left: auto;
}
.memory-entry__title {
  font-size: var(--fs-400);
  font-weight: 600;
  color: var(--text-strong);
  overflow-wrap: break-word;
}
.memory-entry__text {
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.memory-entry__brief {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-4);
  align-items: baseline;
}
.memory-entry__delete {
  margin-left: auto;
}
</style>
