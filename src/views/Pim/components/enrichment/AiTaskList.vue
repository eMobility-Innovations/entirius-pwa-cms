<template>
  <div class="ai-tasks flex-column gap-3" data-testid="ai-tasks">
    <ul v-if="groups.current.length" class="ai-tasks__list">
      <AiTaskRow
        v-for="task in groups.current"
        :key="task.id"
        :task="task"
        :worker="workerOf(task)"
        :label="labelOf(task)"
        :selected="task.id === selected"
        :retrying="retrying.includes(task.id)"
        :usable="usable"
        @select="toggle"
        @retry="(failed) => $emit('retry', failed)"
      />
    </ul>
    <p v-else class="fs-200 t-muted m-0" data-testid="ai-tasks-idle">{{ $t("enrichment.ai.tasks_idle") }}</p>

    <template v-if="groups.history.length">
      <BasicButton
        variant="ghost"
        size="sm"
        class="ai-tasks__history-toggle"
        :aria-expanded="String(historyOpen)"
        data-testid="ai-tasks-history"
        @click="historyOpen = !historyOpen"
      >
        <FontAwesomeIcon :icon="historyOpen ? $icons.collapse : $icons.expand" class="mr-2" aria-hidden="true" />
        {{ $t("enrichment.ai.history", { count: groups.history.length }) }}
      </BasicButton>
      <ul v-if="historyOpen" class="ai-tasks__list" data-testid="ai-tasks-history-list">
        <AiTaskRow
          v-for="task in groups.history"
          :key="task.id"
          :task="task"
          :worker="workerOf(task)"
          :label="labelOf(task)"
          :selected="task.id === selected"
          :retrying="retrying.includes(task.id)"
          :usable="usable"
          @select="toggle"
          @retry="(failed) => $emit('retry', failed)"
        />
      </ul>
    </template>
  </div>
</template>

<script>
import AiTaskRow from "./AiTaskRow.vue";
import { groupTasks, taskLabel } from "./productAi";

// The product's AI tasks: what runs, waits for review or just failed on top; everything already handled folds into
// History. Picking a task filters the proposals to it (`select` with its id, or null to show all again). A row's Try
// again goes up as `retry` with its task; `retrying` lists the ids with a request out, `usable` off disables the action.
export default {
  name: "AiTaskList",
  components: { AiTaskRow },
  props: {
    tasks: { type: Array, default: () => [] },
    workers: { type: Array, default: () => [] },
    templates: { type: Array, default: () => [] },
    selected: { type: Number, default: null },
    retrying: { type: Array, default: () => [] },
    usable: { type: Boolean, default: true },
  },
  emits: ["select", "retry"],
  data() {
    return { historyOpen: false };
  },
  computed: {
    groups() {
      return groupTasks(this.tasks);
    },
  },
  methods: {
    workerOf(task) {
      return this.workers.find((w) => w.key === task.type) || null;
    },
    labelOf(task) {
      return taskLabel(task, this.workers, this.templates);
    },
    toggle(id) {
      this.$emit("select", id === this.selected ? null : id);
    },
  },
};
</script>

<style lang="scss" scoped>
.ai-tasks__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ai-tasks__history-toggle {
  align-self: flex-start;
}
</style>
