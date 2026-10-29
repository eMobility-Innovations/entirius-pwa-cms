<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="pageTitle" back="/pim/gap-definitions">
        <template #meta>
          <PimChannelSelect />
        </template>
        <template v-if="!loading" #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

    <Loader block v-if="loading" />

    <template v-else>
      <BasicCard :title="$t('pim.gap_definition_detail')" gap class="mb-8">
        <div class="form-grid">
          <FormField
            :label="$t('pim.gap_key')"
            :required="isCreate"
            hint-level="important"
            :hint="$t('pim.gap_key_hint')"
            :error="fieldErr('key')"
          >
            <BasicInput v-model="form.key" format="key" :maxlength="64" :disabled="!isCreate" />
          </FormField>

          <FormField :label="$t('pim.gap_check')" :error="fieldErr('check_key')">
            <BasicSelect
              :options="checkOptions"
              v-model="form.check_key"
              :placeholder="$t('common.select')"
              @update:model-value="onCheckSelect"
            />
          </FormField>

          <!-- check-specific params -->
          <FormField
            v-if="!rawParamsMode && needsFeature"
            :label="$t('pim.gap_param_feature')"
            :error="fieldErr('params')"
          >
            <BasicSelect
              :options="featureOptions"
              v-model="paramFeatureIdx"
              :placeholder="$t('pim.gap_param_feature_ph')"
            />
          </FormField>

          <FormField
            v-if="!rawParamsMode && needsMinLength"
            :label="$t('pim.gap_param_min_length')"
          >
            <NumberInput v-model="paramMinLength" :min="1" :max="100000" />
          </FormField>

          <FormField
            v-if="!rawParamsMode && needsRole"
            :label="$t('pim.gap_param_role')"
            :hint="$t('pim.gap_param_role_hint')"
          >
            <BasicSelect
              :options="roleOptions"
              v-model="paramRole"
              :placeholder="$t('pim.gap_param_role_any')"
            />
          </FormField>

          <FormField :label="$t('pim.gap_severity')" :error="fieldErr('severity')">
            <BasicSelect
              :options="severityOptions"
              v-model="form.severity"
              :placeholder="$t('common.select')"
            />
          </FormField>

          <FormField :label="$t('pim.gap_order')">
            <NumberInput v-model="displayOrderStr" :min="0" :max="100000" />
          </FormField>

          <BasicSwitch
            :label="$t('pim.gap_active')"
            v-model="form.active"
          />
          <BasicSwitch
            :label="$t('pim.gap_raw_params')"
            :model-value="rawParamsMode"
            @update:model-value="toggleRawParams"
          />
          <FormField
            v-if="rawParamsMode"
            :label="$t('pim.gap_params_json')"
            :error="rawParamsError"
            class="form-grid__wide"
          >
            <BasicTextarea v-model="rawParamsText" :rows="4" />
          </FormField>
        </div>
      </BasicCard>

      <BasicCard :title="$t('pim.gap_label')" gap class="mb-8">
        <div class="form-grid">
          <FormField
            v-for="lang in labelLangs"
            :key="lang"
            :label="`${$t('pim.gap_label')} (${lang.toUpperCase()})`"
          >
            <BasicInput
              :model-value="form.label_t9n[lang] || ''"
              @update:model-value="(val) => setLabel(lang, val)"
            />
          </FormField>
        </div>
      </BasicCard>

      <BasicCard :title="$t('pim.gap_scope')" gap class="mb-8">
        <div class="form-grid">
          <FormField :label="$t('pim.gap_languages')" :hint="$t('pim.gap_scope_all_hint')">
            <div class="filter-chip-row" role="group" :aria-label="$t('pim.gap_languages')">
              <FilterChip
                v-for="lang in availableLangs"
                :key="lang"
                :label="lang.toUpperCase()"
                :active="form.languages.includes(lang)"
                @click="toggleLanguage(lang)"
              />
            </div>
          </FormField>
          <FormField :label="$t('pim.gap_channels')" :hint="$t('pim.gap_scope_all_hint')">
            <ChannelMultiSelect
              v-model="form.channels"
              :channels="pimChannel.channels"
              :label="$t('pim.gap_channels')"
              :all-label="$t('pim.gap_scope_all')"
            />
          </FormField>
        </div>
      </BasicCard>
    </template>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      :title="$t('pim.confirm_delete_title')"
      @confirm="deleteRule"
      @cancel="showDeleteConfirm = false"
    >
      <template #default>
        <p>{{ $t("pim.confirm_delete_gap_definition") }}</p>
      </template>
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useQualityStore } from "@/stores/quality";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_GapDefinition,
  POST_GapDefinition,
  PATCH_GapDefinition,
  DELETE_GapDefinition,
  GET_Features,
} from "@/api/pim/api";
import PimChannelSelect from "./components/PimChannelSelect.vue";

const FEATURE_CHECKS = ["feature_present", "feature_min_length"];
const PICTURE_ROLES = ["MAIN", "GENERAL", "VARIANT", "ANGLE"];

function normalizedParams(obj) {
  // stable stringify of a flat params object for change detection
  return JSON.stringify(
    Object.keys(obj || {})
      .sort()
      .reduce((acc, k) => ((acc[k] = obj[k]), acc), {})
  );
}

export default {
  name: "GapDefinitionEdit",
  components: { PimChannelSelect },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const quality = useQualityStore();
    const formErrors = useFormErrors();
    return { loader, notify, pimChannel, quality, ...formErrors };
  },
  data() {
    return {
      form: {
        key: "",
        check_key: "feature_present",
        severity: "critical",
        label_t9n: {},
        languages: [],
        channels: [],
        active: true,
        display_order: 0,
      },
      paramFeatureIdx: "",
      paramMinLength: "1",
      paramRole: "",
      displayOrderStr: "0",
      rawParamsMode: false,
      rawParamsText: "{}",
      rawParamsError: "",
      featureOptions: [],
      original: null,
      loading: false,
      showDeleteConfirm: false,
    };
  },
  computed: {
    isCreate() {
      return !this.$route.params.key;
    },
    pageTitle() {
      if (this.isCreate) return this.$t("pim.create_gap_definition");
      return this.form.key || this.$route.params.key;
    },
    headerActions() {
      return [
        ...(!this.isCreate
          ? [{ key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
              testid: "gap-delete-btn", onClick: () => (this.showDeleteConfirm = true) }]
          : []),
        { key: "save", role: "primary", label: this.$t("common.save"), testid: "gap-save-btn", onClick: this.save },
      ];
    },
    needsFeature() {
      return FEATURE_CHECKS.includes(this.form.check_key);
    },
    needsMinLength() {
      return this.form.check_key === "feature_min_length";
    },
    needsRole() {
      return this.form.check_key === "picture_present";
    },
    checkOptions() {
      return ["feature_present", "feature_min_length", "picture_present"].map((c) => ({
        label: this.checkLabel(c),
        value: c,
      }));
    },
    severityOptions() {
      return [
        { label: this.$t("pim.gap_critical"), value: "critical" },
        { label: this.$t("pim.gap_warning"), value: "warning" },
      ];
    },
    roleOptions() {
      return [
        { label: this.$t("pim.gap_param_role_any"), value: "" },
        ...PICTURE_ROLES.map((r) => ({ label: r, value: r })),
      ];
    },
    availableLangs() {
      const langs = this.pimChannel.allLanguages || [];
      return langs.length ? langs : ["en", "pl"];
    },
    labelLangs() {
      const set = new Set(this.availableLangs);
      Object.keys(this.form.label_t9n || {}).forEach((l) => set.add(l));
      return Array.from(set);
    },
  },
  async mounted() {
    // Soft-compat self-guard: no gaps API → leave quietly (no screen).
    if (this.quality.available === null) await this.quality.probe();
    if (this.quality.available === false) {
      this.$router.replace("/pim/products");
      return;
    }
    this.fetchFeatures();
    if (!this.isCreate) this.fetchRule();
  },
  methods: {
    fieldErr(name) {
      return this.getFieldError(name)?.msg || "";
    },
    checkLabel(checkKey) {
      const key = `pim.gap_check_${checkKey}`;
      const label = this.$t(key);
      return label === key ? checkKey : label;
    },
    onCheckSelect(val) {
      this.form.check_key = val;
    },
    setLabel(lang, val) {
      this.form.label_t9n = { ...this.form.label_t9n, [lang]: val };
    },
    toggleLanguage(lang) {
      const i = this.form.languages.indexOf(lang);
      if (i > -1) this.form.languages.splice(i, 1);
      else this.form.languages.push(lang);
    },
    async fetchFeatures() {
      try {
        const { data } = await GET_Features({ page_size: 500 });
        const results = data.results || data || [];
        this.featureOptions = results.map((f) => ({
          label: f.name || f.idx,
          value: f.idx,
        }));
      } catch {
        this.featureOptions = [];
      }
    },
    async fetchRule() {
      this.loading = true;
      try {
        const { data } = await GET_GapDefinition(this.$route.params.key);
        this.original = data;
        this.form = {
          key: data.key,
          check_key: data.check_key,
          severity: data.severity,
          label_t9n: { ...(data.label_t9n || {}) },
          languages: [...(data.languages || [])],
          channels: [...(data.channels || [])],
          active: data.active,
          display_order: data.display_order,
        };
        this.displayOrderStr = String(data.display_order ?? 0);
        const p = data.params || {};
        this.paramFeatureIdx = p.feature_idx || "";
        this.paramMinLength = p.min_length != null ? String(p.min_length) : "1";
        this.paramRole = p.role || "";
        this.rawParamsText = JSON.stringify(p, null, 2);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    toggleRawParams() {
      if (!this.rawParamsMode) {
        // entering raw mode — seed from the structured params
        this.rawParamsText = JSON.stringify(this.buildStructuredParams(), null, 2);
        this.rawParamsMode = true;
      } else {
        // leaving raw mode — try to hydrate the structured fields back
        try {
          const parsed = JSON.parse(this.rawParamsText || "{}");
          this.paramFeatureIdx = parsed.feature_idx || "";
          this.paramMinLength = parsed.min_length != null ? String(parsed.min_length) : "1";
          this.paramRole = parsed.role || "";
          this.rawParamsError = "";
        } catch {
          // keep raw mode if it doesn't parse
          this.rawParamsError = this.$t("pim.gap_params_json_invalid");
          return;
        }
        this.rawParamsMode = false;
      }
    },
    buildStructuredParams() {
      if (this.form.check_key === "feature_present") {
        return { feature_idx: this.paramFeatureIdx };
      }
      if (this.form.check_key === "feature_min_length") {
        return {
          feature_idx: this.paramFeatureIdx,
          min_length: parseInt(this.paramMinLength, 10) || 0,
        };
      }
      if (this.form.check_key === "picture_present") {
        return this.paramRole ? { role: this.paramRole } : {};
      }
      return {};
    },
    buildParams() {
      if (this.rawParamsMode) {
        return JSON.parse(this.rawParamsText || "{}"); // may throw → caught in save
      }
      return this.buildStructuredParams();
    },
    validateLocal(params) {
      this.clearErrors();
      let ok = true;
      if (this.isCreate && !this.form.key.trim()) {
        this.errors.key = { status: "error", msg: this.$t("pim.gap_key_required") };
        ok = false;
      }
      if (this.needsFeature && !params.feature_idx) {
        this.errors.params = { status: "error", msg: this.$t("pim.gap_param_feature_required") };
        ok = false;
      }
      if (this.needsMinLength && !(params.min_length >= 1)) {
        this.errors.params = { status: "error", msg: this.$t("pim.gap_param_min_length_required") };
        ok = false;
      }
      return ok;
    },
    async save() {
      let params;
      try {
        params = this.buildParams();
      } catch {
        this.rawParamsError = this.$t("pim.gap_params_json_invalid");
        return;
      }
      this.rawParamsError = "";
      if (!this.validateLocal(params)) return;
      if (this.isCreate && !this.validateFormats(this.form, { key: { format: "key" } })) return;

      const payload = {
        check_key: this.form.check_key,
        params,
        severity: this.form.severity,
        label_t9n: this.form.label_t9n,
        languages: this.form.languages.length ? this.form.languages : null,
        channels: this.form.channels.length ? this.form.channels : null,
        active: this.form.active,
        display_order: parseInt(this.displayOrderStr, 10) || 0,
      };

      this.loader.loaderStart();
      try {
        if (this.isCreate) {
          await POST_GapDefinition({ key: this.form.key.trim(), ...payload });
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("pim.gap_definition_created"),
          });
        } else {
          await PATCH_GapDefinition(this.form.key, payload);
          this.notifyEditOutcome(payload);
        }
        this.$router.push("/pim/gap-definitions");
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
    // Severity-only edits apply on the spot (backend fast-path, no catalogue restale);
    // any condition change marks the catalogue stale → the list banner asks for a recompute.
    notifyEditOutcome(payload) {
      const o = this.original || {};
      const conditionUnchanged =
        o.check_key === payload.check_key &&
        normalizedParams(o.params) === normalizedParams(payload.params) &&
        JSON.stringify(o.languages ?? null) === JSON.stringify(payload.languages) &&
        JSON.stringify(o.channels ?? null) === JSON.stringify(payload.channels) &&
        o.active === payload.active;
      const severityChanged = o.severity !== payload.severity;
      const msg =
        conditionUnchanged && severityChanged
          ? this.$t("pim.gaps_applied_immediately")
          : this.$t("pim.gap_definition_saved");
      this.notify.spawnNotification({ type: "positive", msg });
    },
    async deleteRule() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_GapDefinition(this.form.key);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.gap_definition_deleted"),
        });
        this.$router.push("/pim/gap-definitions");
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
