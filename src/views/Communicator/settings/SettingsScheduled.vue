<template>
  <BasicCard :title="$t('communicator.scheduled.title')" gap data-testid="settings-scheduled">
    <p class="t-muted m-0">{{ $t("communicator.scheduled.note") }}</p>
    <DataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      :row-attrs="(row) => ({ 'data-testid': 'scheduled-row', 'data-message': row.id })"
      :empty-text="$t('communicator.scheduled.empty')"
    >
      <template #cell-company="{ row }">
        <span class="scheduled__who flex-column">
          <span class="scheduled__line">{{ row.company }}</span>
          <span class="scheduled__line t-muted" data-testid="scheduled-recipient">{{ recipient(row) || "—" }}</span>
        </span>
      </template>
      <template #cell-state="{ row }">
        <StatusBadge tone="info" size="sm" :dot="false" :label="sendStateLabel(row.state)" data-testid="scheduled-state" />
      </template>
      <template #cell-action="{ row }">
        <BasicButton mutates v-if="row.movable" size="sm" data-testid="scheduled-send-now" @click="sendNow(row)">
          {{ $t("communicator.scheduled.send_now") }}
        </BasicButton>
        <span v-else class="t-muted" data-testid="scheduled-asap">{{ $t("communicator.scheduled.asap") }}</span>
      </template>
    </DataTable>
    <p v-if="error" class="t-negative m-0" role="alert">{{ error }}</p>
  </BasicCard>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { t } from "@/i18n";
import { GET_Policy, GET_WaitingMessages, POST_SendNow } from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { sendStateLabel, statusLabel } from "@/utils/leadsLabels";
import { applyPolicy, canSendNow, sendState } from "@/utils/leadsTime";

// Waiting messages (approved + scheduled) with the one slot every screen reads, `next_slot`. C-31: Send now only
// pulls `scheduled_at` to the channel clock; the next send run sends. A mail already at the clock cannot be moved
// any earlier, so it offers no second Send now — its state says what still holds it.
const waiting = ref([]);
const error = ref("");

const rows = computed(() =>
  waiting.value.map((row) => ({
    ...row,
    company: companyName(row),
    statusText: statusLabel(row.status),
    state: sendState(row.next_slot),
    movable: canSendNow(row),
  }))
);

// C-31: the recipient sits under the company, the text cells truncate and the action column never shrinks, so
// Send now stays inside the card at 1280 px with the sidebar open.
const columns = [
  { key: "company", label: `${t("communicator.scheduled.company")} · ${t("communicator.scheduled.recipient")}`, width: "1fr", truncate: true },
  { key: "subject", label: t("communicator.template.subject"), width: "1fr", priority: 3 },
  { key: "statusText", label: t("communicator.scheduled.status"), width: "max-content", truncate: false, priority: 2 },
  { key: "state", label: t("communicator.scheduled.goes_out"), width: "max-content" },
  { key: "action", label: "", actions: true },
];

const recipient = (row) => row.thread?.recipient_email || row.thread?.recipient_name || "";

// Never an internal contact code: the company of the draft, else who it is addressed to.
const companyName = (row) => row.render_context?.company_name || recipient(row) || "—";

async function load() {
  const [mails, policy] = await Promise.all([GET_WaitingMessages(), GET_Policy().catch(() => null)]);
  applyPolicy(policy?.data);
  waiting.value = mails;
}

async function sendNow(row) {
  error.value = "";
  try {
    await POST_SendNow(row.id);
    await load();
  } catch (err) {
    error.value = extractApiMessage(err, t("leads.review.error"));
  }
}

onMounted(load);
</script>

<style scoped>
.scheduled__who {
  min-width: 0;
  max-width: 100%;
}
.scheduled__line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
