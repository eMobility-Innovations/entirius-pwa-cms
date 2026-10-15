<template>
  <BasicModal
    :open="open"
    :title="$t('enrichment.studio.start_title')"
    size="md"
    :actions="actions"
    data-testid="start-work-dialog"
    @update:open="(value) => !value && close()"
  >
    <Loader v-if="loading" block />
    <p v-else-if="!tasks.length && !workflows.length" class="m-0 t-secondary" data-testid="start-work-empty">
      {{ $t("enrichment.studio.start_empty") }}
    </p>
    <div v-else class="flex-column gap-6">
      <section v-if="tasks.length" class="flex-column gap-3" data-testid="start-work-tasks">
        <div class="flex-column gap-1">
          <h3 class="start-work__heading m-0">{{ $t("enrichment.studio.group_tasks") }}</h3>
          <p class="fs-200 t-secondary m-0">{{ $t("enrichment.studio.group_tasks_hint") }}</p>
        </div>
        <BasicButton
          v-for="task in tasks"
          :key="task.key"
          :data-testid="`start-task-${task.key}`"
          @click="pick('task', task.key)"
        >
          {{ task.label }}
        </BasicButton>
      </section>
      <section v-if="workflows.length" class="flex-column gap-3" data-testid="start-work-guided">
        <div class="flex-column gap-1">
          <h3 class="start-work__heading m-0">{{ $t("enrichment.studio.group_guided") }}</h3>
          <p class="fs-200 t-secondary m-0">{{ $t("enrichment.studio.group_guided_hint") }}</p>
        </div>
        <BasicButton
          v-for="workflow in workflows"
          :key="workflow.key"
          :data-testid="`start-guided-${workflow.key}`"
          @click="pick('guided', workflow.key)"
        >
          {{ workflow.label }}
        </BasicButton>
      </section>
    </div>
  </BasicModal>
</template>

<script>
import { GET_Workflows } from "@/api/enrichment/api";
import { listOf } from "@/api/enrichment/listOf";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { studioTasks } from "./startLogic";

// "New" in the Studio — the one place to start AI work, in two groups: Tasks (a template run once on products the
// operator picks next; `templates` = the runnable ones, workflow steps left out) and Guided (a workflow: several
// steps, each approved). Picking one closes this and emits `task` / `guided` with its key.
export default {
  name: "StartWorkDialog",
  props: {
    open: { type: Boolean, default: false },
    templates: { type: Array, default: () => [] },
  },
  emits: ["update:open", "task", "guided"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { workflows: [], loading: false };
  },
  computed: {
    tasks() {
      return studioTasks(this.templates, this.workflows);
    },
    actions() {
      return [{ key: "cancel", role: "secondary", mutates: false, label: this.$t("common.cancel"), onClick: this.close }];
    },
  },
  watch: {
    open: { immediate: true, handler: "load" },
  },
  methods: {
    async load(open) {
      if (!open) return;
      this.loading = true;
      try {
        const { data } = await GET_Workflows();
        this.workflows = listOf(data);
      } catch (err) {
        this.workflows = [];
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
    pick(kind, key) {
      this.close();
      this.$emit(kind, key);
    },
    close() {
      this.$emit("update:open", false);
    },
  },
};
</script>

<style lang="scss" scoped>
.start-work__heading {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
</style>
