<template>
  <!-- alone: a page (PageHeader + Add); in the Inbox column the toggle above already says "Companies" -->
  <component :is="embedded ? 'div' : PageLayout" class="companies" data-testid="leads-companies">
    <template v-if="!embedded" #header>
      <PageHeader :title="$t('leads.companies.title')">
        <template #actions>
          <ActionBar :actions="[addAction]" />
        </template>
      </PageHeader>
    </template>
    <div class="companies__body">
      <!-- C-18: the search takes its own full-width row, so its placeholder is never cut -->
      <div class="flex ai-ct jc-fe flex-wrap gap-3">
        <BasicButton v-if="embedded" variant="primary" data-testid="companies-add" @click="addAction.onClick">
          {{ addAction.label }}
        </BasicButton>
        <label class="companies__search">
          <span class="visually-hidden">{{ $t("leads.board.search") }}</span>
          <ReadonlyOff>
            <BasicInput
              v-model="search"
              type="search"
              icon="search"
              :placeholder="$t('leads.board.search')"
              data-testid="companies-search"
              @on-key-down="load()"
            />
          </ReadonlyOff>
        </label>
      </div>
      <EmptyState
        v-if="!loading && !companies.length"
        icon="empty"
        size="sm"
        :title="$t('leads.companies.empty')"
        data-testid="companies-empty"
      />
      <div class="companies__list">
        <router-link
          v-for="company in companies"
          :key="company.id"
          :to="{ name: 'LeadsThread', params: { id: company.id } }"
          class="company-row"
          :class="{ 'company-row--active': isActive(company) }"
          active-class=""
          exact-active-class=""
          data-testid="companies-item"
        >
          <span class="company-row__domain">{{ company.name || company.domain }}</span>
          <span class="t-muted fs-200">{{ company.stage?.label }} · {{ formatTime(company.last_activity_at) || "—" }}</span>
        </router-link>
      </div>
      <BasicButton v-if="next" class="companies__more" :loading="loading" data-testid="companies-more" @click="load(page + 1)">
        {{ $t("leads.board.more") }}
      </BasicButton>
    </div>
  </component>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageLayout from "@/boots/PageLayout/index.vue";
import { t } from "@/i18n";
import { GET_Companies } from "@/api/leads/api";
import { formatTime } from "@/utils/leadsTime";
import { ReadonlyOff } from "@/composables/useReadonly";

// Company list that works below 1024 px: the Leads entry when communicator (the Inbox) is absent, else the
// Companies side of the Inbox column (`embedded`), next to the card it opened.
defineProps({ embedded: { type: Boolean, default: false } });
const route = useRoute();
const router = useRouter();
const addAction = computed(() => ({
  key: "add",
  label: t("leads.add.open"),
  role: "primary",
  testid: "companies-add",
  onClick: () => router.push({ name: "LeadsCompanyNew" }),
}));
const isActive = (company) => route.name === "LeadsThread" && String(route.params.id) === String(company.id);
const companies = ref([]);
const search = ref("");
const page = ref(1);
const next = ref(null);
const loading = ref(false);

async function load(nextPage = 1) {
  loading.value = true;
  try {
    const { data } = await GET_Companies({ search: search.value, sort: "-last_activity_at", page: nextPage });
    companies.value = nextPage > 1 ? [...companies.value, ...data.results] : data.results;
    next.value = data.next;
    page.value = nextPage;
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
</script>

<style scoped>
.companies__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
div.companies {
  padding: var(--space-8);
}
.companies__more {
  align-self: flex-start;
}
.companies__search {
  flex: 1 1 100%;
  min-width: 0;
}
.companies__list {
  display: flex;
  flex-direction: column;
}
.company-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-height: 44px;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  color: inherit;
  text-decoration: none;
}
/* The open card's row: a 3 px accent edge inside the row's own padding, so the text does not move. */
.company-row--active {
  padding-left: calc(var(--space-4) - 3px);
  border-left: 3px solid var(--focus-ring);
  background: var(--surface-raised);
}
.company-row__domain {
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
