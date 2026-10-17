<template>
  <BasicModal
    :open="open"
    :title="title"
    :actions="actions"
    :persistent="busy"
    data-testid="ai-task-dialog"
    @close="$emit('close')"
  >
    <div v-if="createdTask" class="flex-column gap-4" data-testid="ai-task-created">
      <p class="m-0">{{ $t(isPim ? "enrichment.ai.created" : "enrichment.ai.gallery.created") }}</p>
      <router-link :to="taskLink" class="t-accent fw-600" data-testid="ai-task-link" @click="$emit('close')">
        {{ $t("enrichment.ai.open_task") }}
      </router-link>
    </div>

    <Loader v-else-if="!ready" block data-testid="ai-task-loading" />
    <div v-else class="flex-column gap-4">
      <AiToolboxHint />
      <FormField v-if="templates.length && !initialPicture" :label="$t('enrichment.run.template')">
        <BasicSelect v-model="templateKey" :options="templateOptions" data-testid="ai-task-template" />
      </FormField>
      <FormField v-if="!template" :label="$t('enrichment.ai.worker')" required>
        <BasicSelect
          v-model="workerKey"
          :options="workerOptions"
          :placeholder="$t('enrichment.run.pick_worker')"
          data-testid="ai-task-worker"
        />
      </FormField>

      <TaskTargetPicker v-if="pickTargets" v-model="target" />

      <PicturePicker
        v-if="pictureSubject"
        v-model="pictureRef"
        :module="module"
        :channel="channel"
        :subject-ref="pictureSubject"
        :preferred="initialPicture"
        :label="$t(`enrichment.ai.picture.${kind}_label`)"
      />
      <p v-else-if="isPim && startsFromPicture && runCount > 1" class="fs-200 t-secondary m-0" data-testid="ai-task-main-pictures">
        {{ $t(`enrichment.ai.picture.several_${kind}`) }}
      </p>

      <AiParamsForm
        v-model="values"
        v-model:research="research"
        :fields="formFields"
        :languages="languages"
        :field-choices="fieldChoices"
        :research-keys="researchKeys"
        for-run
      />
      <QaCheckToggle v-if="checksText" v-model="qaCheck" :disabled="busy" />

      <p class="fs-200 t-muted m-0">{{ summary }}</p>
      <p v-if="!nowAllowed" class="fs-200 t-secondary m-0" data-testid="ai-task-now-cap">
        {{ $t(isPim ? "enrichment.ai.lane.now_cap" : "enrichment.ai.gallery.now_cap", { max: runNowMax }) }}
      </p>

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
import { isConflict } from "@/api/createClient";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import { GET_Templates, POST_SpawnTask, POST_Template } from "@/api/enrichment/api";
import { listOf } from "@/api/enrichment/listOf";
import { fieldOptions, loadCatalog } from "@/views/EnrichmentReview/fieldCatalog";
import AiParamsForm from "./AiParamsForm.vue";
import {
  buildFields,
  buildParams,
  buildTaskPayload,
  defaultResearch,
  defaultValues,
  keptParams,
  missingRequired,
  presetValues,
  researchKeys,
} from "./aiTaskForm";
import { newTemplateBody } from "./templateForm";
import TaskTargetPicker from "./TaskTargetPicker.vue";
import PicturePicker from "./PicturePicker.vue";
import QaCheckToggle from "./QaCheckToggle.vue";
import { qaCheckParams } from "./qaCheck";
import { LANE_NOW, LANE_QUEUE, RUN_NOW_MAX, canRunNow, defaultLane, spawnToast } from "./runLane";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { pluralKey } from "@/utils/plural";
import { MAX_TABLET_QUERY } from "@/utils/breakpoints";

const PICTURE_KINDS = ["video", "image"];
const NO_CATALOG = { fields: [], languages: [] };

// One "Run AI task" dialog for a single product and a list selection: pick a template (its worker, fields,
// languages, instructions and research preset) or "Custom…" and a worker, adjust the form, POST one task over the
// SKUs of the active channel, then link to the run (or, with `background`, close at once and leave the progress to
// the page). The run as set up can be kept as a new template (`template-saved`). No cost estimate: costs show after.
// Two ways to send it: Run now (the express lane, at most RUN_NOW_MAX products) and Add to queue; the primary one
// follows the scope — one product runs now, a selection is queued. A phone shows only the primary one (one footer row).
// `pickTargets` (Studio): the products are picked in the dialog (TaskTargetPicker: pasted SKUs or a category) instead of
// coming in as `skus`; a big category is a filter scope, queued only. A `video` or `image` worker on one product asks
// which picture it starts from (PicturePicker → `params.picture_ref`, run only, never saved in a template); on several
// products each one uses its main picture. An `image` run says what to do (operation), how many variants, and — for a
// custom instruction — the instruction itself. `module` (default "pim") names whose subjects `skus` are: the gallery
// opens it with "contentdb", `image:<uid>` refs and its own `subject-channel` — no PIM field catalog, image wording.
export default {
  name: "RunAiTaskDialog",
  components: { AiToolboxHint, AiParamsForm, PicturePicker, QaCheckToggle, TaskTargetPicker },
  props: {
    open: { type: Boolean, default: false },
    workers: { type: Array, default: () => [] },
    // Active templates in their order (useAiWorkers); `initialTemplate` "" opens on "Custom…".
    templates: { type: Array, default: () => [] },
    initialTemplate: { type: String, default: "" },
    initialWorker: { type: String, default: "" },
    // A run started on one gallery picture (its ref): that picture is picked first and the template is fixed — the
    // operator only adds what the action takes (instruction, variants).
    initialPicture: { type: String, default: "" },
    skus: { type: Array, default: () => [] },
    module: { type: String, default: "pim" },
    // The channel of a module other than PIM (the active PIM channel otherwise).
    subjectChannel: { type: String, default: "" },
    pickTargets: { type: Boolean, default: false },
    // The page shows the task's progress itself: close on spawn with a toast instead of the task link.
    background: { type: Boolean, default: false },
  },
  emits: ["close", "created", "template-saved"],
  setup() {
    return {
      pimChannel: usePimChannelStore(), notify: useNotifyStore(), health: useConfigHealthStore(),
      isPhone: useMediaQuery(MAX_TABLET_QUERY),
    };
  },
  data() {
    return {
      templateKey: "",
      workerKey: "",
      values: {},
      research: defaultResearch(),
      qaCheck: null,
      catalog: { fields: [], languages: [] },
      busy: false,
      createdTask: null,
      saving: false,
      templateLabel: "",
      runNowMax: RUN_NOW_MAX,
      sendingLane: "",
      // The form shows once the channel's catalog is in: defaults set after it never overwrite the operator's picks.
      ready: false,
      openSeq: 0,
      reloading: false,
      target: { skus: [], filters: null, count: 0, pending: false },
      pictureRef: "",
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
    // A run on one picture is named by its action ("Enhance photo").
    title() {
      return this.initialPicture && this.template ? this.template.label : this.$t("enrichment.ai.title");
    },
    // A template that sets the image operation ("Packshot", "Enhance photo") is that operation: no second choice of it.
    formFields() {
      if (!this.template?.params?.operation) return this.fields;
      return this.fields.filter((field) => field.name !== "operation");
    },
    templateOptions() {
      const custom = { label: this.$t("enrichment.run.custom"), value: "" };
      return [...this.templates.map((t) => ({ label: t.label, value: t.key })), custom];
    },
    workerOptions() {
      return this.workers.map((w) => ({ label: w.label || w.key, value: w.key }));
    },
    isPim() {
      return this.module === "pim";
    },
    channel() {
      return this.subjectChannel || this.pimChannel.activeChannelIdx;
    },
    // The products of the run: the `skus` prop, or (pickTargets) the picked SKUs or filter.
    runSkus() {
      return this.pickTargets ? this.target.skus : this.skus;
    },
    runFilters() {
      return this.pickTargets ? this.target.filters : null;
    },
    runCount() {
      return this.pickTargets ? this.target.count : this.skus.length;
    },
    startsFromPicture() {
      return PICTURE_KINDS.includes(this.kind);
    },
    // The one product a `video` / `image` run starts from a chosen picture of; "" = several products (each uses its
    // main picture).
    pictureSubject() {
      if (!this.startsFromPicture || this.runFilters || this.runSkus.length !== 1) return "";
      return this.runSkus[0];
    },
    // A filter scope has no list of products: the server queues it (Run now takes a list).
    primaryLane() {
      return this.runFilters ? LANE_QUEUE : defaultLane(this.runCount);
    },
    // "Runs on 3 products in Default Europe": the channel by its name, the count in its plural form.
    summary() {
      const count = this.runCount;
      if (!this.isPim) return this.$t(`enrichment.ai.gallery.summary_${pluralKey(count)}`, { count });
      const channel = this.pimChannel.activeChannel?.name || this.channel;
      return this.$t(`enrichment.ai.summary_${pluralKey(count)}`, { count, channel });
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
      const params = buildParams(this.fields, this.values, this.researchKeys.length ? this.research : null);
      return this.checksText ? { ...params, ...qaCheckParams(this.qaCheck) } : params;
    },
    // The guidelines check reads text proposals only.
    checksText() {
      return this.kind === "write" || this.kind === "field";
    },
    canRun() {
      const targeted = this.runCount > 0 && !(this.pickTargets && this.target.pending);
      const pictured = !this.pictureSubject || !!this.pictureRef;
      return this.ready && !this.reloading && !!this.worker && targeted && pictured && this.health.aiUsable
        && !missingRequired(this.fields, this.values, { run: true }).length;
    },
    // The run on Runs: its progress, then what it proposed, in one place.
    taskLink() {
      return { name: "EnrichmentRuns", query: { task: String(this.createdTask?.id) } };
    },
    nowAllowed() {
      return !this.runFilters && canRunNow(this.runCount);
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
        ...this.laneActions(),
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
    // Studio: a channel picked in the dialog brings its own catalog (fields, languages).
    channel() {
      if (this.open && this.ready && this.pickTargets) this.reloadCatalog();
    },
  },
  methods: {
    async reset() {
      const mine = ++this.openSeq;
      this.ready = false;
      this.createdTask = null;
      this.saving = false;
      this.reloading = false;
      this.target = { skus: [], filters: null, count: 0, pending: false };
      this.qaCheck = null;
      // A custom run starts with no worker picked: Run waits until the operator chose what the AI makes.
      this.workerKey = this.initialWorker || (this.workers.length === 1 ? this.workers[0].key : "");
      this.templateKey = this.initialTemplate;
      this.catalog = this.isPim ? await loadCatalog(this.channel) : NO_CATALOG;
      if (mine !== this.openSeq || !this.open) return;
      this.applyDefaults();
      this.ready = true;
    },
    // The form stays (the picked products with it); Run waits until the new channel's catalog is in.
    async reloadCatalog() {
      const mine = ++this.openSeq;
      this.reloading = true;
      const catalog = await loadCatalog(this.channel);
      if (mine !== this.openSeq || !this.open) return;
      this.catalog = catalog;
      this.applyDefaults();
      this.reloading = false;
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
    // Run now and Add to queue, the scope's default as the primary (rightmost); Run now off above the cap.
    laneActions() {
      const primary = this.primaryLane;
      const disabled = this.busy || !this.canRun;
      const lane = (key, label, testid, extra = {}) => ({
        key, label, testid, mutates: true, role: key === primary ? "primary" : "secondary",
        disabled, loading: this.busy && key === this.sendingLane, onClick: () => this.run(key), ...extra,
      });
      const lanes = [
        lane(LANE_NOW, this.$t("enrichment.ai.lane.run_now"), "ai-task-run-now", { disabled: disabled || !this.nowAllowed }),
        lane(LANE_QUEUE, this.$t("enrichment.ai.lane.add_to_queue"), "ai-task-add-to-queue"),
      ];
      return this.isPhone ? lanes.filter((action) => action.key === primary) : lanes;
    },
    async run(lane = this.primaryLane) {
      if (this.busy || !this.canRun) return;
      this.busy = true;
      this.sendingLane = lane;
      try {
        const payload = buildTaskPayload({
          worker: this.worker, params: this.runParams(), channel: this.channel, skus: this.runSkus, template: this.templateKey,
          filters: this.runFilters, module: this.module,
        });
        const { data } = await POST_SpawnTask({ ...payload, lane });
        this.$emit("created", data);
        this.notify.spawnNotification(spawnToast(data));
        if (this.background) return this.$emit("close");
        this.createdTask = data;
      } catch (err) {
        this.refused(err);
      } finally {
        this.busy = false;
      }
    },
    runParams() {
      return this.pictureSubject ? { ...this.params, picture_ref: this.pictureRef } : this.params;
    },
    // The same run already going (409) is news, not a failure; a refusal of the form (400) keeps it open to fix.
    refused(err) {
      const msg = extractApiMessage(err, this.$t("notifications.error"));
      this.notify.spawnNotification({ type: isConflict(err) ? "informative" : "negative", msg });
      if (err?.httpStatus !== 400) this.$emit("close");
    },
    async saveTemplate() {
      this.busy = true;
      try {
        // Every template, not only the runnable ones: a hidden one or another module's may hold the key.
        const { data: all } = await GET_Templates();
        const body = newTemplateBody({
          label: this.templateLabel,
          worker: this.worker,
          params: { ...keptParams(this.template?.params), ...this.params },
          rules: this.template?.rules || [],
          templates: listOf(all),
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
