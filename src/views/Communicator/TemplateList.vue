<template>
  <PageLayout data-testid="communicator-templates">
    <template #header>
      <PageHeader :title="$t('communicator.templates.title')" :back="{ name: 'LeadsSettings' }" />
    </template>
    <!-- C-13: the whole row opens the template; the key stays a link for the keyboard -->
    <DataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      :row-attrs="() => ({ 'data-testid': 'template-row' })"
      :empty-text="$t('communicator.templates.empty')"
      empty-size="md"
      @row-click="open"
    >
      <template #cell-key="{ row }">
        <router-link class="t-accent" :to="editRoute(row)" @click.stop>{{ row.key }}</router-link>
      </template>
      <template #cell-audience="{ row }">
        <span data-testid="template-audience">{{ row.audience ? leadTypes.label(row.audience) : $t("communicator.template.audience_all") }}</span>
      </template>
      <template #cell-is_active="{ row }">
        <StatusBadge v-if="row.is_active" tone="positive" size="sm" :label="$t('communicator.template.is_active')" />
      </template>
    </DataTable>
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { t } from "@/i18n";
import { GET_Templates } from "@/api/communicator/api";
import { useLeadTypesStore } from "@/stores/leadTypes";
import { useMuninStore } from "@/stores/munin";
import { templateKindLabel } from "@/utils/leadsLabels";

const columns = [
  { key: "key", label: t("communicator.template.key"), width: "1.5fr", truncate: true },
  { key: "kindText", label: t("communicator.template.kind"), width: "max-content" },
  { key: "language", label: t("communicator.template.language"), width: "max-content" },
  { key: "audience", label: t("communicator.template.audience"), width: "1fr", truncate: true, priority: 2 },
  { key: "current_version_id", label: t("communicator.template.version"), numeric: true, priority: 3 },
  { key: "is_active", label: t("communicator.template.is_active"), width: "max-content" },
];

const router = useRouter();
const templates = ref([]);
const leadTypes = useLeadTypesStore();
const rows = computed(() => templates.value.map((tpl) => ({ ...tpl, kindText: templateKindLabel(tpl.kind) })));

const editRoute = (row) => ({ name: "CommunicatorTemplateEdit", params: { id: row.id } });
const open = (row) => router.push(editRoute(row));

onMounted(async () => {
  if (useMuninStore().isModuleEnabled("leads")) leadTypes.load();
  templates.value = (await GET_Templates()).data.results;
});
</script>
