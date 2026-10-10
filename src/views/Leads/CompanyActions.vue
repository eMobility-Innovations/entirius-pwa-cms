<template>
  <div class="flex ai-ct jc-fe wrap gap-3" data-testid="company-actions">
    <router-link
      v-if="company.customer_uid && hasAccounts"
      class="company-actions__customer t-accent"
      :to="{ name: 'CustomerDetail', params: { uid: company.customer_uid }, query: { back: $route.fullPath } }"
      data-testid="company-known-customer"
    >
      {{ $t("leads.company.known_customer") }}<template v-if="company.customer_name">: {{ company.customer_name }}</template>
    </router-link>
    <StatusBadge
      v-else-if="company.customer_uid"
      tone="info"
      :label="$t('leads.company.known_customer')"
      data-testid="company-known-customer"
    />
    <ActionBar :actions="actions" />
    <ConfirmDialog
      :open="confirming"
      tone="danger"
      :title="$t('leads.company.mark_dnc')"
      :message="$t('leads.company.dnc_confirm', { domain: company.domain })"
      :confirm-label="$t('leads.company.mark_dnc')"
      :cancel-label="$t('leads.review.cancel')"
      data-testid="company-dnc-confirm"
      @confirm="markDoNotContact"
      @cancel="confirming = false"
    />
    <BasicModal
      v-model:open="communicating"
      :title="$t('leads.company.communicate')"
      :actions="communicateActions"
      :persistent="sending"
      data-testid="communicate-modal"
    >
      <div class="flex-column gap-4">
        <AiToolboxHint />
        <FormField :label="$t('leads.communicate.template')">
          <BasicSelect v-model="templateKey" :options="templateOptions" data-testid="communicate-template" />
        </FormField>
        <FormField :label="$t('leads.communicate.contact')">
          <BasicRadioGroup v-if="contacts.length" v-model="contactId" :options="contactOptions" name="communicate-contact" />
          <p v-else class="t-muted m-0">{{ $t("leads.communicate.no_contacts") }}</p>
        </FormField>
        <p v-if="communicateError" class="t-negative m-0" role="alert" data-testid="communicate-error">{{ communicateError }}</p>
      </div>
    </BasicModal>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { t } from "@/i18n";
import { PATCH_Company, POST_Communicate, POST_CreateCustomer, POST_RequestAudit } from "@/api/leads/api";
import { GET_Templates } from "@/api/communicator/api";
import { GET_LatestAudit, POST_AuditRerun } from "@/api/siteintel/api";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useMuninStore } from "@/stores/munin";
import { useNotifyStore } from "@/stores/notify";

const props = defineProps({ company: { type: Object, required: true } });
const emit = defineEmits(["changed"]);
const munin = useMuninStore();
const notify = useNotifyStore();
const communicating = ref(false);
const confirming = ref(false);
const templates = ref([]);
const templateKey = ref("");
const contactId = ref(null);
const communicateError = ref("");
const sending = ref(false);

const hasAccounts = computed(() => munin.isModuleInstalled("accounts"));

// R5: secondary · danger · the one primary („Napisz”) rightmost; ActionBar orders them by role.
const actions = computed(() =>
  [
    canCreateCustomer.value && {
      key: "customer",
      label: t("leads.company.create_customer"),
      role: "secondary",
      testid: "company-create-customer",
      onClick: createCustomer,
    },
    { key: "reaudit", label: t("leads.company.reaudit"), role: "secondary", testid: "company-reaudit", onClick: reaudit },
    !props.company.do_not_contact && {
      key: "dnc",
      label: t("leads.company.mark_dnc"),
      role: "danger",
      testid: "company-dnc",
      onClick: () => (confirming.value = true),
    },
    {
      key: "communicate",
      label: t("leads.company.communicate"),
      role: "primary",
      testid: "company-communicate",
      onClick: openCommunicate,
    },
  ].filter(Boolean)
);
// L-15: the won seam exists only with accounts installed.
const canCreateCustomer = computed(
  () => hasAccounts.value && props.company.stage.kind === "won" && !props.company.customer_uid
);

// Manual outreach: an active template + a contact with an email → a draft in the review queue.
const contacts = computed(() => props.company.contacts.filter((c) => c.email && !c.opt_out_at && !c.anonymised_at));
const templateOptions = computed(() =>
  templates.value.map((tpl) => ({ value: tpl.key, label: `${tpl.key} (${tpl.language})` }))
);
const contactOptions = computed(() =>
  contacts.value.map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name} <${c.email}>`,
    testid: "communicate-contact",
  }))
);
const communicateActions = computed(() => [
  {
    key: "cancel",
    label: t("leads.review.cancel"),
    role: "secondary",
    disabled: sending.value,
    onClick: () => (communicating.value = false),
  },
  {
    key: "submit",
    label: t("leads.communicate.submit"),
    role: "primary",
    disabled: sending.value || !templateKey.value || !contactId.value,
    loading: sending.value,
    testid: "communicate-submit",
    onClick: communicate,
  },
]);

// Each open numbers its template request; the answer of an earlier open never lands in a reopened dialog.
let templatesRequest = 0;

async function openCommunicate() {
  const request = ++templatesRequest;
  templateKey.value = "";
  communicateError.value = "";
  templates.value = [];
  contactId.value = contacts.value.find((c) => c.is_primary)?.id ?? null;
  communicating.value = true;
  try {
    const { data } = await GET_Templates();
    if (request === templatesRequest) templates.value = data.results.filter((tpl) => tpl.is_active);
  } catch (err) {
    if (request === templatesRequest) communicateError.value = extractApiMessage(err, t("leads.review.error"));
  }
}

// One draft per click: the dialog is persistent and its actions disabled while the request runs.
async function communicate() {
  if (sending.value) return;
  sending.value = true;
  communicateError.value = "";
  try {
    await POST_Communicate(props.company.id, { template_key: templateKey.value, contact_id: contactId.value });
    notify.spawnNotification({ msg: t("leads.communicate.done") });
    communicating.value = false;
  } catch (err) {
    communicateError.value = extractApiMessage(err, t("leads.review.error"));
  } finally {
    sending.value = false;
  }
}

async function run(call, successKey) {
  try {
    await call();
    notify.spawnNotification({ msg: t(successKey) });
    emit("changed");
  } catch (err) {
    notify.spawnNotification({ msg: extractApiMessage(err, t("leads.review.error")), type: "negative" });
  }
}

// S-09: re-running an audit refreshes the reports; a draft needs an intel_ready rule.
function reaudit() {
  return run(async () => {
    const audit = await GET_LatestAudit(props.company.domain);
    await (audit ? POST_AuditRerun(audit.id) : POST_RequestAudit(props.company.id));
  }, "leads.company.reaudit_done");
}

function markDoNotContact() {
  confirming.value = false;
  return run(() => PATCH_Company(props.company.id, { do_not_contact: true }), "leads.company.dnc_done");
}

function createCustomer() {
  return run(() => POST_CreateCustomer(props.company.id), "leads.company.customer_done");
}
</script>

<style scoped>
/* C-43: the customer link reads at body size and keeps a 32 px target. */
.company-actions__customer {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  text-decoration: underline;
}
</style>
