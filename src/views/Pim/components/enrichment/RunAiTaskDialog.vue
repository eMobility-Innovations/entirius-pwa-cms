<template>
  <BasicModal
    :open="open"
    :title="$t('enrichment.ai.title')"
    :actions="actions"
    :persistent="busy"
    data-testid="ai-task-dialog"
    @close="$emit('close')"
  >
    <div v-if="createdTask" class="flex-column gap-4" data-testid="ai-task-created">
      <p class="m-0">{{ $t("enrichment.ai.created", { id: createdTask.id }) }}</p>
      <router-link :to="taskLink" class="t-accent fw-600" data-testid="ai-task-link" @click="$emit('close')">
        {{ $t("enrichment.ai.open_task") }}
      </router-link>
      <router-link :to="reviewLink" class="t-accent fw-600" data-testid="ai-task-review-link" @click="$emit('close')">
        {{ $t("enrichment.ai.review_task") }}
      </router-link>
    </div>

    <div v-else class="flex-column gap-4">
      <AiToolboxHint />
      <FormField v-if="templates.length" :label="$t('enrichment.run.template')">
        <BasicSelect v-model="templateKey" :options="templateOptions" data-testid="ai-task-template" />
      </FormField>
      <FormField v-if="!template" :label="$t('enrichment.ai.worker')" required>
        <BasicSelect v-model="workerKey" :options="workerOptions" data-testid="ai-task-worker" />
      </FormField>

      <AiParamsForm
        v-model="values"
        v-model:research="research"
        :fields="fields"
        :languages="languages"
        :field-choices="fieldChoices"
        :research-keys="researchKeys"
      />

      <p class="fs-200 t-muted m-0">{{ $t("enrichment.ai.summary", { count: skus.length, channel: channel }) }}</p>

      <div v-if="saving" class="ai-task__save flex-column gap-3" data-testid="ai-task-save-template">
        <FormField :label="$t('enrichment.run.template_name')" required>
          <BasicInput v-model="templateLabel" :maxlength="128" data-testid="ai-task-template-name" />
        </FormField>
        <div class="flex jc-fe gap-3">
          <BasicButton variant="ghost" @click="saving = false">{{ $t("common.cancel") }}</BasicButton>
          <BasicButton
            mutates
            :disabled="!templateLabel.trim() || busy"
            :loading="busy"
            data-testid="ai-task-template-save"
            @click="saveTemplate"
          >
            {{ $t("enrichment.run.save_template") }}
          </BasicButton>
        </div>
      </div>
    </div>
  </BasicModal>
</template>

<script>
import { usePimChannelStore } from "@/stores/pimChannel";
import { useNotifyStore } from "@/stores/notify";
import { useConfigHealthStore } from "@/stores/configHealth";
import { extractApiMessage } from "@/composables/useFormErrors";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import { GET_Templates, POST_SpawnTask, POST_Template } from "@/api/enrichment/api";
import { fieldOptions, loadCatalog } from "@/views/EnrichmentReview/fieldCatalog";
import AiParamsForm from "./AiParamsForm.vue";
import {
  buildFields,
  buildParams,
  buildTaskPayload,
  defaultResearch,
  defaultValues,
  missingRequired,
  presetValues,
  researchKeys,
} from "./aiTaskForm";
import { newTemplateBody } from "./templateForm";

// One "Run AI task" dialog for a single product and a list selection: pick a template (its worker, fields,
// languages, instructions and research preset) or "Custom…" and a worker, adjust the form, POST one task over the
// SKUs of the active channel, then link to the task (or, with `background`, close at once and leave the progress to
// the page). The run as set up can be kept as a new template (`template-saved`). No cost estimate: costs show after.
export default {
  name: "RunAiTaskDialog",
  components: { AiToolboxHint, AiParamsForm },
  props: {
    open: { type: Boolean, default: false },
    workers: { type: Array, default: () => [] },
    // Active templates in their order (useAiWorkers); `initialTemplate` "" opens on "Custom…".
    templates: { type: Array, default: () => [] },
    initialTemplate: { type: String, default: "" },
    initialWorker: { type: String, default: "" },
    skus: { type: Array, default: () => [] },
    // The page shows the task's progress itself: close on spawn with a toast instead of the task link.
    background: { type: Boolean, default: false },
  },
  emits: ["close", "created", "template-saved"],
  setup() {
    return { pimChannel: usePimChannelStore(), notify: useNotifyStore(), health: useConfigHealthStore() };
  },
  data() {
    return {
      templateKey: "",
      workerKey: "",
      values: {},
      research: defaultResearch(),
      catalog: { fields: [], languages: [] },
      busy: false,
      createdTask: null,
      saving: false,
      templateLabel: "",
    };
  },
  computed: {
    template() {
      return this.templates.find((t) => t.key === this.templateKey) || null;
    },
    worker() {
      const key = this.template ? this.template.worker_key : this.workerKey;
      return this.workers.find((w) => w.key === key) || null;
    },
    kind() {
      return this.worker?.kind || "";
    },
    fields() {
      return buildFields(this.worker?.params_schema, this.kind);
    },
    templateOptions() {
      const custom = { label: this.$t("enrichment.run.custom"), value: "" };
      return [...this.templates.map((t) => ({ label: t.label, value: t.key })), custom];
    },
    workerOptions() {
      return this.workers.map((w) => ({ label: w.label || w.key, value: w.key }));
    },
    channel() {
      return this.pimChannel.activeChannelIdx;
    },
    languages() {
      return this.catalog.languages.length ? this.catalog.languages : this.pimChannel.activeChannelLanguages;
    },
    fieldChoices() {
      return fieldOptions(this.catalog.fields, this.kind);
    },
    researchKeys() {
      return researchKeys(this.kind, this.template?.params?.augment);
    },
    params() {
      return buildParams(this.fields, this.values, this.researchKeys.length ? this.research : null);
    },
    canRun() {
      return !!this.worker && !!this.skus.length && this.health.aiUsable && !missingRequired(this.fields, this.values).length;
    },
    taskLink() {
      return { name: "EnrichmentTasks", query: { status: "__all", task: String(this.createdTask?.id) } };
    },
    reviewLink() {
      return { name: "EnrichmentReview", query: { task: String(this.createdTask?.id) } };
    },
    actions() {
      if (this.createdTask) {
        return [{ key: "close", role: "secondary", label: this.$t("common.close"), onClick: () => this.$emit("close") }];
      }
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), disabled: this.busy,
          onClick: () => this.$emit("close") },
        { key: "save_template", role: "secondary", mutates: true, label: this.$t("enrichment.run.save_as_template"),
          testid: "ai-task-save-as-template", disabled: this.busy || !this.worker, onClick: this.startSaving },
        { key: "run", role: "primary", mutates: true, label: this.$t("enrichment.ai.run"), testid: "ai-task-run",
          disabled: this.busy || !this.canRun, loading: this.busy, onClick: this.run },
      ];
    },
  },
  watch: {
    open(isOpen) {
      if (isOpen) this.reset();
    },
    templateKey: "applyDefaults",
    workerKey: "applyDefaults",
    languages: "applyDefaults",
  },
  methods: {
    async reset() {
      this.createdTask = null;
      this.saving = false;
      this.workerKey = this.initialWorker || this.workers[0]?.key || "";
      this.templateKey = this.initialTemplate;
      this.applyDefaults();
      this.catalog = await loadCatalog(this.channel);
    },
    applyDefaults() {
      const mainLanguage = this.languages[0] || this.pimChannel.activeChannel?.default_language || "";
      const base = defaultValues(this.fields, { languages: this.languages, mainLanguage });
      this.values = presetValues(this.fields, base, this.template?.params);
      this.research = defaultResearch(this.template?.params);
    },
    startSaving() {
      this.templateLabel = "";
      this.saving = true;
    },
    startedInBackground() {
      this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.ai.started") });
      this.$emit("close");
    },
    async run() {
      if (this.busy || !this.canRun) return;
      this.busy = true;
      try {
        const payload = buildTaskPayload({
          worker: this.worker, params: this.params, channel: this.channel, skus: this.skus, template: this.templateKey,
        });
        const { data } = await POST_SpawnTask(payload);
        this.$emit("created", data);
        if (this.background) return this.startedInBackground();
        this.createdTask = data;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
        // A refusal of the form (400) keeps it open to fix; anything else closes it.
        if (err?.httpStatus !== 400) this.$emit("close");
      } finally {
        this.busy = false;
      }
    },
    async saveTemplate() {
      this.busy = true;
      try {
        // Every template, not only the runnable ones: a hidden one or another module's may hold the key.
        const { data: all } = await GET_Templates();
        const body = newTemplateBody({
          label: this.templateLabel,
          worker: this.worker,
          params: this.params,
          rules: this.template?.rules || [],
          templates: Array.isArray(all) ? all : all?.results || [],
        });
        const { data } = await POST_Template(body);
        this.saving = false;
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.templates.saved") });
        this.$emit("template-saved", data);
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.ai-task__save {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
</style>
