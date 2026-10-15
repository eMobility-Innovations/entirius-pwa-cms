<template>
  <SideDrawer
    :visible="visible"
    :title="drawerTitle"
    width="680px"
    @close="$emit('close')"
  >
    <div class="task-queue flex-column gap-5">
      <div v-if="outcome || progress || unitLine" class="flex-column gap-1">
        <p v-if="outcome" class="task-queue__outcome m-0 fw-600 t-strong" data-testid="queue-outcome">{{ outcome }}</p>
        <p v-if="progress" class="m-0 fs-200 t-secondary" data-testid="queue-progress">{{ progress }}</p>
        <p v-if="unitLine" class="m-0 fs-200 t-secondary" :title="$t('enrichment.queue.units_hint')" data-testid="queue-units">
          {{ unitLine }}
        </p>
      </div>
      <StepCallout v-if="stoppedByCost" tone="warning" icon="warning" role="alert" data-testid="queue-cost-stopped">
        {{ $t("enrichment.queue.cost_stopped") }}
      </StepCallout>
      <FailedUnits v-if="failedUnits.length" :units="failedUnits" :total="failedTotal" />
      <Loader v-show="loading" />

      <DataTable
        v-show="!loading && rows.length"
        :columns="columns"
        :rows="rows"
        row-key="key"
        :empty-text="$t('enrichment.queue.empty')"
      >
        <template #cell-sku="{ row }">
          <router-link
            v-if="row.run"
            :to="{ name: 'EnrichmentStudioRun', params: { uid: row.run } }"
            class="task-queue__review t-accent"
          >
            {{ $t("enrichment.review.studio_article") }}
          </router-link>
          <BasicButton
            v-else
            variant="ghost"
            size="sm"
            class="task-queue__sku"
            :data-testid="`queue-sku-${row.sku}`"
            @click="goToPim(row.sku)"
          >
            {{ row.sku }}
          </BasicButton>
        </template>
        <template #cell-priority="{ value }">
          <span class="fs-200 t-secondary">{{ value ?? "—" }}</span>
        </template>
      </DataTable>

      <EmptyState
        v-if="!loading && !rows.length"
        icon="tasks"
        :title="$t('enrichment.queue.empty')"
        :message="reachedEnd && page > 1 ? $t('enrichment.queue.end') : ''"
      />
    </div>

    <div class="task-queue__pager flex ai-ct jc-ct gap-5">
      <BasicButton
        variant="secondary"
        :disabled="loading || page <= 1"
        data-testid="queue-prev"
        @click="prevPage"
      >
        {{ $t("enrichment.queue.prev") }}
      </BasicButton>
      <span class="fs-200 t-muted">
        {{ $t("enrichment.queue.page", { page }) }}
      </span>
      <BasicButton
        variant="secondary"
        :disabled="loading || !hasMore"
        data-testid="queue-next"
        @click="nextPage"
      >
        {{ $t("enrichment.queue.next") }}
      </BasicButton>
    </div>
  </SideDrawer>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_Task, GET_TaskTargets } from "@/api/enrichment/api";
import { isActive } from "@/views/Pim/components/enrichment/productAi";
import { runUidOf } from "@/views/EnrichmentReview/reviewLogic";
import StepCallout from "@/views/EnrichmentStudio/StepCallout.vue";
import FailedUnits from "./FailedUnits.vue";
import { costStopped, unitProgress } from "./workQueue";

const REFRESH_MS = 5000;

export default {
  name: "TaskQueueDrawer",
  components: { FailedUnits, StepCallout },
  props: {
    visible: { type: Boolean, default: false },
    taskId: { type: Number, default: null },
    taskLabel: { type: String, default: "" },
    // What the run came to and its counts, in plain words (productAi.outcomeText, RunsPage.formatCounts).
    outcome: { type: String, default: "" },
    progress: { type: String, default: "" },
  },
  emits: ["close"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      targets: [],
      page: 1,
      loading: false,
      reachedEnd: false,
      // The run itself: its batches, the failed ones, why it stopped — refreshed while it runs and the drawer is open.
      task: null,
      taskTimer: null,
      // Bumped by every run read, on close and on leaving: only the latest read of the open run lands.
      taskSeq: 0,
    };
  },
  computed: {
    drawerTitle() {
      return this.taskLabel || this.$t("enrichment.queue.title");
    },
    // A list task's targets are bare refs; a gap task's carry a language and a priority. Columns no row fills are left out.
    columns() {
      const all = [
        { key: "sku", label: this.$t("enrichment.queue.sku"), width: "1.4fr" },
        { key: "locator", label: this.$t("enrichment.queue.locator"), width: "1fr" },
        { key: "priority", label: this.$t("enrichment.queue.priority"), width: "90px" },
      ];
      return all.filter((col) => col.key === "sku" || this.rows.some((row) => row[col.key] != null));
    },
    rows() {
      return this.targets.map((raw, i) => {
        const t = typeof raw === "string" ? { subject_ref: raw } : raw;
        const language = t.target_locator?.language;
        return {
          key: `${t.subject_ref}__${t.target_kind || ""}__${i}`,
          sku: t.subject_ref,
          run: runUidOf(t),
          locator: language ? language.toUpperCase() : null,
          priority: t.priority ?? null,
        };
      });
    },
    // The run shown: none while the drawer is closed.
    openTask() {
      return this.visible ? this.taskId : null;
    },
    unitLine() {
      return unitProgress(this.task?.units);
    },
    stoppedByCost() {
      return costStopped(this.task);
    },
    failedUnits() {
      return this.task?.failed_units || [];
    },
    failedTotal() {
      return this.task?.units?.failed || this.failedUnits.length;
    },
    // No total count from the API — a full-looking page means "maybe more".
    hasMore() {
      return !this.reachedEnd && this.targets.length > 0;
    },
  },
  watch: {
    openTask: "watchTask",
    visible(open) {
      if (open) {
        this.page = 1;
        this.fetchTargets();
      }
    },
    taskId() {
      if (this.visible) {
        this.page = 1;
        this.fetchTargets();
      }
    },
  },
  beforeUnmount() {
    this.stopTask();
  },
  methods: {
    // The open run is read now and every few seconds while it runs; a closed drawer forgets it.
    watchTask() {
      this.stopTask();
      this.task = null;
      if (this.openTask) this.fetchTask();
    },
    stopTask() {
      this.taskSeq += 1;
      clearTimeout(this.taskTimer);
    },
    async fetchTask() {
      const mine = ++this.taskSeq;
      try {
        const { data } = await GET_Task(this.taskId);
        if (mine !== this.taskSeq) return;
        this.task = data;
        if (isActive(data)) this.taskTimer = setTimeout(() => this.fetchTask(), REFRESH_MS);
      } catch {
        // The run's batches are extra: without them the drawer still lists its products.
      }
    },
    async fetchTargets() {
      if (!this.taskId) {
        this.targets = [];
        return;
      }
      this.loading = true;
      try {
        const { data } = await GET_TaskTargets(this.taskId, { page: this.page });
        this.targets = data.targets || [];
        this.reachedEnd = this.targets.length === 0;
      } catch (err) {
        this.targets = [];
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    nextPage() {
      if (!this.hasMore) return;
      this.page += 1;
      this.fetchTargets();
    },
    prevPage() {
      if (this.page <= 1) return;
      this.page -= 1;
      this.fetchTargets();
    },
    goToPim(sku) {
      this.$router.push({ name: "PimProductDetail", params: { sku } });
    },
  },
};
</script>

<style lang="scss" scoped>
.task-queue {
  padding: var(--space-8);
}
// The SKU opens the product: accent text, which the ghost variant rule (0,3,1) would otherwise override.
.task-queue button.button-basic.task-queue__sku {
  color: var(--text-accent);
}
.task-queue__review {
  align-self: flex-start;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
.task-queue__pager {
  padding: var(--space-8);
  border-top: 1px solid var(--border-subtle);
}
</style>
