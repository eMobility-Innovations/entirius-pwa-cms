<template>
  <Thread v-if="!isDesktop" desktop-hint />
  <PageLayout v-else data-testid="company-card">
    <template #header>
      <PageHeader :title="$t('leads.company.title')">
        <template v-if="company" #actions>
          <CompanyActions :company="company" @changed="reload" />
        </template>
      </PageHeader>
    </template>
    <p v-if="loadError" class="t-negative m-0" role="alert" data-testid="company-load-error">{{ loadError }}</p>
    <Loader v-else-if="!company" block />
    <template v-else>
      <AiToolboxHint />
      <header class="company__head flex ai-fe wrap gap-5">
        <div class="company__name flex-column gap-1">
          <h2 class="fs-500 fw-600 m-0" data-testid="thread-company">{{ company.name }}</h2>
          <span class="t-muted fs-200" data-testid="company-domain">{{ company.domain }}</span>
        </div>
        <StatusBadge
          v-if="company.do_not_contact"
          tone="negative"
          :label="$t('leads.company.do_not_contact')"
          data-testid="company-dnc-badge"
        />
        <div class="company__selects flex ai-fe wrap gap-3">
          <BasicSelect
            class="company__select"
            :model-value="company.stage.key"
            :options="stageOptions"
            :floating-label="$t('leads.company.stage')"
            data-testid="company-stage"
            @update:model-value="transition"
          />
          <BasicSelect
            class="company__select"
            :model-value="company.lead_type"
            :options="typeOptions"
            :floating-label="$t('leads.company.type')"
            data-testid="company-lead-type"
            @update:model-value="retype"
          />
        </div>
      </header>
      <BasicTabs class="company__tabs" id-prefix="company" :options="tabOptions" :model-value="tab" @update:model-value="openTab" />
      <div :id="`company-panel-${tab}`" role="tabpanel" :aria-labelledby="`company-tab-${tab}`">
        <OverviewTab v-if="tab === 'overview'" :company="company" />
        <IntelTab v-else-if="tab === 'intel'" :company="company" />
        <ContactsTab v-else-if="tab === 'contacts'" :company="company" @changed="reload" />
        <Thread v-else />
      </div>
    </template>
  </PageLayout>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { t } from "@/i18n";
import { GET_Company, GET_Stages, PATCH_Company, POST_Transition } from "@/api/leads/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useIsDesktop } from "@/composables/useIsDesktop";
import { useLeadTypesStore } from "@/stores/leadTypes";
import { useNotifyStore } from "@/stores/notify";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import CompanyActions from "./CompanyActions.vue";
import Thread from "./Thread.vue";
import ContactsTab from "./tabs/ContactsTab.vue";
import IntelTab from "./tabs/IntelTab.vue";
import OverviewTab from "./tabs/OverviewTab.vue";

// Company card: the plan-13 thread on a phone; from 1024 px the page frame (actions in the PageHeader), the card
// header (name, domain, stage and lead-type selects) and the tabs.
const TABS = ["overview", "intel", "contacts", "timeline"];
const route = useRoute();
const router = useRouter();
const notify = useNotifyStore();
const isDesktop = useIsDesktop();
const company = ref(null);
const loadError = ref("");
const stages = ref([]);
const leadTypes = useLeadTypesStore();
// The active types, plus the company's own type when it was deactivated since (it still reads, it is not offered).
const typeOptions = computed(() => {
  const code = company.value?.lead_type;
  const own = code && code !== "UNKNOWN" && !leadTypes.active.some((type) => type.code === code);
  const types = own ? [...leadTypes.active, { code, label: leadTypes.label(code) }] : leadTypes.active;
  return [
    { value: "UNKNOWN", label: t("leads.lead_types.unknown") },
    ...types.map((type) => ({ value: type.code, label: type.label })),
  ];
});
const stageOptions = computed(() => stages.value.map((stage) => ({ value: stage.key, label: stage.label })));

const tab = computed(() => (TABS.includes(route.query.tab) ? route.query.tab : "overview"));
const tabOptions = TABS.map((value) => ({ value, label: t(`leads.company.tabs.${value}`), testid: `company-tab-${value}` }));

function openTab(value) {
  router.replace({ query: { ...route.query, tab: value } });
}

// Every open() numbers the card (plan 61c): an answer of an earlier open — another company, or this one opened again
// meanwhile — is dropped, so it never shows or acts under the URL the user is on now.
let opened = 0;
const isCurrent = (opening) => opening === opened;

async function load() {
  const opening = opened;
  const [companyRes, stageRes] = await Promise.all([GET_Company(route.params.id), GET_Stages(), leadTypes.load()]);
  if (!isCurrent(opening)) return;
  company.value = companyRes.data;
  stages.value = stageRes.data.results;
}

// A reload of the open card (after an action or a refused change): a failure leaves the card as it was and says the
// card could not be refreshed — the action itself went through.
async function reload() {
  const opening = opened;
  try {
    await load();
  } catch (err) {
    if (!isCurrent(opening)) return;
    notify.spawnNotification({ msg: extractApiMessage(err, t("leads.company.refresh_failed")), type: "negative" });
  }
}

// A stage move or a type change: its answer replaces the card while the card is still open; a refusal reloads it.
async function change(request, failedMessage) {
  const opening = opened;
  try {
    const { data } = await request();
    if (isCurrent(opening)) company.value = data;
  } catch (err) {
    if (!isCurrent(opening)) return;
    notify.spawnNotification({ msg: extractApiMessage(err, failedMessage), type: "negative" });
    await reload();
  }
}

function transition(stageKey) {
  if (stageKey === company.value.stage.key) return; // the current stage picked again: no move
  return change(() => POST_Transition(company.value.id, stageKey), t("leads.board.move_failed"));
}

function retype(code) {
  if (code === company.value.lead_type) return;
  return change(() => PATCH_Company(company.value.id, { lead_type: code }), t("leads.review.error"));
}

// The header stands while the card loads and when it fails; only its actions wait for the company.
// Another company: the previous one's card and header actions go until the new one arrives.
async function open() {
  const opening = ++opened;
  company.value = null;
  loadError.value = "";
  try {
    await load();
  } catch (err) {
    if (isCurrent(opening)) loadError.value = extractApiMessage(err, t("leads.review.error"));
  }
}

watch(
  () => [isDesktop.value, route.params.id],
  ([desktop, id]) => desktop && id && open(),
  { immediate: true }
);
</script>

<style scoped>
.company__head {
  margin-bottom: var(--space-6);
}
.company__name {
  flex: 1 1 16rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.company__select {
  width: 14rem;
}
.company__tabs {
  margin-bottom: var(--space-6);
}
</style>
