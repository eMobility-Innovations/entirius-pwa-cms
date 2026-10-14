<template>
  <PageLayout class="template-edit fs-300 t-body">
    <template #header>
      <PageHeader :title="isCreate ? $t('enrichment.templates.create') : form.label || $t('enrichment.templates.title')" back="/enrichment/templates">
        <template v-if="!loading" #actions>
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

    <div v-else class="template-edit__form flex-column gap-6">
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
      <BasicSwitch v-model="form.active" :label="$t('enrichment.templates.active')" data-testid="template-active" />
    </div>

    <ConfirmDialog
      tone="danger"
      :title="$t('enrichment.templates.confirm_delete_title')"
      :open="confirmDelete"
      @confirm="remove"
      @cancel="confirmDelete = false"
    >
      <p>{{ $t("enrichment.templates.confirm_delete") }}</p>
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { extractApiMessage } from "@/composables/useFormErrors";
import { withStoredOption } from "@/utils/options";
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
  missingRequired,
  presetValues,
  researchKeys,
} from "@/views/Pim/components/enrichment/aiTaskForm";
import { nextPosition, parseRules, templateKey, templateParams } from "@/views/Pim/components/enrichment/templateForm";

const MODULE = "pim";

// One AI template: its name, the worker it runs, what that worker is told (fields, languages, instructions, research
// preset — the same form as the run dialog), its rules one per line, and whether the Run AI menu offers it. Field
// names and languages come from the active PIM channel's catalog; the template itself serves every channel.
export default {
  name: "TemplateEdit",
  components: { AiParamsForm },
  setup() {
    return { notify: useNotifyStore(), pimChannel: usePimChannelStore() };
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
    canSave() {
      return !!this.form.label.trim() && !!this.worker && !missingRequired(this.fields, this.values).length && !this.saving;
    },
  },
  watch: {
    "form.worker_key": "applyValues",
  },
  async mounted() {
    this.loading = true;
    await Promise.all([this.loadWorkers(), this.loadCatalog(), this.isCreate ? null : this.loadTemplate()]);
    this.loading = false;
    this.applyValues();
  },
  methods: {
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
        this.failed(err);
      }
    },
    // The stored params while the template keeps its worker; another worker starts from its defaults.
    applyValues() {
      const languages = this.catalog.languages;
      const base = defaultValues(this.fields, { languages, mainLanguage: languages[0] || "" });
      const own = this.stored?.worker_key === this.form.worker_key ? this.stored.params : {};
      this.values = presetValues(this.fields, base, own);
      this.research = defaultResearch(own);
    },
    body() {
      return {
        label: this.form.label.trim(),
        worker_key: this.form.worker_key,
        params: templateParams(buildParams(this.fields, this.values, this.researchKeys.length ? this.research : null)),
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
        this.$router.push({ name: "EnrichmentTemplates" });
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
