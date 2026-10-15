<template>
  <BasicModal
    :open="open"
    :title="$t('enrichment.studio.new_title')"
    size="md"
    :persistent="starting"
    :actions="actions"
    data-testid="new-run-dialog"
    @update:open="(value) => !value && close()"
  >
    <Loader v-if="loading" />
    <p v-else-if="!workflows.length" class="m-0 t-secondary" data-testid="no-workflows">{{ $t("enrichment.studio.no_workflows") }}</p>
    <form v-else class="flex-column gap-4" @submit.prevent="start">
      <FormField :label="$t('enrichment.studio.workflow')" required>
        <BasicSelect v-model="definition" :options="workflowOptions" data-testid="new-run-workflow" />
      </FormField>
      <FormField :label="$t('enrichment.studio.channel')" required>
        <BasicSelect v-model="channel" :options="channelOptions" data-testid="new-run-channel" />
      </FormField>
      <ProfileGate v-if="channel" :channel="channel" />
      <FormField
        v-for="field in requiredFields"
        :key="field.key"
        :label="field.label"
        :required="field.required"
        :error="fieldError(field)"
        :data-testid="`brief-${field.key}`"
      >
        <BasicSelect v-if="isLanguage(field)" v-model="brief[field.key]" :options="languageOptions" />
        <BasicTextarea v-else-if="field.multiline" v-model="brief[field.key]" :rows="3" :maxlength="field.maxLength" />
        <BasicInput v-else v-model="brief[field.key]" :maxlength="field.maxLength" />
      </FormField>

      <template v-if="optionalFields.length">
        <div>
          <BasicButton
            variant="ghost"
            :icon="showDetails ? 'collapse' : 'expand'"
            :aria-expanded="String(showDetails)"
            data-testid="new-run-details"
            @click="showDetails = !showDetails"
          >
            {{ $t(showDetails ? "enrichment.studio.details_hide" : "enrichment.studio.details_show") }}
          </BasicButton>
        </div>
        <template v-if="showDetails">
          <FormField
            v-for="field in optionalFields"
            :key="field.key"
            :label="field.label"
            :error="fieldError(field)"
            :data-testid="`brief-${field.key}`"
          >
            <BasicTextarea v-if="field.multiline" v-model="brief[field.key]" :rows="3" :maxlength="field.maxLength" />
            <BasicInput v-else v-model="brief[field.key]" :maxlength="field.maxLength" />
          </FormField>
        </template>
      </template>
    </form>
  </BasicModal>
</template>

<script>
import { GET_Languages, GET_Run, GET_Workflows, POST_Run } from "@/api/enrichment/api";
import { uiLocale } from "@/i18n";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import ProfileGate from "./ProfileGate.vue";
import { LANGUAGE_FIELD, briefErrors, briefFields, cleanBrief, initialBrief } from "./studioLogic";

// "New": pick a workflow and the channel, then its brief — a form generated from the workflow's inputs schema. The
// required fields come first (the language is a pick from the channel's languages, its main one by default); the
// optional ones wait behind "Add details". `copyFrom` (a run uid) starts from that run's workflow, channel and brief.
// Start creates the run and opens it (`started`).
export default {
  name: "NewRunDialog",
  components: { ProfileGate },
  props: {
    open: { type: Boolean, default: false },
    copyFrom: { type: String, default: "" },
  },
  emits: ["update:open", "started"],
  setup() {
    return { formErrors: useFormErrors(), notify: useNotifyStore(), channels: useContentDBChannelStore() };
  },
  data() {
    return {
      workflows: [],
      definition: null,
      channel: "",
      brief: {},
      copied: null,
      languages: [],
      showDetails: false,
      errors: {},
      loading: false,
      starting: false,
    };
  },
  computed: {
    workflow() {
      return this.workflows.find((w) => w.key === this.definition) || null;
    },
    fields() {
      return briefFields(this.workflow?.inputs_schema);
    },
    requiredFields() {
      return this.fields.filter((field) => field.required);
    },
    optionalFields() {
      return this.fields.filter((field) => !field.required);
    },
    workflowOptions() {
      return this.workflows.map((w) => ({ label: w.label, value: w.key }));
    },
    channelOptions() {
      return this.channels.channels.map((c) => ({ label: c.name || c.idx, value: c.idx }));
    },
    languageOptions() {
      const names = new Intl.DisplayNames([uiLocale()], { type: "language" });
      return this.languages.map((code) => ({ label: `${names.of(code) || code} (${code.toUpperCase()})`, value: code }));
    },
    languageSource() {
      return this.workflow && this.channel ? `${this.workflow.target_module}:${this.channel}` : "";
    },
    actions() {
      return [
        { key: "cancel", role: "secondary", mutates: false, label: this.$t("common.cancel"), disabled: this.starting, onClick: this.close },
        { key: "start", role: "primary", mutates: true, label: this.$t("enrichment.studio.start"), loading: this.starting,
          disabled: !this.workflow || !this.channel, testid: "new-run-start", onClick: this.start },
      ];
    },
  },
  watch: {
    open: { immediate: true, handler: "prepare" },
    definition() {
      this.brief = { ...initialBrief(this.fields), ...this.copied };
      this.copied = null;
      this.showDetails = this.optionalFields.some((field) => String(this.brief[field.key] ?? "").trim());
      this.errors = {};
      this.formErrors.clearErrors();
    },
    languageSource: "loadLanguages",
  },
  methods: {
    async prepare(open) {
      if (!open) return;
      this.loading = true;
      try {
        await this.channels.fetchChannelsAndLanguages();
        this.channel = this.channel || this.channels.activeChannelIdx;
        const { data } = await GET_Workflows();
        this.workflows = data;
        if (this.copyFrom) await this.copy(this.copyFrom);
        else if (!this.definition && data.length) this.definition = data[0].key;
      } catch (err) {
        this.failed(err);
      } finally {
        this.loading = false;
      }
    },
    // Another run's workflow, channel and brief; the brief lands once its workflow's form is built (the watcher).
    async copy(uid) {
      const { data: run } = await GET_Run(uid);
      this.channel = run.channel || this.channel;
      this.copied = { ...run.inputs };
      if (this.definition === run.definition) this.brief = { ...this.brief, ...this.copied };
      else this.definition = run.definition;
      this.showDetails = this.optionalFields.some((field) => String(this.brief[field.key] ?? "").trim());
    },
    isLanguage(field) {
      return field.key === LANGUAGE_FIELD && this.languages.length > 0;
    },
    // The languages of the channel for the workflow's module, main first; a value outside them moves to the main one.
    async loadLanguages(source) {
      if (!source) return;
      try {
        const { data } = await GET_Languages({ target_module: this.workflow.target_module, channel: this.channel });
        if (source !== this.languageSource) return;
        this.languages = Array.isArray(data) ? data : [];
      } catch {
        this.languages = [];
      }
      const current = this.brief[LANGUAGE_FIELD];
      if (this.languages.length && !this.languages.includes(current)) this.brief = { ...this.brief, [LANGUAGE_FIELD]: this.languages[0] };
    },
    fieldError(field) {
      const code = this.errors[field.key];
      if (code) return this.$t(`enrichment.studio.brief_errors.${code}`, { min: field.minLength, max: field.maxLength });
      return this.formErrors.getFieldError(field.key)?.msg || "";
    },
    async start() {
      this.errors = briefErrors(this.fields, this.brief);
      if (this.optionalFields.some((field) => this.errors[field.key])) this.showDetails = true;
      if (Object.keys(this.errors).length) return;
      this.starting = true;
      try {
        const body = { definition: this.definition, channel: this.channel, inputs: cleanBrief(this.brief) };
        const { data } = await POST_Run(body);
        this.$emit("started", data);
        this.close();
      } catch (err) {
        this.formErrors.handleApiError(err);
        if (!this.formErrors.hasErrors) this.failed(err);
      } finally {
        this.starting = false;
      }
    },
    close() {
      this.$emit("update:open", false);
    },
    failed(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>
