<template>
  <div class="events-mode">
    <div class="flex ai-ct flex-wrap gap-5 mb-8">
      <span :id="severityLabelId" class="t-secondary fs-200">{{ $t("atlas.severity.label") }}</span>
      <div class="filter-chip-row" role="group" :aria-labelledby="severityLabelId">
        <FilterChip
          v-for="opt in severityOptions"
          :key="opt.value"
          :label="opt.label"
          :active="severityFilter === opt.value"
          :data-testid="`events-severity-${opt.value}`"
          @click="setSeverity(opt.value)"
        />
      </div>
      <ReadonlyOff>
        <BasicSwitch
          :label="$t('atlas.logs.show_acknowledged')"
          v-model="showAcknowledged"
          data-testid="events-show-ack-toggle"
        />
      </ReadonlyOff>
    </div>

    <Loader block v-show="loading" />
    <DataTable
      empty-size="md"
      v-show="!loading"
      :columns="columns"
      :rows="events"
      row-key="id"
      :empty-text="$t('atlas.review.events.empty_state')"
    >
      <template #cell-created_at="{ value }">
        <span class="fs-200 t-secondary">{{ formatDate(value) }}</span>
      </template>
      <template #cell-severity="{ value }">
        <StatusBadge :label="value" :tone="severityVariant(value)" />
      </template>
      <template #cell-acknowledged_at="{ row }">
        <BasicButton mutates
          v-if="!row.acknowledged_at"
          size="sm"
          :data-testid="`events-ack-${row.id}`"
          @click="acknowledge(row)"
        >
          {{ $t("atlas.review.events.acknowledge_button") }}
        </BasicButton>
        <span v-else class="t-muted fs-200">{{ formatDate(row.acknowledged_at) }}</span>
      </template>
    </DataTable>
  </div>
</template>

<script>
import { useId } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { formatDate } from "@/utils/format";
import {
  GET_IntegrationEvents,
  POST_AcknowledgeEvent,
} from "@/api/atlas/api";
import { ReadonlyOff } from "@/composables/useReadonly";

const SEVERITY_VARIANTS = {
  critical: "negative",
  warning: "warning",
  info: "info",
};

export default {
  name: "EventsMode",
  components: { ReadonlyOff },
  props: {
    filters: { type: Object, required: true },
  },
  setup() {
    return { notify: useNotifyStore(), severityLabelId: `${useId()}-severity` };
  },
  data() {
    return {
      events: [],
      loading: false,
      severityFilter: "__all",
      showAcknowledged: false,
    };
  },
  computed: {
    severityOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        { value: "critical", label: this.$t("atlas.severity.critical") },
        { value: "warning", label: this.$t("atlas.severity.warning") },
        { value: "info", label: this.$t("atlas.severity.info") },
      ];
    },
    columns() {
      return [
        {
          key: "created_at",
          label: this.$t("atlas.logs.col.created"),
          width: "1fr",
        },
        {
          key: "severity",
          label: this.$t("atlas.severity.label"),
          width: "max-content",
        },
        {
          key: "source_idx",
          label: this.$t("atlas.review.list.col.supplier"),
          width: "120px",
          priority: 2,
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
        { key: "acknowledged_at", label: "", actions: true },
      ];
    },
  },
  watch: {
    filters: {
      handler() {
        this.fetchEvents();
      },
      deep: true,
    },
    severityFilter() {
      this.fetchEvents();
    },
    showAcknowledged() {
      this.fetchEvents();
    },
  },
  mounted() {
    this.fetchEvents();
  },
  methods: {
    formatDate,
    severityVariant(value) {
      return SEVERITY_VARIANTS[value] || "neutral";
    },
    setSeverity(val) {
      this.severityFilter = val;
    },
    async fetchEvents() {
      this.loading = true;
      try {
        const params = { page_size: 50 };
        if (this.filters.supplier && this.filters.supplier !== "__all") {
          params.source = this.filters.supplier;
        }
        if (this.filters.search) params.search = this.filters.search;
        if (this.severityFilter !== "__all")
          params.severity = this.severityFilter;
        if (!this.showAcknowledged) params.acknowledged = false;
        const { data } = await GET_IntegrationEvents(params);
        this.events = data.results || [];
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
        this.fetchEvents();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.events-mode {
  display: flex;
  flex-direction: column;
}
</style>
