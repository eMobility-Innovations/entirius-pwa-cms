<template>
  <BasicModal
    :open="open"
    :title="title || t('translate_dialog.title')"
    size="md"
    :actions="footerActions"
    :persistent="executing"
    @update:open="(value) => !value && close()"
  >
    <div v-if="step === 'config'" class="flex-column gap-4" data-testid="translate-dialog-config">
      <AiToolboxHint />
      <p v-if="summary" class="t-muted fs-200">{{ summary }}</p>
      <FormField :label="t('translate_dialog.source_language')">
        <BasicSelect v-model="form.source" :options="languages" :placeholder="t('translate_dialog.select_language')" />
      </FormField>
      <FormField :label="t('translate_dialog.target_languages')">
        <BasicSelect
          v-model="form.targets"
          multiple
          :options="targetOptions"
          :placeholder="t('translate_dialog.select_language')"
          v-bind="targetOptions.length ? {} : { 'aria-describedby': noLanguagesId }"
        />
        <p v-if="!targetOptions.length" :id="noLanguagesId" class="t-muted fs-200 m-0">{{ t("translate_dialog.no_languages") }}</p>
        <div v-if="form.targets.length" class="flex flex-wrap gap-1 mt-2">
          <Tag v-for="lang in form.targets" :key="lang" :label="lang.toUpperCase()" removable @remove="removeTarget(lang)" />
        </div>
      </FormField>
      <slot name="languages" />
      <FormField v-if="scope === 'store'" :label="t('translate_dialog.content_types')">
        <div class="flex-column gap-2">
          <BasicCheckbox v-for="type in STORE_TYPES" :key="type.value" v-model="form.types[type.value]">
            {{ t(type.labelKey) }}
          </BasicCheckbox>
        </div>
      </FormField>
      <div class="flex-column gap-2">
        <BasicCheckbox v-model="form.force">{{ t("translate_dialog.force_all") }}</BasicCheckbox>
        <BasicCheckbox v-if="scope === 'content'" v-model="form.publish">
          {{ t("translate_dialog.publish") }}
        </BasicCheckbox>
      </div>
    </div>

    <div v-else class="flex-column gap-4" data-testid="translate-dialog-estimate-step">
      <DataTable :columns="costColumns" :rows="costRows" row-key="key" />
      <template v-if="drafts.length">
        <h3 class="field-label">{{ t("translate_dialog.pages_to_translate") }}</h3>
        <DataTable :columns="draftColumns" :rows="drafts" row-key="key" />
      </template>
    </div>
  </BasicModal>
</template>

<script setup>
// The one translate dialog (Pim product, Pim store, Pages „Przetłumacz wszystko”): pick the languages, estimate the
// cost, confirm. `scope` picks the extra options and how the estimate reads; the caller keeps its API calls:
// `estimateFn(request)` resolves to the raw estimate, `submitFn(request, estimate)` to the number of jobs created.
// `request` = { source_language, target_languages, force } + `publish` (content) + `entity_types` (store).
// The `languages` slot sits under the target languages (Pim: add a language to the channel).
import { computed, reactive, ref, useId, watch } from "vue";
import { t } from "@/i18n";
import { useConfigHealthStore } from "@/stores/configHealth";
import { useNotifyStore } from "@/stores/notify";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import { SCOPES, STORE_TYPES, estimateRows, draftRows } from "./estimate";

const props = defineProps({
  open: { type: Boolean, default: false },
  scope: { type: String, required: true, validator: (value) => SCOPES.includes(value) },
  title: { type: String, default: "" },
  summary: { type: String, default: "" },
  // [{ label, value }] of the languages the channel has; the source default is `sourceLanguage`.
  languages: { type: Array, default: () => [] },
  sourceLanguage: { type: String, default: "" },
  estimateFn: { type: Function, required: true },
  submitFn: { type: Function, required: true },
});
const emit = defineEmits(["update:open", "translated"]);

const notify = useNotifyStore();
const configHealth = useConfigHealthStore();
// The "no languages" note says why the list is empty: content, linked to the select (never a hideable hint).
const noLanguagesId = useId();
const step = ref("config");
const estimate = ref(null);
const estimating = ref(false);
const executing = ref(false);
// Bumped on every open and close: an estimate that answers for an earlier opening is dropped.
let estimateToken = 0;
const form = reactive({ source: "", targets: [], force: false, publish: false, types: {} });

const targetOptions = computed(() => props.languages.filter((lang) => lang.value !== form.source));
const activeTypes = computed(() => STORE_TYPES.map((type) => type.value).filter((type) => form.types[type]));
const canEstimate = computed(
  () => !!form.source && form.targets.length > 0 && (props.scope !== "store" || activeTypes.value.length > 0),
);

const costColumns = computed(() => [
  { key: "label", label: t(props.scope === "store" ? "translate_dialog.entity_type" : "translate_dialog.language") },
  { key: "items", label: t("translate_dialog.items"), numeric: true },
  { key: "chars", label: t("translate_dialog.chars"), numeric: true },
  { key: "cost", label: t("translate_dialog.cost"), numeric: true },
]);
const draftColumns = computed(() => [
  { key: "name", label: t("translate_dialog.page"), truncate: true },
  { key: "items", label: t("translate_dialog.items"), numeric: true },
  { key: "chars", label: t("translate_dialog.chars"), numeric: true },
]);
const costRows = computed(() => (estimate.value ? estimateRows(props.scope, estimate.value, t) : []));
const drafts = computed(() => (estimate.value ? draftRows(props.scope, estimate.value) : []));

// Config: Cancel · Estimate; estimate: Back · Confirm (R5, primary rightmost).
const footerActions = computed(() => {
  if (step.value === "estimate") {
    return [
      { key: "back", label: t("common.back"), role: "secondary", disabled: executing.value, onClick: backToConfig },
      { key: "confirm", label: t("translate_dialog.confirm"), role: "primary", loading: executing.value,
        testid: "translate-dialog-confirm", onClick: confirm },
    ];
  }
  return [
    { key: "cancel", label: t("common.cancel"), role: "secondary", onClick: close },
    { key: "estimate", label: t("translate_dialog.estimate"), role: "primary",
      disabled: !canEstimate.value || !configHealth.aiUsable,
      loading: estimating.value, testid: "translate-dialog-estimate", onClick: fetchEstimate },
  ];
});

function reset() {
  step.value = "config";
  estimate.value = null;
  estimating.value = false;
  Object.assign(form, { source: props.sourceLanguage, targets: [], force: false, publish: false });
  form.types = Object.fromEntries(STORE_TYPES.map((type) => [type.value, true]));
}

watch(() => props.open, (value) => {
  estimateToken += 1;
  if (value) reset();
}, { immediate: true });
watch(() => form.source, (source) => {
  form.targets = form.targets.filter((lang) => lang !== source);
});

function close() {
  if (!executing.value) emit("update:open", false);
}

function backToConfig() {
  step.value = "config";
  estimate.value = null;
}

function removeTarget(lang) {
  form.targets = form.targets.filter((value) => value !== lang);
}

function buildRequest() {
  const request = { source_language: form.source, target_languages: [...form.targets], force: form.force };
  if (props.scope === "content") request.publish = form.publish;
  if (props.scope === "store") request.entity_types = activeTypes.value;
  return request;
}

function notifyError(err, key) {
  notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, t(key)) });
}

async function fetchEstimate() {
  const token = estimateToken;
  estimating.value = true;
  try {
    const answer = await props.estimateFn(buildRequest());
    if (token !== estimateToken) return;
    estimate.value = answer;
    step.value = "estimate";
  } catch (err) {
    if (token === estimateToken) notifyError(err, "translate_dialog.estimate_failed");
  } finally {
    if (token === estimateToken) estimating.value = false;
  }
}

async function confirm() {
  executing.value = true;
  try {
    const count = await props.submitFn(buildRequest(), estimate.value);
    notify.spawnNotification({ type: "positive", msg: t("translate_dialog.jobs_created", { count }) });
    emit("translated");
  } catch (err) {
    notifyError(err, "translate_dialog.execute_failed");
    return;
  } finally {
    executing.value = false;
  }
  close();
}
</script>
