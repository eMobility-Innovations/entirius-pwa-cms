<template>
  <section class="flex-column gap-5" data-testid="company-overview">
    <DataTable :columns="columns" :rows="rows" row-key="key">
      <template #cell-value="{ row }">
        <span :data-testid="row.testid">
          <router-link v-if="row.key === 'customer' && hasAccounts" class="t-accent" :to="customerRoute">
            {{ row.value }}
          </router-link>
          <template v-else>{{ row.value }}</template>
        </span>
      </template>
    </DataTable>
    <h3 class="fs-400 fw-600 m-0">{{ $t("leads.company.activities") }}</h3>
    <ul class="overview__activities flex-column gap-2 m-0">
      <li v-for="activity in company.activities" :key="activity.id">
        <span class="t-muted">{{ formatDate(activity.created_at) }}</span> {{ activityText(activity.message) }}
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { t } from "@/i18n";
import { useMuninStore } from "@/stores/munin";
import { useLeadTypesStore } from "@/stores/leadTypes";
import { activityText } from "@/utils/leadsLabels";
import { formatTime } from "@/utils/leadsTime";

const props = defineProps({ company: { type: Object, required: true } });
const route = useRoute();
const leadTypes = useLeadTypesStore();
const hasAccounts = computed(() => useMuninStore().isModuleInstalled("accounts"));
const customerName = computed(() => props.company.customer_name || props.company.customer_uid);
// The customer page's back arrow returns here, to the card it was opened from.
const customerRoute = computed(() => ({
  name: "CustomerDetail",
  params: { uid: props.company.customer_uid },
  query: { back: route.fullPath },
}));
const formatDate = (iso) => formatTime(iso) || "—";
const columns = computed(() => [
  { key: "label", label: t("leads.company.field"), width: "max-content", truncate: false },
  { key: "value", label: t("leads.company.value"), width: "1fr" },
]);
const rows = computed(() => {
  const company = props.company;
  return [
    { key: "name", label: t("leads.company.name"), value: company.name },
    { key: "stage", label: t("leads.company.stage"), value: company.stage.label, testid: "overview-stage" },
    { key: "type", label: t("leads.company.type"), value: leadTypes.label(company.lead_type), testid: "overview-type" },
    { key: "activity", label: t("leads.company.last_activity"), value: formatDate(company.last_activity_at) },
    company.customer_uid && {
      key: "customer",
      label: t("leads.company.customer"),
      value: customerName.value,
      testid: "overview-customer",
    },
  ].filter(Boolean);
});
</script>

<style scoped>
.overview__activities {
  padding-left: var(--space-4);
}
</style>
