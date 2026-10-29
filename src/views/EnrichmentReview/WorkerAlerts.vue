<template>
  <section v-if="alerts.length" class="flex-column gap-3" :aria-label="$t('enrichment.workers.alerts')" data-testid="worker-alerts">
    <StepCallout
      v-for="row in alerts"
      :key="row.key"
      :tone="row.state === 'paused' ? 'warning' : 'info'"
      :icon="row.state === 'paused' ? 'warning' : 'scheduled'"
      :data-testid="`worker-alert-${row.key}`"
    >
      <div class="worker-alert flex ai-ct gap-5">
        <span class="worker-alert__text">{{ alertText(row) }}</span>
        <BasicButton
          v-if="row.state === 'paused'"
          variant="secondary"
          size="sm"
          mutates
          :loading="resuming === row.key"
          :data-testid="`worker-resume-${row.key}`"
          @click="resume(row)"
        >
          {{ $t("enrichment.workers.resume") }}
        </BasicButton>
      </div>
    </StepCallout>
  </section>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_WorkersStatus, POST_ResumeWorker } from "@/api/enrichment/api";
import { listOf } from "@/api/enrichment/listOf";
import StepCallout from "@/views/EnrichmentStudio/StepCallout.vue";
import { workerAlertText, workerAlerts } from "./workQueue";

const REFRESH_MS = 15000;

// Review → Runs: one line per AI worker that is paused (with Resume) or whose work waits with nobody taking it. Read
// now and every few seconds while the page is open; nothing shows while every worker is fine.
export default {
  name: "WorkerAlerts",
  components: { StepCallout },
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      rows: [],
      resuming: "",
      timer: null,
      // Bumped by every read and on leaving: only the latest read lands (a late poll never undoes a Resume).
      seq: 0,
    };
  },
  computed: {
    alerts() {
      return workerAlerts(this.rows);
    },
  },
  mounted() {
    this.fetchStatus();
  },
  beforeUnmount() {
    this.seq += 1;
    clearTimeout(this.timer);
  },
  methods: {
    async fetchStatus() {
      clearTimeout(this.timer);
      const mine = ++this.seq;
      const rows = await GET_WorkersStatus().then(({ data }) => listOf(data), () => null); // failed: keep the last lines
      if (mine !== this.seq) return;
      if (rows) this.rows = rows;
      this.timer = setTimeout(() => this.fetchStatus(), REFRESH_MS);
    },
    alertText(row) {
      return workerAlertText(row);
    },
    async resume(row) {
      this.resuming = row.key;
      try {
        const { data } = await POST_ResumeWorker(row.key);
        this.rows = this.rows.map((r) => (r.key === row.key ? data : r));
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.workers.resumed", { label: row.label }) });
        this.fetchStatus();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.resuming = "";
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.worker-alert {
  flex-wrap: wrap;
}
.worker-alert__text {
  flex: 1 1 240px;
  min-width: 0;
}
</style>
