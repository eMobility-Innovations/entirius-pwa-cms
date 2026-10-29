<template>
  <PageLayout>
    <template #header>
      <PageHeader :title="$t('leads.add.title')">
        <template #actions>
          <ActionBar :actions="actions" />
        </template>
      </PageHeader>
    </template>
    <form
      class="add-lead flex-column gap-8"
      data-testid="add-lead"
      novalidate
      @submit.prevent="save"
      @keydown.enter="saveFromField"
    >
      <!-- the company is saved; only its contact failed — it stays here, one tap from the card -->
      <p v-if="company" class="add-lead__saved" role="status" data-testid="add-lead-company-saved">
        {{ $t("leads.add.company_saved") }}
        <router-link class="t-accent" :to="cardRoute(company.id)">{{ company.name }}</router-link>
      </p>

      <BasicCard :title="$t('leads.add.company')" gap>
        <div class="form-grid">
          <FormField :label="$t('leads.add.domain')" required :disabled="Boolean(company)" :error="fieldError('domain')">
            <BasicInput
              v-model.trim="form.domain"
              :maxlength="253"
              inputmode="url"
              autocomplete="off"
              :placeholder="$t('leads.add.domain_hint')"
              data-testid="add-lead-domain"
            />
          </FormField>
          <FormField :label="$t('leads.add.name')" :disabled="Boolean(company)">
            <BasicInput v-model.trim="form.name" :maxlength="255" autocomplete="off" data-testid="add-lead-name" />
          </FormField>
          <FormField :label="$t('leads.add.lead_type')" :disabled="Boolean(company)" :error="fieldError('lead_type')">
            <BasicSelect v-model="form.lead_type" :options="typeOptions" data-testid="add-lead-type" />
          </FormField>
        </div>
        <p v-if="existing" class="t-negative m-0" data-testid="add-lead-exists">
          {{ $t("leads.add.exists") }}
          <router-link class="t-accent" :to="cardRoute(existing.id)">{{ existing.name || existing.domain }}</router-link>
        </p>
      </BasicCard>

      <BasicCard :title="$t('leads.add.contact')" gap>
        <ContactFields :form="form" :error-of="fieldError" testid="add-lead" />
      </BasicCard>

      <p v-if="error" class="t-negative m-0" data-testid="add-lead-error">{{ error }}</p>
    </form>
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { t } from "@/i18n";
import { GET_Companies, POST_Company, POST_Contact } from "@/api/leads/api";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import { useLeadTypesStore } from "@/stores/leadTypes";
import ContactFields from "./ContactFields.vue";

// One lead by hand (UX-006): the company, then its contact — the two creates the API offers, so the company lands
// where an imported row lands (first stage, "company created"). Legal basis stays optional as in the import: the
// outreach gate refuses a contact without one. The rest (phone, job title, industry) lives on the company card.
const CONTACT_FIELDS = ["email", "first_name", "last_name", "legal_basis", "consent_ref"];

const router = useRouter();
const { handleApiError, getFieldError, clearErrors } = useFormErrors();
const form = reactive({ domain: "", name: "", lead_type: "UNKNOWN", email: "", first_name: "", last_name: "", legal_basis: "", consent_ref: "" });
const leadTypes = useLeadTypesStore();
const company = ref(null); // set once the company exists — a retry saves the contact only
const existing = ref(null);
const error = ref("");
const busy = ref(false);

const cardRoute = (id) => ({ name: "LeadsThread", params: { id } });
const typeOptions = computed(() => [
  { value: "UNKNOWN", label: t("leads.lead_types.unknown") },
  ...leadTypes.active.map((type) => ({ value: type.code, label: type.label })),
]);

// R5: Cancel (until the company exists), then the one primary, Save, rightmost.
const actions = computed(() =>
  [
    !company.value && {
      key: "cancel",
      label: t("common.cancel"),
      role: "secondary",
      testid: "add-lead-cancel",
      onClick: () => router.push({ name: "LeadsCompanies" }),
    },
    {
      key: "save",
      label: t(company.value ? "leads.add.save_contact" : "leads.add.save"),
      role: "primary",
      testid: "add-lead-save",
      disabled: busy.value || !form.domain,
      onClick: save,
    },
  ].filter(Boolean)
);
const fieldError = (name) => getFieldError(name)?.msg || "";
const errorCode = (err) => (err?.response?.data || err)?.error || "";
const hasContact = () => ["email", "first_name", "last_name"].some((field) => form[field]);

// The host a user typed ("https://www.shop.pl/x" → "shop.pl") — enough to find the company that already holds it.
const hostOf = (value) => value.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./i, "").toLowerCase();

async function findExisting() {
  const host = hostOf(form.domain);
  const { data } = await GET_Companies({ search: host });
  return (data.results || []).find((row) => host === row.domain || host.endsWith(`.${row.domain}`)) || null;
}

async function createCompany() {
  const body = { domain: form.domain, lead_type: form.lead_type, ...(form.name ? { name: form.name } : {}) };
  try {
    company.value = (await POST_Company(body)).data;
    return true;
  } catch (err) {
    if (errorCode(err) === "DOMAIN_EXISTS") {
      existing.value = await findExisting().catch(() => null);
      if (!existing.value) error.value = t("leads.add.exists");
      return false;
    }
    handleApiError(err);
    if (!fieldError("domain") && !fieldError("lead_type")) error.value = extractApiMessage(err, t("leads.review.error"));
    return false;
  }
}

async function createContact() {
  const body = Object.fromEntries(CONTACT_FIELDS.filter((field) => form[field]).map((field) => [field, form[field]]));
  try {
    await POST_Contact({ company_id: company.value.id, ...body });
    return true;
  } catch (err) {
    handleApiError(err);
    error.value = extractApiMessage(err, t("leads.review.error"));
    return false;
  }
}

// Enter in a text field saves, as the form's own submit button did before Save moved into the PageHeader.
function saveFromField(event) {
  if (event.target.tagName !== "INPUT" || busy.value || !form.domain) return;
  event.preventDefault();
  save();
}

async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  existing.value = null;
  clearErrors();
  try {
    if (!company.value && !(await createCompany())) return;
    if (hasContact() && !(await createContact())) return;
    router.push(cardRoute(company.value.id));
  } finally {
    busy.value = false;
  }
}

onMounted(() => leadTypes.load()); // a failed load leaves Unknown only
</script>

<style scoped>
.add-lead {
  max-width: 48rem;
}
.add-lead__saved {
  margin: 0;
  padding: var(--space-5) var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
</style>
