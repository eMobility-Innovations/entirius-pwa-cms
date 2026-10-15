<template>
  <PageLayout class="spawn-rule-edit fs-300 t-body">
    <template #header>
      <PageHeader
        :title="isCreate ? $t('enrichment.spawn_rules.create') : String(form.key || '')"
        :back="{ name: 'EnrichmentSpawnRules' }"
      >
        <template v-if="!loading" #actions>
          <ActionBar>
            <IconButton
              v-if="!isCreate"
              icon="delete"
              :label="$t('common.delete')"
              variant="danger"
              data-test="spawn-rule-delete-btn"
              @click="showDeleteConfirm = true"
            />
            <BasicButton mutates
              v-if="!isCreate"
              variant="secondary"
              data-test="spawn-rule-run-btn"
              @click="runRule"
            >
              {{ $t('enrichment.spawn_rules.run_now') }}
            </BasicButton>
            <BasicButton mutates
              variant="primary"
              data-test="spawn-rule-save-btn"
              @click="save"
            >
              {{ $t('common.save') }}
            </BasicButton>
          </ActionBar>
        </template>
      </PageHeader>
    </template>

      <Loader block v-if="loading" />

      <template v-else>
        <div class="spawn-rule-grid">
          <FormField
            :label="$t('enrichment.spawn_rules.col_key')"
            :required="isCreate"
            hint-level="important"
            :hint="$t('enrichment.spawn_rules.key_hint')"
            :error="fieldErr('key')"
          >
            <BasicInput v-model="form.key" :maxlength="64" :disabled="!isCreate" data-test="spawn-rule-key" />
          </FormField>

          <FormField
            :label="$t('enrichment.spawn_rules.col_module')"
            :hint="$t('enrichment.spawn_rules.module_hint')"
          >
            <BasicInput v-model="form.module" :disabled="true" />
          </FormField>

          <FormField
            :label="$t('enrichment.spawn_rules.col_check')"
            :hint="$t('enrichment.spawn_rules.check_hint')"
            :error="fieldErr('check_key')"
          >
            <BasicSelect
              v-if="checkOptions.length"
              :options="checkChoices"
              v-model="form.check_key"
              :placeholder="$t('common.select')"
            />
            <!-- Soft-compat: no PIM gaps API (old backend / other module) → free text. -->
            <BasicInput v-else v-model="form.check_key" :maxlength="64" data-test="spawn-rule-check-input" />
          </FormField>

          <FormField :label="$t('enrichment.spawn_rules.col_task_type')">
            <BasicSelect
              :options="taskTypeOptions"
              v-model="form.task_type"
              :placeholder="$t('common.select')"
            />
          </FormField>

          <FormField :label="$t('enrichment.spawn_rules.scope_channel')">
            <BasicSelect
              v-if="channelOptions.length"
              :options="channelOptions"
              :model-value="scopeChannel"
              :placeholder="$t('common.select')"
              @update:model-value="selectChannel"
            />
            <BasicInput
              v-else
              :modelValue="scopeChannel"
              data-test="spawn-rule-channel-input"
              @update:modelValue="selectChannel"
            />
          </FormField>

          <FormField
            :label="$t('enrichment.spawn_rules.scope_language')"
            :hint="$t('enrichment.spawn_rules.scope_language_hint')"
          >
            <BasicSelect
              :options="languageOptions"
              v-model="scopeLanguage"
              :placeholder="$t('enrichment.spawn_rules.all_languages')"
            />
          </FormField>

          <FormField
            :label="$t('enrichment.spawn_rules.limit')"
            :hint="$t('enrichment.spawn_rules.limit_hint')"
          >
            <BasicInput v-model="limitStr" :placeholder="$t('enrichment.spawn_rules.backend_default')" />
          </FormField>

          <FormField
            :label="$t('enrichment.spawn_rules.cooldown_days')"
            :hint="$t('enrichment.spawn_rules.cooldown_hint')"
          >
            <BasicInput
              v-model="cooldownStr"
              :placeholder="$t('enrichment.spawn_rules.backend_default')"
            />
          </FormField>

          <div class="flex ai-ct gap-8">
            <BasicSwitch
              :label="$t('enrichment.spawn_rules.col_auto')"
              v-model="form.auto"
            />
            <BasicSwitch
              :label="$t('enrichment.spawn_rules.col_active')"
              v-model="form.active"
            />
          </div>
        </div>
      </template>

      <ConfirmDialog
        tone="danger"
        :title="$t('enrichment.spawn_rules.confirm_delete_title')"
        :open="showDeleteConfirm"
        @confirm="deleteRule"
        @cancel="showDeleteConfirm = false"
      >
        <template #default>
          <p>{{ $t("enrichment.spawn_rules.confirm_delete") }}</p>
        </template>
      </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import {
  DELETE_SpawnRule,
  GET_SpawnRule,
  PATCH_SpawnRule,
  POST_SpawnRule,
  POST_SpawnRuleRun,
} from "@/api/enrichment/api";
import { GET_GapDefinitions } from "@/api/pim/api";
import { withStoredOption } from "@/utils/options";

const TASK_TYPES = ["fix-attribute", "fill-attribute", "translate"];
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export default {
  name: "SpawnRuleEdit",
  components: {},
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const formErrors = useFormErrors();
    return { loader, notify, pimChannel, ...formErrors };
  },
  data() {
    return {
      form: {
        key: "",
        module: "pim",
        check_key: "",
        task_type: "fix-attribute",
        task_params: {},
        params: {},
        auto: false,
        active: true,
      },
      scopeChannel: "",
      scopeLanguage: "",
      limitStr: "",
      cooldownStr: "",
      checkOptions: [],
      loading: false,
      showDeleteConfirm: false,
    };
  },
  computed: {
    isCreate() {
      return !this.$route.params.key;
    },
    checkChoices() {
      return withStoredOption(this.checkOptions, this.form.check_key);
    },
    taskTypeOptions() {
      const options = TASK_TYPES.map((t) => ({ label: this.taskTypeLabel(t), value: t }));
      return withStoredOption(options, this.form.task_type, this.taskTypeLabel(this.form.task_type));
    },
    // "" = no channel scope: the rule runs for every channel.
    channelOptions() {
      const channels = (this.pimChannel.channels || []).map((ch) => ({
        label: ch.name || ch.idx,
        value: ch.idx,
      }));
      if (!channels.length) return [];
      const all = { label: this.$t("enrichment.spawn_rules.all_channels"), value: "" };
      return withStoredOption([all, ...channels], this.scopeChannel);
    },
    // Languages of the selected channel (that's exactly what find_gaps filters on);
    // before a channel is picked, the union across channels. "" = all languages.
    channelLanguages() {
      const channel = (this.pimChannel.channels || []).find((ch) => ch.idx === this.scopeChannel);
      return channel ? channel.languages || [] : this.pimChannel.allLanguages || [];
    },
    languageOptions() {
      const options = [
        { label: this.$t("enrichment.spawn_rules.all_languages"), value: "" },
        ...this.channelLanguages.map((l) => ({ label: l, value: l })),
      ];
      return withStoredOption(options, this.scopeLanguage);
    },
  },
  async mounted() {
    if (!this.pimChannel.channels?.length) this.pimChannel.fetchChannels?.();
    this.fetchChecks();
    if (!this.isCreate) await this.fetchRule();
  },
  methods: {
    // Task types are free strings on the backend; a type without a label shows its code.
    taskTypeLabel(type) {
      const key = `enrichment.spawn_rules.task_types.${type}`;
      const label = this.$t(key);
      return label === key ? type : label;
    },
    // Only a channel the user picks drops a language it does not serve; a late channel load never does.
    selectChannel(channel) {
      this.scopeChannel = channel;
      if (!this.channelLanguages.includes(this.scopeLanguage)) this.scopeLanguage = "";
    },
    fieldErr(name) {
      return this.getFieldError(name)?.msg || "";
    },
    // The check catalogue lives in the source module (PIM gap definitions). The CMS may call
    // both APIs — soft-compat: when the call fails (old PIM, other module), fall back to free text.
    async fetchChecks() {
      try {
        const { data } = await GET_GapDefinitions({ page_size: 100, is_active: true });
        this.checkOptions = (data.results || []).map((d) => ({ label: d.key, value: d.key }));
      } catch {
        this.checkOptions = [];
      }
    },
    async fetchRule() {
      this.loading = true;
      try {
        const { data } = await GET_SpawnRule(this.$route.params.key);
        this.form = {
          key: data.key,
          module: data.module,
          check_key: data.check_key,
          task_type: data.task_type,
          task_params: data.task_params || {},
          params: data.params || {},
          auto: data.auto,
          active: data.active,
        };
        this.scopeChannel = data.scope?.channel || "";
        this.scopeLanguage = data.scope?.language || "";
        this.limitStr = data.limit != null ? String(data.limit) : "";
        this.cooldownStr = data.cooldown_days != null ? String(data.cooldown_days) : "";
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    validateLocal() {
      this.clearErrors();
      let ok = true;
      if (this.isCreate && !KEY_PATTERN.test(this.form.key.trim())) {
        this.errors.key = { status: "error", msg: this.$t("enrichment.spawn_rules.key_invalid") };
        ok = false;
      }
      if (!this.form.check_key.trim()) {
        this.errors.check_key = {
          status: "error",
          msg: this.$t("enrichment.spawn_rules.check_required"),
        };
        ok = false;
      }
      return ok;
    },
    buildPayload() {
      const scope = {};
      if (this.scopeChannel) scope.channel = this.scopeChannel;
      if (this.scopeLanguage) scope.language = this.scopeLanguage.toLowerCase();
      return {
        module: this.form.module.trim(),
        check_key: this.form.check_key.trim(),
        params: this.form.params,
        scope,
        task_type: this.form.task_type,
        task_params: this.form.task_params,
        limit: this.limitStr ? parseInt(this.limitStr, 10) : null,
        cooldown_days: this.cooldownStr !== "" ? parseInt(this.cooldownStr, 10) : null,
        auto: this.form.auto,
        active: this.form.active,
      };
    },
    async save() {
      if (!this.validateLocal()) return;
      const payload = this.buildPayload();

      this.loader.loaderStart();
      try {
        if (this.isCreate) {
          await POST_SpawnRule({ key: this.form.key.trim(), ...payload });
        } else {
          await PATCH_SpawnRule(this.form.key, payload);
        }
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.spawn_rules.saved"),
        });
        this.$router.push({ name: "EnrichmentSpawnRules" });
      } catch (err) {
        this.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: this.summary || this.$t("notifications.error"),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async runRule() {
      try {
        const { data } = await POST_SpawnRuleRun(this.form.key);
        const map = {
          spawned: { type: "positive", key: "enrichment.spawn_rules.run_spawned" },
          already_running: { type: "informative", key: "enrichment.spawn_rules.run_already_running" },
          no_candidates: { type: "informative", key: "enrichment.spawn_rules.run_no_candidates" },
        };
        const outcome = map[data.status] || map.spawned;
        this.notify.spawnNotification({
          type: outcome.type,
          msg: this.$t(outcome.key, { id: data.task?.id ?? "" }),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async deleteRule() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_SpawnRule(this.form.key);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.spawn_rules.deleted"),
        });
        this.$router.push({ name: "EnrichmentSpawnRules" });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.spawn-rule-edit {
  display: flex;
  flex-direction: column;
}
.spawn-rule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-8);
  align-items: end;
}
</style>
