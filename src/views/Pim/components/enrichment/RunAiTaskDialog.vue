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
    </div>

    <div v-else class="flex-column gap-4">
      <AiToolboxHint />
      <FormField :label="$t('enrichment.ai.worker')" required>
        <BasicSelect v-model="workerKey" :options="workerOptions" data-testid="ai-task-worker" />
      </FormField>

      <FormField v-for="field in fields" :key="field.name" :label="labelOf(field)" :required="field.required">
        <BasicTextarea
          v-if="field.kind === 'prompt'"
          v-model="values[field.name]"
          :rows="3"
          :placeholder="$t('enrichment.ai.prompt_placeholder')"
          :data-testid="`ai-task-param-${field.name}`"
        />
        <BasicSelect
          v-else-if="field.kind === 'enum'"
          v-model="values[field.name]"
          :options="field.options.map((o) => ({ label: o, value: o }))"
          :data-testid="`ai-task-param-${field.name}`"
        />
        <BasicSelect
          v-else-if="field.kind === 'language'"
          :model-value="values[field.name]"
          :options="languageOptions"
          :data-testid="`ai-task-param-${field.name}`"
          @update:model-value="(lang) => setSource(field.name, lang)"
        />
        <div
          v-else-if="field.kind === 'languages'"
          class="flex flex-wrap gap-5"
          role="group"
          :aria-label="labelOf(field)"
          :data-testid="`ai-task-param-${field.name}`"
        >
          <BasicCheckbox
            v-for="lang in languages"
            :key="lang"
            :model-value="values[field.name].includes(lang)"
            :disabled="lang === sourceLanguage"
            @update:model-value="(on) => toggleLanguage(field.name, lang, on)"
          >
            {{ lang.toUpperCase() }}
          </BasicCheckbox>
        </div>
        <BasicInput v-else v-model="values[field.name]" :data-testid="`ai-task-param-${field.name}`" />
      </FormField>

      <p class="fs-200 t-muted m-0">{{ $t("enrichment.ai.summary", { count: skus.length, channel: channel }) }}</p>
    </div>
  </BasicModal>
</template>

<script>
import { usePimChannelStore } from "@/stores/pimChannel";
import { useNotifyStore } from "@/stores/notify";
import { useConfigHealthStore } from "@/stores/configHealth";
import { extractApiMessage } from "@/composables/useFormErrors";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import { POST_SpawnTask } from "@/api/enrichment/api";
import { buildFields, buildTaskPayload, defaultValues, missingRequired, withSource } from "./aiTaskForm";

// One "Run AI task" dialog for a single product and a list selection: pick a worker, fill the form its
// params_schema generates, POST one task over the SKUs of the active channel, then link to the task (or, with
// `background`, close at once and leave the progress to the page).
export default {
  name: "RunAiTaskDialog",
  components: { AiToolboxHint },
  props: {
    open: { type: Boolean, default: false },
    workers: { type: Array, default: () => [] },
    initialWorker: { type: String, default: "" },
    skus: { type: Array, default: () => [] },
    // The page shows the task's progress itself: close on spawn with a toast instead of the task link.
    background: { type: Boolean, default: false },
  },
  emits: ["close", "created"],
  setup() {
    return { pimChannel: usePimChannelStore(), notify: useNotifyStore(), health: useConfigHealthStore() };
  },
  data() {
    return { workerKey: "", values: {}, busy: false, createdTask: null };
  },
  computed: {
    worker() {
      return this.workers.find((w) => w.key === this.workerKey) || null;
    },
    fields() {
      return buildFields(this.worker?.params_schema);
    },
    workerOptions() {
      return this.workers.map((w) => ({ label: w.label || w.key, value: w.key }));
    },
    channel() {
      return this.pimChannel.activeChannelIdx;
    },
    languages() {
      return this.pimChannel.activeChannelLanguages;
    },
    languageOptions() {
      return this.languages.map((lang) => ({ label: lang.toUpperCase(), value: lang }));
    },
    sourceLanguage() {
      const source = this.fields.find((f) => f.kind === "language");
      return source ? this.values[source.name] : "";
    },
    canRun() {
      return !!this.worker && !!this.skus.length && this.health.aiUsable && !missingRequired(this.fields, this.values).length;
    },
    taskLink() {
      return { name: "EnrichmentTasks", query: { status: "__all", task: String(this.createdTask?.id) } };
    },
    actions() {
      if (this.createdTask) {
        return [{ key: "close", role: "secondary", label: this.$t("common.close"), onClick: () => this.$emit("close") }];
      }
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), disabled: this.busy,
          onClick: () => this.$emit("close") },
        { key: "run", role: "primary", mutates: true, label: this.$t("enrichment.ai.run"), testid: "ai-task-run",
          disabled: this.busy || !this.canRun, loading: this.busy, onClick: this.run },
      ];
    },
  },
  watch: {
    open(isOpen) {
      if (isOpen) this.reset();
    },
    workerKey: "applyDefaults",
  },
  methods: {
    reset() {
      this.createdTask = null;
      this.workerKey = this.initialWorker || this.workers[0]?.key || "";
      this.applyDefaults();
    },
    applyDefaults() {
      const mainLanguage = this.pimChannel.activeChannel?.default_language || "";
      this.values = defaultValues(this.fields, { languages: this.languages, mainLanguage });
    },
    labelOf(field) {
      const key = `enrichment.ai.params.${field.name}`;
      const label = this.$t(key);
      return label === key ? field.title : label;
    },
    setSource(name, lang) {
      this.values = withSource(this.values, this.fields, name, lang);
    },
    toggleLanguage(name, lang, on) {
      const rest = this.values[name].filter((l) => l !== lang);
      this.values[name] = on ? [...rest, lang] : rest;
    },
    startedInBackground() {
      this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.ai.started") });
      this.$emit("close");
    },
    async run() {
      if (this.busy || !this.canRun) return;
      this.busy = true;
      try {
        const payload = buildTaskPayload({ worker: this.worker, values: this.values, channel: this.channel, skus: this.skus });
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
  },
};
</script>
