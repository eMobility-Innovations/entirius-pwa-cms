<template>
  <section v-if="taskIds.length" class="run-corrections flex-column gap-2" data-testid="run-corrections">
    <span class="fs-200 t-secondary">{{ $t("enrichment.correct.runs_title") }}</span>
    <div
      v-for="id in taskIds"
      :key="id"
      class="run-corrections__run flex ai-ct flex-wrap gap-3 rg-1"
      :data-testid="`run-corrections-${id}`"
    >
      <router-link
        :to="{ name: 'EnrichmentReview', query: { ...$route.query, task: String(id) } }"
        class="run-corrections__name fw-600 t-accent"
        :title="$t('enrichment.correct.run_filter')"
        :data-testid="`run-corrections-link-${id}`"
      >
        {{ labels[id]?.title || $t("enrichment.tasks.generic") }}
      </router-link>
      <span v-if="labels[id]" class="fs-200 t-muted">{{ formatRelative(labels[id].at) }}</span>
      <BatchCorrection class="ml-auto" :task-id="id" @queued="$emit('queued')" />
    </div>
  </section>
</template>

<script>
import { formatRelative } from "@/utils/format";
import BatchCorrection from "./BatchCorrection.vue";
import { runUidOf } from "./reviewLogic";

const MAX_RUNS = 3;
const MEDIA_KINDS = ["picture", "video"];

// "Correct all" for each AI run behind the pending proposals on screen (the newest MAX_RUNS), named the way a run
// reads everywhere (runLabel: "Opis produktu · Orion Command Sofa", `labels` from the page) with when it ran. The name
// filters the list to that run (`?task=`), so its proposals can be read before one instruction goes to all of them.
// Studio steps and media are not corrected in bulk.
export default {
  name: "RunCorrections",
  components: { BatchCorrection },
  props: {
    rows: { type: Array, default: () => [] },
    // useRunLabels().labels: { [taskId]: { title, at } }.
    labels: { type: Object, default: () => ({}) },
  },
  emits: ["queued"],
  computed: {
    taskIds() {
      const ids = this.rows.filter(correctable).map((row) => row.task_id);
      return [...new Set(ids)].slice(0, MAX_RUNS);
    },
  },
  methods: {
    formatRelative,
  },
};

function correctable(row) {
  return row.status === "pending" && row.task_id != null && !runUidOf(row) && !MEDIA_KINDS.includes(row.target_kind);
}
</script>

<style lang="scss" scoped>
.run-corrections {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
}
.run-corrections__name {
  min-width: 0;
  overflow-wrap: anywhere;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
</style>
