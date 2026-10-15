<template>
  <PageLayout class="template-edit fs-300 t-body">
    <template #header>
      <PageHeader :title="isCreate ? $t('enrichment.templates.create') : form.label || $t('enrichment.templates.title')" :back="{ name: 'EnrichmentTemplates' }">
        <template v-if="!loading && !missing" #actions>
          <ActionBar>
            <IconButton
              v-if="!isCreate"
              mutates
              icon="delete"
              variant="danger"
              :label="$t('common.delete')"
              data-testid="template-delete"
              @click="confirmDelete = true"
            />
            <BasicButton mutates variant="primary" :disabled="!canSave" :loading="saving" data-testid="template-save" @click="save">
              {{ $t("common.save") }}
            </BasicButton>
          </ActionBar>
        </template>
      </PageHeader>
    </template>

    <Loader v-if="loading" block />
    <EmptyState
      v-else-if="missing"
      icon="empty"
      :title="$t('enrichment.templates.missing_title')"
      :message="$t('enrichment.templates.missing_hint')"
      data-testid="template-missing"
    >
      <router-link :to="{ name: 'EnrichmentTemplates' }" class="t-accent fw-600" data-testid="template-missing-back">
        {{ $t("enrichment.templates.back_to_list") }}
      </router-link>
    </EmptyState>

    <div v-else class="template-edit__form flex-column gap-6">
      <p v-if="unfilled.length" class="template-edit__unfilled fs-200 t-secondary m-0" role="status" data-testid="template-unfilled">
        {{ $t("enrichment.templates.unfilled", { fields: unfilled.join(", ") }) }}
      </p>
      <FormField :label="$t('enrichment.templates.name')" required>
        <BasicInput v-model="form.label" :maxlength="128" data-testid="template-label" />
      </FormField>
      <FormField :label="$t('enrichment.ai.worker')" required>
        <BasicSelect v-model="form.worker_key" :options="workerOptions" data-testid="template-worker" />
      </FormField>

      <AiParamsForm
        v-model="values"
        v-model:research="research"
        :fields="fields"
        :languages="catalog.languages"
        :field-choices="fieldChoices"
        :research-keys="researchKeys"
      />

      <FormField :label="$t('enrichment.templates.rules')" :hint="$t('enrichment.templates.rules_hint')">
        <BasicTextarea v-model="form.rules" :rows="4" data-testid="template-rules" />
      </FormField>
      <BasicSwitch
        v-model="form.active"
        :label="$t('enrichment.templates.active')"
        :hint="$t('enrichment.templates.active_hint')"
        data-testid="template-active"
      />
    </div>

    <ConfirmDialog
      tone="danger"
      :confirm-label="$t('common.delete')"
      :title="$t('enrichment.templates.confirm_delete_title')"
      :open="confirmDelete"
      @confirm="remove"
      @cancel="confirmDelete = false"
    >
      <p>{{ $t("enrichment.templates.confirm_delete") }}</p>
    </ConfirmDialog>
    <ConfirmDialog
      :open="!!pendingNav"
      :title="$t('unsaved.title')"
      :message="$t('unsaved.message')"
      :confirm-label="$t('unsaved.save_and_leave')"
      :discard-label="$t('unsaved.discard')"
      @confirm="saveAndLeave"
      @discard="confirmLeave"
      @cancel="cancelLeave"
    />
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { withStoredOption } from "@/utils/options";
import { isNotFound } from "@/api/createClient";
import {
  DELETE_Template,
  GET_Template,
  GET_Templates,
  GET_Workers,
  PATCH_Template,
  POST_Template,
} from "@/api/enrichment/api";
import { fieldOptions, loadCatalog } from "@/views/EnrichmentReview/fieldCatalog";
import AiParamsForm from "@/views/Pim/components/enrichment/AiParamsForm.vue";
import {
  buildFields,
  buildParams,
  defaultResearch,
  defaultValues,
  keptParams,
  missingRequired,
  presetValues,
  researchKeys,
} from "@/views/Pim/components/enrichment/aiTaskForm";
import { nextPosition, parseRules, templateKey, templateParams } from "@/views/Pim/components/enrichment/templateForm";

const MODULE = "pim";

// One AI template: its name, the worker it runs, what that worker is told (fields, languages, instructions, research
// preset — the same form as the run dialog), its rules one per line, and whether the Run AI menu offers it. Field
// names and languages come from the active PIM channel's catalog; the template itself serves every channel. Leaving
// with unsaved edits asks first.
export default {
  name: "TemplateEdit",
  components: { AiParamsForm },
  setup() {
    return { notify: useNotifyStore(), pimChannel: usePimChannelStore(), ...useUnsavedChanges() };
  },
  data() {
    return {
      form: { label: "", worker_key: "", rules: "", active: true },
      stored: null,
      values: {},
      research: defaultResearch(),
      workers: [],
      catalog: { fields: [], languages: [] },
      loading: false,
      saving: false,
      confirmDelete: false,
      missing: false,
      // The form as loaded or last saved (JSON); null until the page is ready.
      baseline: null,
    };
  },
  computed: {
    isCreate() {
      return !this.$route.params.key;
    },
    worker() {
      return this.workers.find((w) => w.key === this.form.worker_key) || null;
    },
    fields() {
      return buildFields(this.worker?.params_schema, this.worker?.kind);
    },
    workerOptions() {
      const options = this.workers.map((w) => ({ label: w.label || w.key, value: w.key }));
      return withStoredOption(options, this.form.worker_key, this.stored?.worker_label);
    },
    fieldChoices() {
      return fieldOptions(this.catalog.fields, this.worker?.kind);
    },
    researchKeys() {
      return researchKeys(this.worker?.kind, this.stored?.params?.augment);
    },
    // What still stops Save, by the names the form shows.
    unfilled() {
      const required = missingRequired(this.fields, this.values);
      return [
        !this.form.label.trim() && this.$t("enrichment.templates.name"),
        !this.worker && this.$t("enrichment.ai.worker"),
        ...this.fields.filter((field) => required.includes(field.name)).map((field) => field.title),
      ].filter(Boolean);
    },
    canSave() {
      return !this.unfilled.length && !this.saving;
    },
    editState() {
      return JSON.stringify({ form: this.form, values: this.values, research: this.research });
    },
    dirty() {
      return this.baseline !== null && this.editState !== this.baseline;
    },
  },
  watch: {
    "form.worker_key": "applyValues",
    dirty(on) {
      this.isDirty = on;
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  async mounted() {
    this.loading = true;
    await Promise.all([this.loadWorkers(), this.loadCatalog(), this.isCreate ? null : this.loadTemplate()]);
    this.loading = false;
    this.applyValues();
    await this.$nextTick();
    this.baseline = this.editState;
  },
  methods: {
    async saveAndLeave() {
      await this.save();
      if (this.isDirty) this.cancelLeave();
      else this.confirmLeave();
    },
    // Saved or deleted: nothing left to lose, leaving asks nothing.
    settle() {
      this.baseline = this.editState;
      this.isDirty = false;
    },
    async loadWorkers() {
      try {
        const { data } = await GET_Workers({ target_module: MODULE });
        this.workers = data;
      } catch (err) {
        this.failed(err);
      }
    },
    async loadCatalog() {
      this.catalog = await loadCatalog(this.pimChannel.activeChannelIdx);
    },
    async loadTemplate() {
      try {
        const { data } = await GET_Template(this.$route.params.key);
        this.stored = data;
        this.form = { label: data.label, worker_key: data.worker_key, rules: data.rules.join("\n"), active: data.active };
      } catch (err) {
        if (isNotFound(err)) this.missing = true;
        else this.failed(err);
      }
    },
    // The stored params while the template keeps its worker; another worker starts from its defaults.
    applyValues() {
      const languages = this.catalog.languages;
      const base = defaultValues(this.fields, { languages, mainLanguage: languages[0] || "" });
      const own = this.ownParams();
      this.values = presetValues(this.fields, base, own);
      this.research = defaultResearch(own);
    },
    ownParams() {
      return this.stored?.worker_key === this.form.worker_key ? this.stored.params : {};
    },
    body() {
      const params = buildParams(this.fields, this.values, this.researchKeys.length ? this.research : null);
      return {
        label: this.form.label.trim(),
        worker_key: this.form.worker_key,
        params: templateParams({ ...keptParams(this.ownParams()), ...params }),
        rules: parseRules(this.form.rules),
        active: this.form.active,
      };
    },
    async createBody() {
      const { data } = await GET_Templates({ target_module: MODULE });
      const key = templateKey(this.form.label, data.map((t) => t.key));
      return { key, ...this.body(), position: nextPosition(data) };
    },
    async save() {
      if (!this.canSave) return;
      this.saving = true;
      try {
        if (this.isCreate) await POST_Template(await this.createBody());
        else await PATCH_Template(this.$route.params.key, this.body());
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.templates.saved") });
        this.settle();
        if (!this.pendingNav) this.$router.push({ name: "EnrichmentTemplates" });
      } catch (err) {
        this.failed(err);
      } finally {
        this.saving = false;
      }
    },
    async remove() {
      this.confirmDelete = false;
      try {
        await DELETE_Template(this.$route.params.key);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.templates.deleted") });
        this.settle();
        this.$router.push({ name: "EnrichmentTemplates" });
      } catch (err) {
        this.failed(err);
      }
    },
    failed(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>

<style lang="scss" scoped>
.template-edit__form {
  max-width: 720px;
}
</style>
