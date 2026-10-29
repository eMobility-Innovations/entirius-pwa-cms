<template>
  <div>
    <div class="flex ai-ct mb-8 gap-5">
      <ReadonlyOff>
        <SegmentedControl
          v-model="activeMode"
          :options="modeOptions"
          data-testid="logs-mode-switch"
        />
      </ReadonlyOff>
    </div>

    <!-- Feed Runs -->
    <div v-if="activeMode === 'feed_runs'">
      <Loader block v-show="loading" />
      <DataTable
        v-show="!loading"
        :columns="feedRunColumns"
        :rows="importLogs"
        row-key="id"
        :empty-text="$t('atlas.logs.no_runs')"
      >
        <template #cell-status="{ value }">
          <StatusBadge :label="value" :tone="logStatusVariant(value)" />
        </template>
        <template #cell-mode="{ value }">
          <span class="t-secondary fs-200">{{ value }}</span>
        </template>
      </DataTable>
    </div>

    <!-- Events -->
    <div v-else>
      <div class="flex ai-ct flex-wrap gap-5 mb-8">
        <FilterChip
          v-for="opt in severityOptions"
          :key="opt.value"
          :label="opt.label"
          :active="severityFilter === opt.value"
          :data-testid="`logs-severity-${opt.value}`"
          @click="setSeverity(opt.value)"
        />
        <ReadonlyOff>
          <BasicSwitch
            v-model="showAcknowledged"
            :label="$t('atlas.logs.show_acknowledged')"
            data-testid="logs-show-ack-toggle"
          />
        </ReadonlyOff>
      </div>

      <Loader block v-show="loading" />
      <DataTable
        v-show="!loading"
        :columns="eventColumns"
        :rows="events"
        row-key="id"
        :empty-text="$t('atlas.logs.no_events')"
        @row-click="onEventRowClick"
      >
        <template #cell-severity="{ value }">
          <StatusBadge :label="value" :tone="severityVariant(value)" />
        </template>
        <template #cell-acknowledged_at="{ row }">
          <BasicButton mutates
            v-if="!row.acknowledged_at"
            size="sm"
            :data-testid="`logs-ack-${row.id}`"
            @click="acknowledge(row)"
          >
            {{ $t("atlas.logs.acknowledge") }}
          </BasicButton>
          <span v-else class="t-muted fs-200">{{
            row.acknowledged_at
          }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_ImportLogs,
  GET_IntegrationEvents,
  POST_AcknowledgeEvent,
} from "@/api/atlas/api";
import { ReadonlyOff } from "@/composables/useReadonly";

const LOG_STATUS_VARIANTS = {
  running: "info",
  success: "positive",
  partial: "warning",
  failed: "negative",
};
const SEVERITY_VARIANTS = {
  critical: "negative",
  warning: "warning",
  info: "info",
};

export default {
  name: "LogsTab",
  components: { ReadonlyOff },
  props: {
    supplier: { type: Object, default: null },
  },
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      activeMode: "feed_runs",
      loading: false,
      importLogs: [],
      events: [],
      severityFilter: "__all",
      showAcknowledged: false,
    };
  },
  computed: {
    modeOptions() {
      return [
        {
          value: "feed_runs",
          label: this.$t("atlas.logs.feed_runs"),
          testid: "logs-mode-feed-runs",
        },
        {
          value: "events",
          label: this.$t("atlas.logs.events"),
          testid: "logs-mode-events",
        },
      ];
    },
    severityOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        { value: "critical", label: this.$t("atlas.severity.critical") },
        { value: "warning", label: this.$t("atlas.severity.warning") },
        { value: "info", label: this.$t("atlas.severity.info") },
      ];
    },
    feedRunColumns() {
      return [
        {
          key: "run_id",
          label: this.$t("atlas.logs.col.run_id"),
          width: "1.4fr",
        },
        {
          key: "mode",
          label: this.$t("atlas.logs.col.mode"),
          width: "80px",
        },
        {
          key: "status",
          label: this.$t("atlas.col.status"),
          width: "100px",
        },
        {
          key: "started_at",
          label: this.$t("atlas.logs.col.started"),
          width: "1fr",
        },
        {
          key: "finished_at",
          label: this.$t("atlas.logs.col.finished"),
          width: "1fr",
        },
        {
          key: "total_count",
          label: this.$t("atlas.logs.col.total"),
          width: "70px",
        },
        {
          key: "error_count",
          label: this.$t("atlas.logs.col.errors"),
          width: "70px",
        },
      ];
    },
    eventColumns() {
      return [
        {
          key: "created_at",
          label: this.$t("atlas.logs.col.created"),
          width: "1fr",
        },
        {
          key: "severity",
          label: this.$t("atlas.severity.label"),
          width: "100px",
        },
        {
          key: "event_type",
          label: this.$t("atlas.logs.col.event_type"),
          width: "1.5fr",
        },
        {
          key: "message",
          label: this.$t("atlas.logs.col.message"),
          width: "2fr",
        },
        { key: "acknowledged_at", label: "", width: "160px" },
      ];
    },
  },
  watch: {
    activeMode() {
      this.fetchLogs();
    },
    severityFilter() {
      if (this.activeMode === "events") this.fetchLogs();
    },
    showAcknowledged() {
      if (this.activeMode === "events") this.fetchLogs();
    },
    "supplier.idx"() {
      this.fetchLogs();
    },
  },
  mounted() {
    this.fetchLogs();
  },
  methods: {
    logStatusVariant(value) {
      return LOG_STATUS_VARIANTS[value] || "neutral";
    },
    severityVariant(value) {
      return SEVERITY_VARIANTS[value] || "neutral";
    },
    setSeverity(value) {
      this.severityFilter = value;
    },
    async fetchLogs() {
      if (!this.supplier?.idx) return;
      this.loading = true;
      try {
        if (this.activeMode === "feed_runs") {
          const { data } = await GET_ImportLogs({
            supplier_idx: this.supplier.idx,
            page_size: 50,
          });
          this.importLogs = data.results || [];
        } else {
          const params = {
            source: this.supplier.idx,
            page_size: 50,
          };
          if (this.severityFilter !== "__all")
            params.severity = this.severityFilter;
          if (!this.showAcknowledged) params.acknowledged = false;
          const { data } = await GET_IntegrationEvents(params);
          this.events = data.results || [];
        }
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async acknowledge(row) {
      try {
        await POST_AcknowledgeEvent(row.id);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.logs.ack_success"),
        });
        this.fetchLogs();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    onEventRowClick(row) {
      // Severity drilldown navigation per plan §4.3
      if (row.feed) {
        this.$router.push({
          path: `/suppliers/${this.supplier.idx}`,
          query: { tab: "feeds", feed_id: row.feed },
        });
      } else if (row.supplier_product) {
        this.$router.push({
          path: "/suppliers/review",
          query: {
            supplier: this.supplier.idx,
            sp_id: row.supplier_product,
          },
        });
      }
    },
  },
};
</script>
