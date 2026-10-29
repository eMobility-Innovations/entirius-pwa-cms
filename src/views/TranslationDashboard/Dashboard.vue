<template>
  <PageLayout>
    <template #header>
      <PageHeader :title="$t('translation.jobs')">
        <template #meta>
          <PimChannelSelect />
        </template>
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="filter-chip-row" role="group" :aria-label="$t('translation.filters')">
        <FilterChip
          v-for="chip in filterChips"
          :key="chip.value"
          :label="chip.label"
          :active="jobsStore.statusFilter === chip.value"
          :count="chip.count"
          @click="jobsStore.setStatusFilter(chip.value)"
        />
      </div>
    </template>
  <div class="tj-dashboard">

    <!-- Stats Cards -->
    <div class="tj-stats">
      <BasicCard
        v-for="stat in statCards"
        :key="stat.key"
        class="tj-stat"
      >
        <span class="tj-stat__value" :class="stat.colorClass">{{ stat.count }}</span>
        <span class="tj-stat__label">{{ stat.label }}</span>
      </BasicCard>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-if="!jobsStore.loading && !jobsStore.filteredJobs.length"
      icon="translate"
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
        <StatusBadge
          :label="row._source === 'pim' ? $t('translation.pim') : $t('translation.content')"
          :tone="row._source === 'pim' ? 'accent' : 'positive'"
          :dot="false"
        />
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
        <span v-else-if="row.estimated_cost_usd" class="t-muted">
          {{ $t("translation.estimated") }} ${{ Number(row.estimated_cost_usd).toFixed(2) }}
        </span>
        <span v-else class="t-muted">&mdash;</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="statusLabel(row.status)" :tone="statusVariant(row.status)" />
      </template>

      <template #cell-created="{ row }">
        <span class="t-muted">{{ relativeTime(row.created_at) }}</span>
      </template>
    </DataTable>
  </div>

    <PimTranslateDialog
      v-if="translatorAvailable"
      v-model:open="showTranslateStore"
      scope="store"
      :channel-idx="channelIdx"
      @translated="watchNewJobs"
    />
  </PageLayout>
</template>

<script>
import { useTranslationJobsStore } from "@/stores/translationJobs";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useMuninStore } from "@/stores/munin";
import PimChannelSelect from "@/views/Pim/components/PimChannelSelect.vue";
import PimTranslateDialog from "@/views/Pim/components/PimTranslateDialog.vue";

// The one home of the store-wide translation („Tłumacz sklep”): every entity type of the picked channel in one go.
// The Pim views offer only what is scoped to their entity or selection.
export default {
  name: "TranslationDashboard",
  components: { PimChannelSelect, PimTranslateDialog },
  setup() {
    const jobsStore = useTranslationJobsStore();
    const pimChannel = usePimChannelStore();
    const munin = useMuninStore();
    return { jobsStore, pimChannel, munin };
  },
  data() {
    return { showTranslateStore: false };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    translatorAvailable() {
      return this.munin.isModuleInstalled("pim_translator");
    },
    statCards() {
      return [
        {
          key: "pending",
          label: this.$t("translation.stats_pending"),
          count: this.jobsStore.stats.pending,
          colorClass: "t-info",
        },
        {
          key: "running",
          label: this.$t("translation.stats_running"),
          count: this.jobsStore.stats.running,
          colorClass: "t-warning",
        },
        {
          key: "completed",
          label: this.$t("translation.stats_completed"),
          count: this.jobsStore.stats.completed,
          colorClass: "t-positive",
        },
        {
          key: "failed",
          label: this.$t("translation.stats_failed"),
          count: this.jobsStore.stats.failed,
          colorClass: "t-negative",
        },
      ];
    },
    headerActions() {
      const refresh = { key: "refresh", role: "secondary", label: this.$t("translation.refresh"), onClick: this.refresh };
      if (!this.translatorAvailable) return [refresh];
      const translateStore = {
        key: "translate-store",
        role: "primary",
        label: this.$t("pim.translate_store"),
        testid: "translation-translate-store",
        onClick: () => {
          this.showTranslateStore = true;
        },
      };
      return [refresh, translateStore];
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
    // The jobs the dialog just created: read them now and keep polling while any is pending or running.
    watchNewJobs() {
      if (this.channelIdx) {
        this.jobsStore.startPolling(this.channelIdx);
      }
    },
    shortId(id) {
      if (!id) return "";
      return String(id).substring(0, 8);
    },
    entityType(row) {
      if (row.metadata?.entity_type) return row.metadata.entity_type;
      if (row.entity_type) return row.entity_type;
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
        pending: "info",
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
  gap: var(--space-8);
}

/* Stats Cards */
.tj-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
}

.tj-stat {
  align-items: center;
  gap: var(--space-1);
}

.tj-stat__value {
  font-size: var(--fs-700);
  font-weight: 600;
  line-height: 1;
}

.tj-stat__label {
  font-size: var(--fs-200);
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* Monospace ID */
.tj-mono {
  font-family: monospace;
  font-size: var(--fs-200);
  color: var(--text-secondary);
}

/* Progress bar */
.tj-progress {
  position: relative;
  height: 22px;
  background: var(--surface-raised);
  border-radius: var(--radius-base);
  overflow: hidden;
  min-width: 120px;
}

.tj-progress__bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--accent-fill);
  opacity: 0.2;
  border-radius: var(--radius-base);
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
  color: var(--text-body);
}

@media only screen and (max-width: 768px) {
  .tj-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
