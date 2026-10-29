<template>
  <div class="contacts flex-column gap-8" data-testid="contacts-tab">
    <!-- one form at a time: a new contact, or the one in edit (its row stays in the table below) -->
    <form
      v-if="mode"
      class="contacts__form flex-column gap-5"
      :data-testid="editing ? 'contact-edit-form' : 'contact-add-form'"
      novalidate
      @submit.prevent="save(editing)"
    >
      <p class="fs-400 fw-600 m-0">{{ editing ? nameOf(editing) : $t("leads.contacts.add") }}</p>
      <ContactFields
        :form="draft"
        :error-of="fieldError"
        :testid="editing ? 'contact-edit' : 'contact-new'"
        full
        :email-locked="Boolean(editing?.email)"
        :consent-recorded="editing?.legal_basis === 'consent'"
      />
      <p v-if="error" class="t-negative m-0" data-testid="contact-error">{{ error }}</p>
      <div class="flex ai-ct jc-fe gap-3">
        <BasicButton variant="ghost" data-testid="contact-cancel" @click="close">{{ $t("common.cancel") }}</BasicButton>
        <BasicButton type="submit" :loading="busy" data-testid="contact-save">{{ $t("common.save") }}</BasicButton>
      </div>
    </form>
    <div v-else class="flex jc-fe">
      <BasicButton data-testid="contact-add" @click="open('add')">{{ $t("leads.contacts.add") }}</BasicButton>
    </div>
    <p v-if="status" class="t-muted m-0" role="status" data-testid="contact-status">{{ status }}</p>

    <DataTable
      :columns="columns"
      :rows="company.contacts"
      row-key="id"
      :row-attrs="rowAttrs"
      data-testid="company-contacts"
    >
      <template #cell-is_primary="{ row }">
        <IconButton mutates
          v-if="!row.anonymised_at"
          icon="primary"
          size="sm"
          :label="$t(row.is_primary ? 'leads.contacts.primary' : 'leads.contacts.make_primary')"
          :pressed="row.is_primary"
          :disabled="busy"
          :data-contact="row.id"
          data-testid="contact-primary"
          @click="togglePrimary(row)"
        />
      </template>
      <!-- one cell per person (name, job title, email): the card's column is narrow next to the Inbox list -->
      <template #cell-name="{ row }">
        <span class="contacts__person" :class="{ 't-muted': row.anonymised_at }">
          {{ row.first_name }} {{ row.last_name }}
          <span v-if="row.job_title" class="t-muted fs-200">{{ row.job_title }}</span>
          <span v-if="row.email" class="contacts__email fs-200">{{ row.email }}</span>
        </span>
      </template>
      <template #cell-legal_basis="{ row }">
        <span class="flex flex-wrap gap-1">
          <StatusBadge v-if="row.anonymised_at" tone="neutral" :dot="false" :label="$t('leads.contacts.anonymised')" />
          <StatusBadge v-else-if="row.legal_basis" tone="info" :dot="false" :label="legalBasisLabel(row.legal_basis)" />
          <StatusBadge
            v-if="isSuppressed(row)"
            tone="warning"
            :dot="false"
            :label="$t('leads.contacts.suppressed')"
            data-testid="contact-suppressed"
          />
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div v-if="!row.anonymised_at" class="flex ai-ct gap-2">
          <BasicButton variant="ghost" size="sm" :data-contact="row.id" data-testid="contact-edit" @click="open(row.id, row)">
            {{ $t("common.edit") }}
          </BasicButton>
          <IconButton
            icon="delete"
            variant="danger"
            size="sm"
            :label="$t('leads.contacts.remove')"
            :data-contact="row.id"
            data-testid="contact-remove"
            @click="confirming = row"
          />
        </div>
      </template>
    </DataTable>

    <ConfirmDialog
      :open="Boolean(confirming)"
      :title="confirming ? $t('leads.contacts.remove_title', { name: nameOf(confirming) }) : ''"
      :message="$t('leads.contacts.remove_message')"
      :confirm-label="$t('leads.contacts.remove')"
      :cancel-label="$t('common.cancel')"
      tone="danger"
      @confirm="remove(confirming)"
      @cancel="confirming = null"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { t } from "@/i18n";
import { GET_Suppressions } from "@/api/communicator/api";
import { DELETE_Contact, PATCH_Contact, POST_Contact } from "@/api/leads/api";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import { legalBasisLabel } from "@/utils/leadsLabels";
import ContactFields from "../ContactFields.vue";

// Contacts of the company card (UX-011): add, edit, remove, primary star — one form open at a time, above the table.
// Remove answers 204 (never used, deleted) or 200 (used, anonymised: the thread and timeline keep it), and the line
// under the button says which. An anonymised row is history only: no star, no edit, no remove.
// Suppressed = opted out, anonymised, or the email/domain on the communicator suppression list.
const props = defineProps({ company: { type: Object, required: true } });
const emit = defineEmits(["changed"]);

const TEXT = [
  "email",
  "first_name",
  "last_name",
  "job_title",
  "phone",
  "language",
  "legal_basis",
];
const NULLABLE = ["language", "legal_basis"]; // "" clears them as null; the other text fields clear as ""
const { errors, handleApiError, getFieldError, clearErrors } = useFormErrors();
const suppressed = ref(new Set());
const mode = ref(null); // null | "add" | the id of the contact in edit
const draft = reactive({});
const confirming = ref(null);
const busy = ref(false);
const error = ref("");
const status = ref("");

const fieldError = (name) => getFieldError(name)?.msg || "";
// The contact in edit (mode = its id), null while adding or closed.
const editing = computed(() => props.company.contacts.find((contact) => contact.id === mode.value) || null);
const columns = computed(() => [
  { key: "is_primary", label: t("leads.contacts.primary"), width: "max-content" },
  { key: "name", label: t("leads.contacts.name"), width: "1fr" },
  { key: "legal_basis", label: t("leads.contacts.legal_basis"), width: "max-content" },
  { key: "actions", label: t("leads.contacts.actions"), actions: true },
]);
// The row carries the test id, so a contact's star, Edit and Remove are found inside its row.
const rowAttrs = (contact) => ({ "data-testid": "contact-row", "data-contact": contact.id });
const nameOf = (contact) =>
  `${contact.first_name} ${contact.last_name}`.trim() || contact.email || "—";
const valuesOf = (contact) => ({
  ...Object.fromEntries(TEXT.map((field) => [field, contact?.[field] || ""])),
  consent_ref: "",
  is_primary: Boolean(contact?.is_primary),
});

function isSuppressed(contact) {
  if (contact.opt_out_at || contact.anonymised_at) return true;
  return (
    suppressed.value.has(contact.email.toLowerCase()) ||
    suppressed.value.has(props.company.domain)
  );
}

function open(next, contact = null) {
  Object.assign(draft, valuesOf(contact));
  mode.value = next;
  error.value = "";
  status.value = "";
  clearErrors();
}

const close = () => (mode.value = null);

// A create sends what is filled; an edit sends what changed — "" clears, as null for language and legal basis.
function bodyOf(contact) {
  const before = valuesOf(contact);
  const changed = TEXT.filter((field) => draft[field] !== before[field]);
  const body = Object.fromEntries(
    changed.map((field) => [
      field,
      NULLABLE.includes(field) ? draft[field] || null : draft[field],
    ])
  );
  if (body.language) body.language = body.language.toLowerCase();
  if (draft.is_primary !== before.is_primary)
    body.is_primary = draft.is_primary;
  if (body.legal_basis === "consent") body.consent_ref = draft.consent_ref;
  if (!contact)
    return Object.fromEntries(
      Object.entries(body).filter(
        ([, value]) => value !== null && value !== false
      )
    );
  return body;
}

function showError(err) {
  handleApiError(err);
  const code = (err?.response?.data || err)?.error;
  if (code === "CONTACT_EXISTS")
    errors.email = { status: "error", msg: t("leads.contacts.exists") };
  const onField = Object.keys(errors).some((field) => field in draft);
  error.value = onField ? "" : extractApiMessage(err, t("leads.review.error"));
}

async function save(contact) {
  if (busy.value) return;
  const body = bodyOf(contact);
  if (contact && !Object.keys(body).length) return close();
  busy.value = true;
  error.value = "";
  clearErrors();
  try {
    await (contact
      ? PATCH_Contact(contact.id, body)
      : POST_Contact({ company_id: props.company.id, ...body }));
    status.value = t(contact ? "leads.contacts.saved" : "leads.contacts.added");
    close();
    emit("changed");
  } catch (err) {
    showError(err);
  } finally {
    busy.value = false;
  }
}

async function run(call, done) {
  busy.value = true;
  status.value = "";
  try {
    status.value = done(await call());
    emit("changed");
  } catch (err) {
    status.value = extractApiMessage(err, t("leads.review.error"));
  } finally {
    busy.value = false;
  }
}

const togglePrimary = (contact) =>
  run(
    () => PATCH_Contact(contact.id, { is_primary: !contact.is_primary }),
    () => ""
  );

// 204 = never used, deleted; 200 = used, so the API anonymised it instead.
function remove(contact) {
  confirming.value = null;
  if (mode.value === contact.id) close();
  return run(
    () => DELETE_Contact(contact.id),
    (response) =>
      t(
        response?.status === 204
          ? "leads.contacts.removed"
          : "leads.contacts.anonymised_done"
      )
  );
}

onMounted(async () => {
  const { data } = await GET_Suppressions();
  suppressed.value = new Set(data.results.map((row) => row.value));
});
</script>

<style scoped>
.contacts__form {
  max-width: 48rem;
}
.contacts__person {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.contacts__email {
  overflow-wrap: anywhere;
}
</style>
