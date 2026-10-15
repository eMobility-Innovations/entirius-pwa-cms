<template>
  <section v-if="taskIds.length" class="run-corrections flex-column gap-2" data-testid="run-corrections">
    <span class="fs-200 t-secondary">{{ $t("enrichment.correct.runs_title") }}</span>
    <div
      v-for="id in taskIds"
      :key="id"
      class="run-corrections__run flex ai-ct flex-wrap gap-3 rg-1"
      :data-testid="`run-corrections-${id}`"
    >
      <span class="fw-600">{{ nameOf(id) }}</span>
      <span v-if="tasks[id]" class="fs-200 t-muted">{{ formatRelative(tasks[id].created_at) }}</span>
      <BatchCorrection class="ml-auto" :task-id="id" @queued="$emit('queued')" />
    </div>
  </section>
</template>

<script>
import { formatRelative } from "@/utils/format";
import { GET_Task, GET_Templates, GET_Workers } from "@/api/enrichment/api";
import { taskLabel } from "@/views/Pim/components/enrichment/productAi";
import BatchCorrection from "./BatchCorrection.vue";
import { runUidOf } from "./reviewLogic";

const MAX_RUNS = 3;
const MEDIA_KINDS = ["picture", "video"];
const listOf = (data) => (Array.isArray(data) ? data : data?.results || []);

// "Correct all" for each AI run behind the pending proposals on screen (the newest MAX_RUNS), named by its template:
// one instruction for every proposal of that run still waiting. Studio steps and media are not corrected in bulk.
export default {
  name: "RunCorrections",
  components: { BatchCorrection },
  props: {
    rows: { type: Array, default: () => [] },
  },
  emits: ["queued"],
  data() {
    return { tasks: {}, workers: [], templates: [] };
  },
  computed: {
    taskIds() {
      const ids = this.rows.filter(correctable).map((row) => row.task_id);
      return [...new Set(ids)].slice(0, MAX_RUNS);
    },
  },
  watch: {
    taskIds: { immediate: true, handler: "loadTasks" },
  },
  mounted() {
    this.loadNames();
  },
  methods: {
    formatRelative,
    nameOf(id) {
      return taskLabel(this.tasks[id], this.workers, this.templates) || this.$t("enrichment.tasks.generic");
    },
    async loadTasks(ids) {
      const missing = ids.filter((id) => !this.tasks[id]);
      const loaded = await Promise.allSettled(missing.map((id) => GET_Task(id)));
      loaded.forEach((result) => {
        if (result.status === "fulfilled") this.tasks = { ...this.tasks, [result.value.data.id]: result.value.data };
      });
    },
    // Names only: without them a run still reads "AI task".
    async loadNames() {
      try {
        const [workers, templates] = await Promise.all([GET_Workers(), GET_Templates()]);
        this.workers = listOf(workers.data);
        this.templates = listOf(templates.data);
      } catch {
        this.workers = [];
        this.templates = [];
      }
    },
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
</style>
