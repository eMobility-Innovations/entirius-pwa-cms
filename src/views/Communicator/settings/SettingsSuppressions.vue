<template>
  <BasicCard :title="$t('communicator.suppressions.title')" gap data-testid="settings-suppressions">
    <form class="flex ai-fe flex-wrap gap-5" @submit.prevent="add">
      <FormField :label="$t('communicator.suppressions.kind')">
        <BasicSelect v-model="draft.kind" :options="kindOptions" data-testid="suppression-kind" />
      </FormField>
      <FormField :label="$t('communicator.suppressions.value')" required>
        <BasicInput v-model="draft.value" :maxlength="254" data-testid="suppression-value" />
      </FormField>
      <FormField :label="$t('communicator.suppressions.reason')">
        <BasicInput v-model="draft.reason" :maxlength="255" data-testid="suppression-reason" />
      </FormField>
      <BasicButton type="submit" data-testid="suppression-add">{{ $t("communicator.suppressions.add") }}</BasicButton>
    </form>
    <p v-if="error" class="t-negative m-0" role="alert">{{ error }}</p>
    <DataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      :row-attrs="() => ({ 'data-testid': 'suppression-row' })"
      :empty-text="$t('communicator.suppressions.empty')"
    >
      <template #cell-action="{ row }">
        <IconButton mutates
          v-if="row.kind !== 'email_token'"
          icon="delete"
          variant="danger"
          size="sm"
          :label="$t('leads.stages.delete')"
          @click="remove(row.id)"
        />
      </template>
    </DataTable>
  </BasicCard>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { t } from "@/i18n";
import { DELETE_Suppression, GET_Suppressions, POST_Suppression } from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { suppressionKindLabel } from "@/utils/leadsLabels";

// Suppression list; global email_token rows (erased addresses) are listed but never removable here.
const KINDS = ["email", "domain"];
const kindOptions = KINDS.map((value) => ({ value, label: suppressionKindLabel(value) }));
const columns = [
  { key: "kindText", label: t("communicator.suppressions.kind"), width: "max-content" },
  { key: "value", label: t("communicator.suppressions.value"), width: "1fr" },
  { key: "reason", label: t("communicator.suppressions.reason"), width: "1fr", priority: 2 },
  { key: "action", label: "", actions: true },
];
const list = ref([]);
const rows = computed(() => list.value.map((row) => ({ ...row, kindText: suppressionKindLabel(row.kind) })));
const error = ref("");
const draft = reactive({ kind: "email", value: "", reason: "" });

async function load() {
  list.value = (await GET_Suppressions()).data.results;
}

async function attempt(call) {
  error.value = "";
  try {
    await call();
    await load();
    return true;
  } catch (err) {
    error.value = extractApiMessage(err, t("leads.review.error"));
    return false;
  }
}

async function add() {
  if (await attempt(() => POST_Suppression({ ...draft }))) Object.assign(draft, { value: "", reason: "" });
}

const remove = (id) => attempt(() => DELETE_Suppression(id));

onMounted(load);
</script>
