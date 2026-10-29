<template>
  <section class="flex-column gap-5" data-testid="company-intel">
    <IntelCard :context="company" expanded />
    <EmptyState v-if="!audit" icon="empty" size="sm" :title="$t('leads.intel.no_audit')" data-testid="intel-no-audit" />
    <template v-else>
      <p class="m-0">{{ $t("leads.intel.audit_status") }}: <strong data-testid="intel-audit-status">{{ audit.status }}</strong></p>
      <DataTable :columns="columns" :rows="scoreRows" row-key="strategy" data-testid="intel-scores">
        <template #cell-score="{ row }">
          <span :data-testid="`intel-score-${row.strategy}`">{{ row.score }}</span>
        </template>
      </DataTable>
      <h3 class="fs-400 fw-600 m-0">{{ $t("leads.intel.sources") }}</h3>
      <ul class="intel__sources m-0">
        <li v-for="report in audit.reports" :key="report.source" data-testid="intel-source">
          {{ report.source }} — {{ report.status }}
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { t } from "@/i18n";
import { GET_LatestAudit } from "@/api/siteintel/api";
import IntelCard from "../IntelCard.vue";

// Intel of the company: hooks + platform, lighthouse performance per strategy and every source of the latest audit.
const props = defineProps({ company: { type: Object, required: true } });
const audit = ref(null);

const strategies = computed(() => {
  const lighthouse = audit.value?.reports.find((report) => report.source === "lighthouse");
  return lighthouse?.processed?.strategies || {};
});

const columns = computed(() => [
  { key: "label", label: t("leads.intel.test"), width: "1fr" },
  { key: "score", label: t("leads.intel.score"), width: "max-content", numeric: true },
]);
const scoreRows = computed(() =>
  Object.entries(strategies.value).map(([strategy, summary]) => ({
    strategy,
    label: t(`leads.intel.strategy.${strategy}`),
    score: scoreText(summary),
  }))
);

function scoreText(summary) {
  const score = summary?.scores?.performance;
  return typeof score === "number" ? `${Math.round(score * 100)} / 100` : t("leads.intel.unavailable");
}

onMounted(async () => {
  audit.value = await GET_LatestAudit(props.company.domain);
});
</script>

<style scoped>
.intel__sources {
  padding-left: var(--space-4);
}
</style>
