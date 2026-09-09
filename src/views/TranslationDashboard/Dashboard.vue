<template>
  <div class="tj-dashboard">
    <!-- Stats Cards -->
    <div class="tj-stats">
      <div
        v-for="stat in statCards"
        :key="stat.key"
        class="tj-stat-card"
      >
        <span class="tj-stat-card__value" :class="stat.colorClass">{{ stat.count }}</span>
        <span class="tj-stat-card__label">{{ stat.label }}</span>
      </div>
    </div>

    <!-- Filter Chips -->
    <div class="tj-filters flex ai-ct gap-200 mb-300">
      <FilterChip
        v-for="chip in filterChips"
        :key="chip.value"
        :label="chip.label"
        :active="jobsStore.statusFilter === chip.value"
        :count="chip.count"
        @click="jobsStore.setStatusFilter(chip.value)"
      />
      <div class="flex-1"></div>
      <BasicButton
        :text="$t('translation.refresh')"
        icon="arrows-rotate"
        class="bg-basic-200 t-basic-600"
        @click="refresh"
      />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-if="!jobsStore.loading && !jobsStore.filteredJobs.length"
      icon="language"
      :title="$t('translation.no_jobs')"
      :message="$t('translation.no_jobs_msg')"
    />

    <!-- Jobs Table -->
    <DataTable
      v-if="jobsStore.filteredJobs.length"
      :columns="columns"
      :rows="jobsStore.filteredJobs"
      row-key="id"
      :loading="jobsStore.loading"
    >
      <template #cell-id="{ row }">
        <span class="tj-mono">{{ shortId(row.id) }}</span>
      </template>

      <template #cell-source="{ row }">
        <span
          class="tj-source-badge"
          :class="`tj-source-badge--${row._source}`"
        >
          {{ $t(`translation.${row._source}`) }}
        </span>
      </template>

      <template #cell-type="{ row }">
        {{ entityType(row) }}
      </template>

      <template #cell-target="{ row }">
        <span class="fw-600">{{ targetLang(row) }}</span>
      </template>

      <template #cell-progress="{ row }">
        <div class="tj-progress">
          <div class="tj-progress__bar" :style="{ width: progressPct(row) + '%' }"></div>
          <span class="tj-progress__label">
            {{ row.completed_items || 0 }}/{{ row.total_items || 0 }}
            ({{ progressPct(row) }}%)
          </span>
        </div>
      </template>

      <template #cell-cost="{ row }">
        <span v-if="row.actual_cost_usd">
          ${{ Number(row.actual_cost_usd).toFixed(2) }}
        </span>
        <span v-else-if="row.estimated_cost_usd" class="t-basic-500">
          {{ $t("translation.estimated") }} ${{ Number(row.estimated_cost_usd).toFixed(2) }}
        </span>
        <span v-else class="t-basic-400">&mdash;</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="statusLabel(row.status)" :variant="statusVariant(row.status)" />
      </template>

      <template #cell-created="{ row }">
        <span class="t-basic-500">{{ relativeTime(row.created_at) }}</span>
      </template>
    </DataTable>
  </div>
</template>

<script>
import { useTranslationJobsStore } from "@/stores/translationJobs";
import { usePimChannelStore } from "@/stores/pimChannel";

export default {
  name: "TranslationDashboard",
  setup() {
    const jobsStore = useTranslationJobsStore();
    const pimChannel = usePimChannelStore();
    return { jobsStore, pimChannel };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    statCards() {
      return [
        {
          key: "pending",
          label: this.$t("translation.stats_pending"),
          count: this.jobsStore.stats.pending,
          colorClass: "t-informative-200",
        },
        {
          key: "running",
          label: this.$t("translation.stats_running"),
          count: this.jobsStore.stats.running,
          colorClass: "t-warning-200",
        },
        {
          key: "completed",
          label: this.$t("translation.stats_completed"),
          count: this.jobsStore.stats.completed,
          colorClass: "t-positive-200",
        },
        {
          key: "failed",
          label: this.$t("translation.stats_failed"),
          count: this.jobsStore.stats.failed,
          colorClass: "t-negative-200",
        },
      ];
    },
    filterChips() {
      return [
        { value: "all", label: this.$t("translation.all"), count: this.jobsStore.stats.total },
        { value: "pending", label: this.$t("translation.pending"), count: this.jobsStore.stats.pending },
        { value: "running", label: this.$t("translation.running"), count: this.jobsStore.stats.running },
        { value: "completed", label: this.$t("translation.completed"), count: this.jobsStore.stats.completed },
        { value: "failed", label: this.$t("translation.failed"), count: this.jobsStore.stats.failed },
      ];
    },
    columns() {
      return [
        { key: "id", label: this.$t("translation.job_id"), width: "100px" },
        { key: "source", label: this.$t("translation.source"), width: "90px" },
        { key: "type", label: this.$t("translation.type"), width: "110px" },
        { key: "target", label: this.$t("translation.target"), width: "80px" },
        { key: "progress", label: this.$t("translation.progress"), width: "1fr" },
        { key: "cost", label: this.$t("translation.cost"), width: "120px" },
        { key: "status", label: this.$t("translation.status"), width: "120px" },
        { key: "created", label: this.$t("translation.created"), width: "100px" },
      ];
    },
  },
  mounted() {
    if (this.channelIdx) {
      this.jobsStore.startPolling(this.channelIdx);
    }
  },
  beforeUnmount() {
    this.jobsStore.stopPolling();
  },
  watch: {
    channelIdx(newIdx) {
      if (newIdx) {
        this.jobsStore.startPolling(newIdx);
      }
    },
  },
  methods: {
    refresh() {
      if (this.channelIdx) {
        this.jobsStore.fetchJobs(this.channelIdx);
      }
    },
    shortId(id) {
      if (!id) return "";
      return String(id).substring(0, 8);
    },
    entityType(row) {
      if (row.metadata?.entity_type) return row.metadata.entity_type;
      if (row.entity_type) return row.entity_type;
      if (row._source === "reviews") return "review";
      return row._source === "pim" ? "product" : "page";
    },
    targetLang(row) {
      const lang = row.target_language || row.metadata?.target_language || "";
      return lang.toUpperCase();
    },
    progressPct(row) {
      const total = row.total_items || 0;
      if (!total) return 0;
      const completed = row.completed_items || 0;
      return Math.round((completed / total) * 100);
    },
    statusLabel(status) {
      const map = {
        pending: this.$t("translation.pending"),
        running: this.$t("translation.running"),
        completed: this.$t("translation.completed"),
        failed: this.$t("translation.failed"),
      };
      return map[status] || status;
    },
    statusVariant(status) {
      const map = {
        pending: "informative",
        running: "warning",
        completed: "positive",
        failed: "negative",
      };
      return map[status] || "neutral";
    },
    relativeTime(dateStr) {
      if (!dateStr) return "";
      const now = Date.now();
      const then = new Date(dateStr).getTime();
      const diffSec = Math.floor((now - then) / 1000);

      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDay = Math.floor(diffHour / 24);
      return `${diffDay}d ago`;
    },
  },
};
</script>

<style lang="scss" scoped>
.tj-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-300);
}

/* Stats Cards */
.tj-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-200);
}

.tj-stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-50);
  padding: var(--space-200);
  background: var(--c-basic-200);
  border-radius: var(--radius-md);
  border: 1px solid var(--c-basic-300);
}

.tj-stat-card__value {
  font-size: var(--fs-700);
  font-weight: 700;
  line-height: 1;
}

.tj-stat-card__label {
  font-size: var(--fs-200);
  color: var(--c-basic-500);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* Filters */
.tj-filters {
  flex-wrap: wrap;
}

/* Monospace ID */
.tj-mono {
  font-family: monospace;
  font-size: var(--fs-200);
  color: var(--c-basic-600);
}

/* Source badge */
.tj-source-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tj-source-badge--pim {
  background: var(--c-support-100);
  color: var(--c-support-400);
}

.tj-source-badge--content {
  background: var(--c-positive-100);
  color: var(--c-positive-300);
}

.tj-source-badge--reviews {
  background: var(--c-warning-100);
  color: var(--c-warning-300);
}

/* Progress bar */
.tj-progress {
  position: relative;
  height: 22px;
  background: var(--c-basic-200);
  border-radius: var(--radius-sm);
  overflow: hidden;
  min-width: 120px;
}

.tj-progress__bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--c-support-400);
  opacity: 0.2;
  border-radius: var(--radius-sm);
  transition: width 0.3s ease;
}

.tj-progress__label {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--fs-200);
  font-weight: 600;
  color: var(--c-basic-700);
}

@media only screen and (max-width: 768px) {
  .tj-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
