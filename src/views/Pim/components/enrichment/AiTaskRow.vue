<template>
  <li class="ai-task" :class="{ 'ai-task--selected': selected }" :data-testid="`ai-task-${task.id}`">
    <div
      class="ai-task__select"
      role="button"
      tabindex="0"
      :aria-pressed="String(selected)"
      :title="$t('enrichment.ai.task_filter')"
      @click="$emit('select', task.id)"
      @keydown.enter.prevent="$emit('select', task.id)"
      @keydown.space.prevent="$emit('select', task.id)"
    >
      <span v-if="outcome.state === 'review'" class="ai-task__review" aria-hidden="true" data-testid="ai-task-review">
        {{ outcome.count > 99 ? "99+" : outcome.count }}
      </span>
      <span v-else class="ai-task__icon" :class="`ai-task__icon--${look.tone}`" aria-hidden="true">
        <FontAwesomeIcon :icon="$icons[look.icon]" :spin="outcome.state === 'running'" />
      </span>
      <span class="ai-task__main flex-column gap-1">
        <span class="flex ai-ct flex-wrap gap-2">
          <span class="ai-task__label">{{ label || worker?.label || $t("enrichment.ai.task_generic") }}</span>
          <Tag v-for="lang in languages" :key="lang" :label="languageLabel(lang)" />
        </span>
        <span
          class="ai-task__outcome"
          :class="`ai-task__outcome--${look.tone}`"
          :title="outcome.code || null"
          data-testid="ai-task-outcome"
        >
          {{ outcomeLine }}
        </span>
      </span>
      <span class="ai-task__aside flex-column gap-1">
        <span class="ai-task__time fs-200 t-muted">{{ relative }}</span>
        <CostLabel v-if="!running" :cost="task.cost_usd" :partial="!task.cost_complete" data-testid="ai-task-cost" />
      </span>
    </div>
    <div v-if="retryable" class="ai-task__actions">
      <BasicButton
        mutates
        size="sm"
        :disabled="!usable"
        :loading="retrying"
        :data-testid="`ai-task-retry-${task.id}`"
        @click="$emit('retry', task)"
      >
        {{ $t("enrichment.ai.try_again") }}
      </BasicButton>
    </div>
  </li>
</template>

<script>
import { formatRelative } from "@/utils/format";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import { ALL_LANGUAGES } from "./aiTaskForm";
import { isActive, isRetryable, outcomeText, taskLanguages, taskOutcome } from "./productAi";

const LOOK = {
  queued: { icon: "scheduled", tone: "info" },
  running: { icon: "running", tone: "accent" },
  review: { icon: "info", tone: "accent" },
  applied: { icon: "success", tone: "positive" },
  failed: { icon: "warning", tone: "negative" },
};
// Neutral outcomes (nothing to do, rejected, replaced, cancelled): the info icon, muted.
const QUIET = { icon: "info", tone: "neutral" };

// One AI task in plain words — a task waiting for review shows its count in an accent pill (the call to act): the template or worker, its languages, when, what it cost once done, and what came of it — proposals to review, applied,
// nothing to do, or why it failed (the toolbox error code, named for people; the code itself in the tooltip). A failed
// task, or a done one with failed products, offers Try again under its text (`retry` with the task; `retrying` = its
// request is out, `usable` off = the toolbox cannot take a run, as with the Run AI buttons).
export default {
  name: "AiTaskRow",
  components: { CostLabel },
  props: {
    task: { type: Object, required: true },
    worker: { type: Object, default: null },
    // The template's name when it ran from one (productAi.taskLabel).
    label: { type: String, default: "" },
    selected: { type: Boolean, default: false },
    retrying: { type: Boolean, default: false },
    usable: { type: Boolean, default: true },
  },
  emits: ["select", "retry"],
  computed: {
    outcome() {
      return taskOutcome(this.task);
    },
    // Queued or running: no cost yet.
    running() {
      return isActive(this.task);
    },
    look() {
      if (this.outcome.failed) return { icon: "warning", tone: "warning" };
      return LOOK[this.outcome.state] || QUIET;
    },
    retryable() {
      return isRetryable(this.task);
    },
    languages() {
      return taskLanguages(this.task);
    },
    relative() {
      return formatRelative(this.task.created_at);
    },
    outcomeLine() {
      return outcomeText(this.task, this.worker);
    },
  },
  methods: {
    // "*" is a writer's "All languages".
    languageLabel(lang) {
      return lang === ALL_LANGUAGES ? this.$t("enrichment.run.all_languages") : lang.toUpperCase();
    },
  },
};
</script>

<style lang="scss" scoped>
.ai-task {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
}
.ai-task--selected {
  border-color: var(--accent);
  background: var(--surface-raised);
}
.ai-task__select {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  flex: 1 1 100%;
  min-width: 0;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;

  &:hover {
    background: var(--surface-hover);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
.ai-task__icon {
  flex-shrink: 0;
  width: 1.25rem;
  padding-top: 2px;
  color: var(--text-secondary);
}
// The same accent pill as the header badge: proposals wait for the operator.
.ai-task__review {
  flex-shrink: 0;
  min-width: 1.25rem;
  height: 1.25rem;
  margin-top: 1px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--accent);
  color: var(--text-inverse);
  font-size: var(--fs-150);
  font-weight: 600;
  line-height: 1.25rem;
  text-align: center;
}
.ai-task__icon--accent {
  color: var(--accent);
}
.ai-task__icon--info {
  color: var(--info);
}
.ai-task__icon--positive {
  color: var(--positive);
}
.ai-task__icon--warning {
  color: var(--warning);
}
.ai-task__icon--negative {
  color: var(--negative);
}
.ai-task__main {
  flex: 1;
  min-width: 0;
}
.ai-task__label {
  font-weight: 600;
  color: var(--text-strong);
}
.ai-task__outcome {
  font-size: var(--fs-300);
  color: var(--text-secondary);
}
.ai-task__outcome--negative {
  color: var(--negative);
}
.ai-task__outcome--accent {
  color: var(--text-body);
}
// Under the text, not beside the cost and time: the icon column and the select padding line it up with the outcome.
.ai-task__actions {
  flex: 1 1 100%;
  padding: 0 var(--space-4) var(--space-4) calc(var(--space-4) * 2 + 1.25rem);
}
.ai-task__aside {
  flex-shrink: 0;
  align-items: flex-end;
  white-space: nowrap;
}
</style>
