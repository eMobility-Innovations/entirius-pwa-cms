<template>
  <PageLayout data-testid="communicator-template-edit">
    <template v-if="loaded" #header>
      <PageHeader :title="form.key" :back="{ name: 'CommunicatorTemplates' }">
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>
    <form v-if="loaded" :id="FORM_ID" class="template-form flex-column gap-4" @submit.prevent="save">
      <BasicCard :title="$t('communicator.template.title')" gap>
        <AiToolboxHint v-if="form.kind === 'ai_prompt'" />
        <div class="form-grid">
          <FormField :label="$t('communicator.template.kind')">
            <BasicSelect v-model="form.kind" :options="kindOptions" data-testid="template-kind" />
          </FormField>
          <FormField :label="$t('communicator.template.language')" required>
            <BasicInput v-model="form.language" :maxlength="2" data-testid="template-language" />
          </FormField>
          <!-- the lead type this variant is for (audience cascade); without leads the value travels back unchanged -->
          <FormField v-if="hasLeads" :label="$t('communicator.template.audience')" :hint="$t('communicator.template.audience_help')">
            <BasicSelect v-model="form.audience" :options="audienceOptions" data-testid="template-audience" />
          </FormField>
          <FormField :label="$t('communicator.template.model')">
            <BasicSelect v-model="form.model" :options="modelOptions" :disabled="!configHealth.aiUsable" data-testid="template-model" />
          </FormField>
          <FormField class="form-grid__wide" :label="$t('communicator.template.subject')">
            <BasicInput v-model="form.subject" :maxlength="255" data-testid="template-subject" />
          </FormField>
          <FormField class="form-grid__wide" :label="$t('communicator.template.body')" required>
            <BasicTextarea v-model="form.body" :rows="10" data-testid="template-body" />
          </FormField>
          <FormField class="form-grid__wide" :label="$t('communicator.template.json_schema')">
            <BasicTextarea v-model="schemaText" :rows="6" data-testid="template-schema" />
          </FormField>
        </div>
        <p v-if="schemaError" class="t-negative m-0" role="alert" data-testid="template-schema-error">{{ schemaError }}</p>
        <BasicCheckbox v-model="form.requires_legal_footer">{{ $t("communicator.template.requires_legal_footer") }}</BasicCheckbox>
        <BasicCheckbox v-model="form.is_active">{{ $t("communicator.template.is_active") }}</BasicCheckbox>
        <p class="t-muted m-0" data-testid="template-auto-approve">
          {{ $t("communicator.template.auto_approve") }}: {{ form.auto_approve ? "✓" : "✗" }} — {{ $t("communicator.template.grappelli") }}
        </p>
      </BasicCard>
      <p v-if="error" class="t-negative m-0" role="alert">{{ error }}</p>
    </form>
    <SideDrawer :visible="drawer === 'versions'" :title="$t('communicator.template.versions')" @close="drawer = ''">
      <TemplateVersions v-if="drawer === 'versions'" :template-id="templateId" />
    </SideDrawer>
    <SideDrawer :visible="drawer === 'test'" :title="$t('communicator.template.test_generate')" @close="drawer = ''">
      <TestGenerate v-if="drawer === 'test'" :template-id="templateId" />
    </SideDrawer>
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { t } from "@/i18n";
import { GET_Models, GET_Template, PUT_Template } from "@/api/communicator/api";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useConfigHealthStore } from "@/stores/configHealth";
import { useLeadTypesStore } from "@/stores/leadTypes";
import { useMuninStore } from "@/stores/munin";
import { useNotifyStore } from "@/stores/notify";
import { templateKindLabel } from "@/utils/leadsLabels";
import TemplateVersions from "./TemplateVersions.vue";
import TestGenerate from "./TestGenerate.vue";

// auto_approve is read-only here (set in Grappelli); it is sent back unchanged.
const FIELDS = ["key", "kind", "language", "audience", "subject", "body", "model", "requires_legal_footer", "auto_approve", "is_active"];
const route = useRoute();
const notify = useNotifyStore();
const leadTypes = useLeadTypesStore();
const configHealth = useConfigHealthStore();
// A communicator before template audiences sends none and refuses the field (extra="forbid") — then it is never shown.
const supportsAudience = ref(false);
const hasLeads = computed(() => supportsAudience.value && useMuninStore().isModuleEnabled("leads"));
// Active lead types, plus the template's own audience when that type was deactivated (it stays selectable).
const audiences = computed(() => {
  const own = form.audience && !leadTypes.active.some((type) => type.code === form.audience);
  return own ? [...leadTypes.active, { code: form.audience, label: leadTypes.label(form.audience) }] : leadTypes.active;
});
const audienceOptions = computed(() => [
  { value: "", label: t("communicator.template.audience_all") },
  ...audiences.value.map((type) => ({ value: type.code, label: type.label })),
]);
const kindOptions = ["static", "ai_prompt"].map((value) => ({ value, label: templateKindLabel(value) }));
const modelOptions = computed(() => [
  { value: "", label: "—" },
  ...models.value.map((m) => ({ value: m.model_id, label: `${m.model_id} (${m.provider})` })),
]);
const templateId = computed(() => route.params.id);
const form = reactive({});
const schemaText = ref("");
const models = ref([]);
const loaded = ref(false);
const drawer = ref("");
const error = ref("");
// Enter saves too: a save in flight turns Save off and ignores the next submit.
const saving = ref(false);

// Empty = no schema; otherwise the textarea must hold a JSON object.
function parseSchema(text) {
  if (!text.trim()) return { value: null };
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? { value } : { error: t("communicator.template.schema_object") };
  } catch (err) {
    return { error: `${t("communicator.template.schema_invalid")}: ${err.message}` };
  }
}
const schemaError = computed(() => parseSchema(schemaText.value).error || "");

// Detail form (plan 33): versions and test generate open side drawers; Save is the one primary, off while the
// schema does not parse. Save sits in the header, outside the form, and submits it through the native `form`
// attribute: the required fields are checked first, and Enter in a field saves (the form's default button).
const FORM_ID = "template-edit-form";
// A static template renders without the toolbox; an AI one cannot be test-generated while the toolbox is off.
const testBlocked = computed(() => form.kind === "ai_prompt" && !configHealth.aiUsable);
const headerActions = computed(() => [
  { key: "versions", label: t("communicator.template.versions"), role: "secondary", testid: "template-versions", onClick: () => (drawer.value = "versions") },
  { key: "test", label: t("communicator.template.test_generate"), role: "secondary", testid: "template-test-generate", disabled: testBlocked.value, onClick: () => (drawer.value = "test") },
  { key: "save", label: t("communicator.template.save"), role: "primary", testid: "template-save", disabled: Boolean(schemaError.value), loading: saving.value, form: FORM_ID },
]);

async function save() {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    const { data } = await PUT_Template(templateId.value, { ...form, json_schema: parseSchema(schemaText.value).value });
    Object.assign(form, data);
    notify.spawnNotification({ msg: t("communicator.template.saved") });
  } catch (err) {
    error.value = extractApiMessage(err, t("leads.review.error"));
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const noModels = { data: { results: [] } };
  // The model list comes from the toolbox: no request while it is off or not set up.
  const modelsRequest = configHealth.aiUsable ? GET_Models().catch(() => noModels) : noModels;
  const [tpl, modelRes] = await Promise.all([GET_Template(templateId.value), modelsRequest]);
  supportsAudience.value = "audience" in tpl.data;
  FIELDS.filter((field) => field in tpl.data).forEach((field) => (form[field] = tpl.data[field]));
  if (hasLeads.value) leadTypes.load();
  schemaText.value = tpl.data.json_schema ? JSON.stringify(tpl.data.json_schema, null, 2) : "";
  models.value = modelRes.data.results;
  loaded.value = true;
});
</script>

<style scoped>
.template-form {
  max-width: 960px;
}
</style>
