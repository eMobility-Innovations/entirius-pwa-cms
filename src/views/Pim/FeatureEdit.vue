<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader :title="pageTitle" back="/pim/features">
        <template #meta>
          <PimChannelSelect />
        </template>
        <template #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else>
        <!-- System feature notice -->
        <div
          v-if="isSystem && !isCreate"
          class="flex ai-ct gap-5 mb-8 p-8 bg-accent-subtle rounded t-strong fs-200"
        >
          <FontAwesomeIcon :icon="$icons.lock" />
          <span>{{ $t("pim.system_feature_notice") }}</span>
        </div>

        <BasicCard :title="$t('pim.general_info')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('pim.feature_code')"
              :hint="$t('pim.attribute_code_help')"
              :required="isCreate"
              :error="formErrors.getFieldError('idx')?.msg || ''"
            >
              <BasicInput v-if="isCreate" v-model="form.idx" format="key" :maxlength="128" />
              <BasicInput v-else :model-value="form.idx" readonly />
            </FormField>
            <FormField
              :label="$t('pim.feature_type')"
              :hint="$t('pim.feature_type_help')"
            >
              <BasicSelect
                :options="typeOptions"
                v-model="form.feature_type"
                :placeholder="$t('pim.feature_type')"
                :disabled="isSystem"
                @update:model-value="onTypeSelect"
              />
            </FormField>
            <FormField
              :label="$t('pim.scope')"
              :hint="$t('pim.scope_help')"
            >
              <BasicInput :model-value="selectedScopeLabel" readonly />
            </FormField>
            <FormField :label="$t('pim.display_order')" :error="formErrors.getFieldError('display_order')?.msg || ''">
              <BasicInput v-model="form.display_order" format="integer" inputmode="numeric" :min="0" />
            </FormField>
            <FormField :label="$t('pim.frontend_input_type')">
              <BasicSelect
                :options="frontendInputOptions"
                v-model="form.frontend_input_type"
                :placeholder="$t('pim.frontend_input_type')"
              />
            </FormField>
            <FormField :label="$t('pim.filter_type')">
              <BasicSelect
                :options="filterTypeOptions"
                v-model="form.filter_type"
                :placeholder="$t('pim.filter_type')"
              />
            </FormField>
            <FormField
              v-if="hasDesc"
              :label="$t('pim.internal_desc_label')"
              :hint="$t('pim.internal_desc_tooltip')"
              class="form-grid__wide"
            >
              <BasicTextarea v-model="form.desc" />
            </FormField>
          </div>
        </BasicCard>

        <BasicCard :title="$t('pim.labels')" gap class="mb-8">
          <p class="fs-200 t-muted">{{ $t("pim.base_language") }}</p>
          <div class="form-grid">
            <FormField
              v-for="lang in languages"
              :key="lang"
              :label="`${$t('pim.name')} (${lang.toUpperCase()})`"
            >
              <BasicInput
                :model-value="form.name_t9n[lang] || ''"
                @update:model-value="(val) => (form.name_t9n[lang] = val)"
              />
            </FormField>
          </div>
        </BasicCard>

        <BasicCard :title="$t('pim.flags_and_options')" gap>
          <div class="form-grid">
            <BasicSwitch
              :label="$t('pim.is_required')"
              v-model="form.is_required"
              :disabled="isSystem"
            />
            <BasicSwitch
              :label="$t('pim.is_visible')"
              v-model="form.is_visible"
            />
            <BasicSwitch
              :label="$t('pim.is_filterable')"
              v-model="form.is_filterable"
            />
            <BasicSwitch
              :label="$t('pim.is_searchable')"
              v-model="form.is_searchable"
            />
            <BasicSwitch
              :label="$t('pim.is_comparable')"
              v-model="form.is_comparable"
            />
            <BasicSwitch
              :label="$t('pim.is_for_customization')"
              v-model="form.is_for_customization"
            />
            <BasicSwitch
              :label="$t('pim.exclude_from_inheritance')"
              v-model="form.exclude_from_inheritance"
            />
            <BasicSwitch
              :label="$t('pim.has_visual_asset')"
              v-model="form.has_visual_asset"
            />
            <BasicSwitch
              :label="$t('pim.is_seo')"
              v-model="form.is_seo"
            />
          </div>

          <!-- Options Manager (only for Select/Multi-select) -->
          <OptionsManager v-if="isSelectType" :feature-idx="form.idx" :languages="languages" />
        </BasicCard>
      </template>

      <!-- Delete confirmation -->
      <ConfirmDialog
        tone="danger"
        :open="showDeleteConfirm"
        :title="$t('pim.confirm_delete_title')"
        @confirm="deleteFeature"
        @cancel="showDeleteConfirm = false"
      >
        <template #default>
          <p>{{ $t("pim.confirm_delete_feature") }}</p>
        </template>
      </ConfirmDialog>

      <!-- Unsaved changes modal -->
      <ConfirmDialog
        :open="!!pendingNav"
        @confirm="saveAndLeave"
        @discard="confirmLeave"
        @cancel="cancelLeave"
        :title="$t('unsaved.title')"
        :message="$t('unsaved.message')"
        :confirm-label="$t('unsaved.save_and_leave')"
        :discard-label="$t('unsaved.discard')"
      />
  </PageLayout>
</template>

<script>
import { inject, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { usePimChannelStore } from "@/stores/pimChannel";
import {
  GET_Feature,
  POST_Feature,
  PATCH_Feature,
  DELETE_Feature,
} from "@/api/pim/api";
import {
  FEATURE_TYPES,
  FEATURE_SCOPES,
  FRONTEND_INPUT_TYPES,
  FILTER_TYPES,
  isSelectType as checkSelectType,
} from "./helpers/pimEnums";
import OptionsManager from "./components/OptionsManager.vue";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";

const ORDER_FORMAT = { display_order: { format: "integer", min: 0 } };
const CREATE_FORMATS = { ...ORDER_FORMAT, idx: { format: "key" } };

export default {
  name: "FeatureEdit",
  components: {
    OptionsManager,
    PimChannelSelect,
  },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const unsaved = useUnsavedChanges();
    const pimChannel = usePimChannelStore();
    const formErrors = useFormErrors();
    const isGlobalScope = inject("isGlobalScope", null);
    onMounted(() => {
      nextTick(() => {
        if (isGlobalScope) isGlobalScope.value = true;
      });
    });
    onBeforeUnmount(() => {
      if (isGlobalScope) isGlobalScope.value = false;
    });
    return { loader, notify, pimChannel, formErrors, ...unsaved };
  },
  data() {
    return {
      form: {
        idx: "",
        feature_type: 3,
        scope: 3,
        frontend_input_type: 0,
        filter_type: 0,
        display_order: 0,
        name_t9n: {},
        is_required: false,
        is_visible: true,
        is_filterable: false,
        is_searchable: false,
        is_comparable: false,
        is_for_customization: false,
        exclude_from_inheritance: false,
        has_visual_asset: false,
        is_seo: false,
        desc: "",
      },
      originalData: null,
      loading: false,
      showDeleteConfirm: false,
      // Soft-compat: old backend omits `desc` → field hidden. Create mode: shown
      // (old backend ignores the extra POST field — schemas don't forbid extras).
      hasDesc: true,
    };
  },
  computed: {
    languages() {
      return this.pimChannel.allLanguages.length > 0
        ? this.pimChannel.allLanguages
        : ["en"];
    },
    isCreate() {
      return this.$route.params.idx === "create";
    },
    isSystem() {
      return this.form.scope === 1;
    },
    featureName() {
      return this.form.name_t9n?.en || this.form.name_t9n?.pl || this.form.idx;
    },
    isSelectType() {
      return checkSelectType(this.form.feature_type);
    },
    typeOptions() {
      return FEATURE_TYPES.map((ft) => ({
        label: this.$t(ft.labelKey),
        value: ft.value,
      }));
    },
    frontendInputOptions() {
      return FRONTEND_INPUT_TYPES.map((ft) => ({
        label: ft.label,
        value: ft.value,
      }));
    },
    filterTypeOptions() {
      return FILTER_TYPES.map((ft) => ({ label: ft.label, value: ft.value }));
    },
    selectedTypeLabel() {
      const ft = FEATURE_TYPES.find((t) => t.value === this.form.feature_type);
      return ft ? this.$t(ft.labelKey) : "";
    },
    selectedScopeLabel() {
      const s = FEATURE_SCOPES.find((sc) => sc.value === this.form.scope);
      return s ? this.$t(s.labelKey) : "";
    },
    selectedFrontendInputLabel() {
      const ft = FRONTEND_INPUT_TYPES.find(
        (t) => t.value === this.form.frontend_input_type
      );
      return ft ? ft.label : "";
    },
    selectedFilterTypeLabel() {
      const ft = FILTER_TYPES.find((t) => t.value === this.form.filter_type);
      return ft ? ft.label : "";
    },
    pageTitle() {
      if (this.isCreate) return this.$t("pim.create_feature");
      return this.featureName || this.$t("pim.feature_detail");
    },
    headerActions() {
      return [
        ...(!this.isCreate && !this.isSystem
          ? [{ key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
              onClick: () => (this.showDeleteConfirm = true) }]
          : []),
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.save },
      ];
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  mounted() {
    if (!this.isCreate) {
      this.fetchFeature();
    } else {
      this.snapshot(this.form);
      this.track(this.form);
    }
  },
  methods: {
    async saveAndLeave() {
      await this.save();
      this.confirmLeave();
    },
    onTypeSelect(val) {
      this.form.feature_type = val;
    },
    populateForm(data) {
      return {
        idx: data.idx || "",
        feature_type: data.feature_type ?? 3,
        scope: data.scope ?? 3,
        frontend_input_type: data.frontend_input_type ?? 0,
        filter_type: data.filter_type ?? 0,
        display_order: data.display_order ?? 0,
        name_t9n: data.name_t9n || {},
        is_required: data.is_required || false,
        is_visible: data.is_visible ?? true,
        is_filterable: data.is_filterable || false,
        is_searchable: data.is_searchable || false,
        is_comparable: data.is_comparable || false,
        is_for_customization: data.is_for_customization || false,
        exclude_from_inheritance: data.exclude_from_inheritance || false,
        has_visual_asset: data.has_visual_asset || false,
        is_seo: data.is_seo || false,
        desc: data.desc || "",
      };
    },
    async fetchFeature() {
      this.loading = true;
      try {
        const { data } = await GET_Feature(this.$route.params.idx);
        this.hasDesc = "desc" in data;
        this.form = this.populateForm(data);
        this.originalData = this.populateForm(data);
        this.snapshot(this.form);
        this.track(this.form);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    extractErrorMessage(err) {
      const errData = err?.response?.data || err;
      let msg = this.$t("notifications.save_error");
      if (errData?.message) {
        msg = errData.message;
        if (errData.details?.length) {
          const fieldErrors = errData.details
            .map((d) =>
              d.field ? `${d.field}: ${d.description}` : d.description
            )
            .join(", ");
          msg += ` (${fieldErrors})`;
        }
      } else if (errData?.detail) {
        msg = errData.detail;
      }
      return msg;
    },
    buildSelectivePayload() {
      const payload = {};
      const orig = this.originalData;
      const changedFields = [];

      const scalarFields = [
        "feature_type",
        "frontend_input_type",
        "filter_type",
      ];
      for (const field of scalarFields) {
        if (this.form[field] !== orig[field]) {
          payload[field] = this.form[field];
          changedFields.push(field);
        }
      }

      const boolFields = [
        "is_required",
        "is_visible",
        "is_filterable",
        "is_searchable",
        "is_comparable",
        "is_for_customization",
        "exclude_from_inheritance",
        "has_visual_asset",
        "is_seo",
      ];
      for (const field of boolFields) {
        if (this.form[field] !== orig[field]) {
          payload[field] = this.form[field];
          changedFields.push(field);
        }
      }

      const order = Number(this.form.display_order) || 0;
      if (order !== (orig.display_order || 0)) {
        payload.display_order = order;
        changedFields.push("display_order");
      }

      if (this.hasDesc && (this.form.desc || "") !== (orig.desc || "")) {
        payload.desc = this.form.desc;
        changedFields.push("desc");
      }

      const origT9n = orig.name_t9n || {};
      const formT9n = this.form.name_t9n || {};
      const allLangs = new Set([
        ...Object.keys(formT9n),
        ...Object.keys(origT9n),
      ]);
      for (const lang of allLangs) {
        if ((formT9n[lang] || "") !== (origT9n[lang] || "")) {
          payload.name_t9n = formT9n;
          changedFields.push(this.$t("pim.labels"));
          break;
        }
      }

      return { payload, changedFields };
    },
    async save() {
      if (!this.formErrors.validateFormats(this.form, this.isCreate ? CREATE_FORMATS : ORDER_FORMAT)) return;
      this.loader.loaderStart();
      try {
        if (this.isCreate) {
          if (!this.form.idx) {
            this.notify.spawnNotification({
              type: "negative",
              msg: this.$t("pim.idx_and_name_required"),
            });
            this.loader.loaderFinish();
            return;
          }
          await POST_Feature(this.form);
          this.snapshot(this.form);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("pim.feature_created"),
          });
          this.$router.replace(`/pim/features/${this.form.idx}`);
        } else {
          const { payload, changedFields } = this.buildSelectivePayload();
          if (Object.keys(payload).length === 0) {
            this.notify.spawnNotification({
              type: "informative",
              msg: this.$t("pim.no_changes_detected"),
            });
            this.loader.loaderFinish();
            return;
          }
          await PATCH_Feature(this.form.idx, payload);
          await this.fetchFeature();
          this.notify.spawnNotification({
            type: "positive",
            msg: `${this.$t("pim.feature_saved")}: ${changedFields.join(", ")}`,
          });
        }
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractErrorMessage(err),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async deleteFeature() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_Feature(this.form.idx);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.feature_deleted"),
        });
        this.$router.push("/pim/features");
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
