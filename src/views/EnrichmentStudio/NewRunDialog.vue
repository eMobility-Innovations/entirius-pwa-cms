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
        v-for="field in fields"
        :key="field.key"
        :label="field.label"
        :required="field.required"
        :error="fieldError(field)"
        :data-testid="`brief-${field.key}`"
      >
        <BasicTextarea v-if="field.multiline" v-model="brief[field.key]" :rows="3" :maxlength="field.maxLength" />
        <BasicInput v-else v-model="brief[field.key]" :maxlength="field.maxLength" />
      </FormField>
    </form>
  </BasicModal>
</template>

<script>
import { GET_Workflows, POST_Run } from "@/api/enrichment/api";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import ProfileGate from "./ProfileGate.vue";
import { briefErrors, briefFields, cleanBrief, initialBrief } from "./studioLogic";

// "New": pick a workflow, then fill its brief — a form generated from the workflow's inputs schema — and the channel
// the document is for. Start creates the run and opens it (`started`).
export default {
  name: "NewRunDialog",
  components: { ProfileGate },
  props: {
    open: { type: Boolean, default: false },
  },
  emits: ["update:open", "started"],
  setup() {
    return { formErrors: useFormErrors(), notify: useNotifyStore(), channels: useContentDBChannelStore() };
  },
  data() {
    return { workflows: [], definition: null, channel: "", brief: {}, errors: {}, loading: false, starting: false };
  },
  computed: {
    workflow() {
      return this.workflows.find((w) => w.key === this.definition) || null;
    },
    fields() {
      return briefFields(this.workflow?.inputs_schema);
    },
    workflowOptions() {
      return this.workflows.map((w) => ({ label: w.label, value: w.key }));
    },
    channelOptions() {
      return this.channels.channels.map((c) => ({ label: c.name || c.idx, value: c.idx }));
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
      this.brief = initialBrief(this.fields);
      this.errors = {};
      this.formErrors.clearErrors();
    },
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
        if (!this.definition && data.length) this.definition = data[0].key;
      } catch (err) {
        this.failed(err);
      } finally {
        this.loading = false;
      }
    },
    fieldError(field) {
      const code = this.errors[field.key];
      if (code) return this.$t(`enrichment.studio.brief_errors.${code}`, { min: field.minLength, max: field.maxLength });
      return this.formErrors.getFieldError(field.key)?.msg || "";
    },
    async start() {
      this.errors = briefErrors(this.fields, this.brief);
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
