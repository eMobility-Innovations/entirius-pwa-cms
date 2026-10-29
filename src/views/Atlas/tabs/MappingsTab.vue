<template>
  <div class="flex flex-column">
    <div class="flex ai-ct jc-sb mb-8">
      <h2 class="fs-400 fw-600">{{ $t("atlas.tabs.mappings") }}</h2>
      <BasicButton
        variant="primary"
        data-testid="mappings-create-profile-btn"
        @click="openCreate"
      >
        {{ $t("atlas.mappings.create_profile") }}
      </BasicButton>
    </div>

    <Loader block v-show="loading" />

    <div v-show="!loading">
      <BasicCard
        v-for="profile in profiles"
        :key="profile.idx"
        class="mapping-profile mb-5"
        :data-testid="`mapping-profile-${profile.idx}`"
      >
        <div class="flex ai-ct jc-sb gap-5 flex-wrap mb-5">
          <div class="flex ai-ct gap-5 flex-wrap">
            <strong class="t-body">{{
              profile.name || profile.idx
            }}</strong>
            <span class="t-muted fs-200">({{ profile.idx }})</span>
            <StatusBadge
              v-for="ch in profile.target_channel_idxs || []"
              :key="ch"
              :label="ch"
              tone="info"
            />
            <StatusBadge
              :label="
                profile.is_active ? $t('common.active') : $t('common.inactive')
              "
              :tone="profile.is_active ? 'positive' : 'negative'"
            />
            <BasicButton
              v-if="validationBadge(profile)"
              variant="ghost"
              size="sm"
              :aria-expanded="String(!!profile._expandValidation)"
              :data-testid="`mapping-validation-badge-${profile.idx}`"
              @click="toggleValidationDetail(profile)"
            >
              <StatusBadge
                :label="validationBadge(profile).label"
                :tone="validationBadge(profile).variant"
              />
            </BasicButton>
          </div>
          <div class="flex ai-ct gap-2">
            <BasicButton
              size="sm"
              :data-testid="`mapping-edit-profile-${profile.idx}`"
              @click="openEdit(profile)"
            >
              {{ $t("common.edit") }}
            </BasicButton>
            <BasicButton :mutates="false"
              size="sm"
              :data-testid="`mapping-validate-${profile.idx}`"
              @click="validateProfile(profile)"
            >
              {{ $t("atlas.mappings.validate") }}
            </BasicButton>
            <IconButton
              icon="delete"
              variant="danger"
              size="sm"
              :label="$t('common.delete')"
              :data-testid="`mapping-delete-profile-${profile.idx}`"
              @click="confirmDeleteProfile(profile)"
            />
          </div>
        </div>
        <div
          v-if="profile._expandValidation && profile._validation"
          class="validation-detail mb-5 p-5 b-subtle rounded"
          :data-testid="`mapping-validation-detail-${profile.idx}`"
        >
          <div
            v-for="(group, kind) in groupedValidation(profile)"
            :key="kind"
            class="mb-2"
          >
            <h4 class="fs-200 fw-600 t-secondary mb-1">
              {{ kind }} ({{ group.length }})
            </h4>
            <ul class="validation-list">
              <li
                v-for="(w, i) in group"
                :key="i"
                class="validation-entry fs-200 t-body"
                :class="
                  w.severity === 'error' ? 't-negative' : 't-warning'
                "
              >
                <strong>{{ w.code }}:</strong>
                {{ w.message }}
                <em v-if="w.details?.suggestion" class="t-muted">
                  ({{
                    $t(
                      "atlas.mappings.warning_codes.source_value_suggestion",
                      {
                        suggestion: w.details.suggestion,
                      }
                    )
                  }})
                </em>
              </li>
            </ul>
          </div>
        </div>
        <details class="mapping-profile__expand">
          <summary class="t-secondary fs-200 pointer">
            {{ $t("atlas.mappings.expand_label") }}
          </summary>
          <div class="mt-5">
            <h3 class="fs-300 fw-600 mb-2">
              {{ $t("atlas.mappings.attribute_section") }}
            </h3>
            <AttributeMappingRow
              v-for="row in profile._attributeMappings || []"
              :key="row.id"
              :mapping="row"
              :busy="profile._busy"
              :supplier-idx="supplier.idx"
              :channel-idx="(profile.target_channel_idxs || [])[0] || null"
              :features="features"
              :data-keys="dataKeys"
              :warnings="profile._validation?.warnings || []"
              @save="(payload) => saveAttributeMapping(profile, payload)"
              @delete="(payload) => deleteAttributeMapping(profile, payload)"
            />
            <BasicButton
              size="sm"
              class="mt-2"
              :data-testid="`mapping-add-attribute-${profile.idx}`"
              @click="addAttributeRow(profile)"
            >
              {{ $t("atlas.mappings.add_attribute") }}
            </BasicButton>

            <h3 class="fs-300 fw-600 mt-8 mb-2">
              {{ $t("atlas.mappings.category_section") }}
            </h3>
            <CategoryMappingRow
              v-for="row in profile._categoryMappings || []"
              :key="row.id"
              :mapping="row"
              :busy="profile._busy"
              :supplier-idx="supplier.idx"
              :channel-idx="(profile.target_channel_idxs || [])[0] || null"
              :data-keys="dataKeys"
              :warnings="profile._validation?.warnings || []"
              @save="(payload) => saveCategoryMapping(profile, payload)"
              @delete="(payload) => deleteCategoryMapping(profile, payload)"
            />
            <BasicButton
              size="sm"
              class="mt-2"
              :data-testid="`mapping-add-category-${profile.idx}`"
              @click="addCategoryRow(profile)"
            >
              {{ $t("atlas.mappings.add_category") }}
            </BasicButton>
          </div>
        </details>
      </BasicCard>
      <EmptyState
        v-if="!profiles.length"
        :title="$t('atlas.mappings.empty')"
        icon="layers"
      />
    </div>

    <SideDrawer
      :visible="formVisible"
      :title="formTitle"
      width="420px"
      @close="closeForm"
    >
      <form class="flex flex-column gap-5" @submit.prevent="submitForm">
        <FormField :label="$t('atlas.form.name_label')" required>
          <BasicInput v-model="formData.name" :maxlength="128" data-testid="mapping-form-name" />
        </FormField>
        <FormField
          :label="$t('atlas.form.idx_label')"
          required
          :error="errors.idx?.msg || ''"
        >
          <BasicInput
            :model-value="formData.idx"
            format="key"
            :maxlength="64"
            placeholder="default"
            :disabled="!!editingIdx"
            data-testid="mapping-form-idx"
            @update:modelValue="onIdxInput"
          />
        </FormField>
        <FormField
          :label="$t('atlas.mappings.target_channels_label')"
          :hint="$t('atlas.mappings.target_channels_hint_select')"
        >
          <ChannelMultiSelect
            v-model="formData.target_channel_idxs"
            :channels="channels"
            :label="$t('atlas.mappings.target_channels_label')"
            :all-label="$t('atlas.mappings.target_channels_none')"
            data-testid="mapping-form-channels"
          />
        </FormField>
        <FormField :label="$t('atlas.mappings.import_language_label')">
          <BasicSelect
            :options="languageOptions"
            v-model="formData.import_language_id"
            :placeholder="$t('atlas.mappings.import_language_placeholder')"
            data-testid="mapping-form-language"
          />
          <p
            v-if="languageMismatchHint"
            class="fs-200 t-warning mt-1"
            data-testid="mapping-form-language-mismatch-hint"
          >
            {{ languageMismatchHint }}
          </p>
        </FormField>
        <FormField :label="$t('atlas.form.feature_set_label')">
          <BasicSelect
            :options="featureSetOptions"
            v-model="formData.feature_set_idx"
            :placeholder="$t('atlas.mappings.feature_set_placeholder')"
            data-testid="mapping-form-feature-set"
          />
        </FormField>
        <FormField :label="$t('atlas.form.is_active_label')">
          <BasicSwitch
            v-model="formData.is_active"
            data-testid="mapping-form-is-active"
          />
        </FormField>
        <div class="flex ai-ct jc-end gap-5 mt-8">
          <BasicButton data-testid="mapping-form-cancel" @click="closeForm">
            {{ $t("common.cancel") }}
          </BasicButton>
          <BasicButton
            variant="primary"
            type="submit"
            :disabled="formBusy"
            data-testid="mapping-form-submit"
          >
            {{ $t("common.save") }}
          </BasicButton>
        </div>
      </form>
    </SideDrawer>

    <ConfirmDialog
      tone="danger"
      :open="deleteVisible"
      @confirm="executeDeleteProfile"
      @cancel="deleteVisible = false"
      :title="$t('atlas.mappings.delete_title')"
    >
      <template #default>
        <p>
          {{
            $t("atlas.mappings.delete_body", {
              idx: deleteTarget?.idx,
            })
          }}
        </p>
      </template>
    </ConfirmDialog>
  </div>
</template>

<script>
import AttributeMappingRow from "../components/AttributeMappingRow.vue";
import CategoryMappingRow from "../components/CategoryMappingRow.vue";
import { useNotifyStore } from "@/stores/notify";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_MappingProfiles,
  POST_MappingProfile,
  PATCH_MappingProfile,
  DELETE_MappingProfile,
  POST_ValidateProfile,
  GET_AttributeMappings,
  POST_AttributeMapping,
  PATCH_AttributeMapping,
  DELETE_AttributeMapping,
  GET_CategoryMappings,
  POST_CategoryMapping,
  PATCH_CategoryMapping,
  DELETE_CategoryMapping,
  GET_DataKeys,
} from "@/api/atlas/api";
import {
  GET_Channels,
  GET_Features,
  GET_FeatureSetsGlobal,
} from "@/api/pim/api";
import { GET_RegionalLanguages } from "@/api/regional/api";
import { slugBuilder } from "@/utils/normalizers/assets-normalizers";

const EMPTY_PROFILE = () => ({
  idx: "",
  name: "",
  target_channel_idxs: [],
  import_language_id: null,
  feature_set_idx: null,
  is_active: true,
});

export default {
  name: "MappingsTab",
  components: { AttributeMappingRow, CategoryMappingRow },
  props: {
    supplier: { type: Object, default: null },
  },
  setup() {
    const notify = useNotifyStore();
    const { errors, handleApiError, clearErrors, validateFormats } = useFormErrors();
    return { notify, errors, handleApiError, clearErrors, validateFormats };
  },
  data() {
    return {
      profiles: [],
      loading: false,
      formVisible: false,
      formBusy: false,
      formData: EMPTY_PROFILE(),
      // True once the operator hand-edits IDENTIFIER — stops auto-slug from NAME.
      idxTouched: false,
      // Non-null while editing an existing profile (its idx); null = create mode.
      editingIdx: null,
      deleteVisible: false,
      deleteTarget: null,
      channels: [],
      languages: [],
      featureSets: [],
      features: [],
      dataKeys: { tokens: [], data_keys: [], sample_size: 0 },
      _validateTimers: {},
    };
  },
  computed: {
    languageOptions() {
      return (this.languages || []).map((l) => ({
        value: l.id,
        label: `${(l.iso2 || "").toUpperCase()} — ${l.name_en || l.iso2}`,
      }));
    },
    formTitle() {
      return this.editingIdx
        ? this.$t("atlas.mappings.edit_profile")
        : this.$t("atlas.mappings.create_profile");
    },
    /**
     * etap-08: proactive warning when push would silently fall back to
     * channel.default_language because the operator left `import_language`
     * empty and the supplier's default language isn't declared on the
     * selected target channels. Returns the localized hint string, or null
     * when the configuration is fine.
     *
     * Supplier ISO2 is derived from `supplier.default_language_id` against
     * the already-fetched regional `languages` array (SupplierResponse
     * exposes the FK PK, not the ISO code — adding the ISO field to the
     * backend schema is out of scope for etap-08).
     */
    supplierDefaultLangIso2() {
      const supplier = this.supplier;
      if (!supplier) return "";
      // Prefer explicit iso2 if backend ever exposes it.
      if (supplier.default_language_iso2) {
        return String(supplier.default_language_iso2).toLowerCase();
      }
      const langId = supplier.default_language_id;
      if (langId == null) return "";
      const lang = (this.languages || []).find((l) => l.id === langId);
      return lang ? String(lang.iso2 || "").toLowerCase() : "";
    },
    languageMismatchHint() {
      if (this.formData.import_language_id) return null;
      const supplierLang = this.supplierDefaultLangIso2;
      const targetIdxs = this.formData.target_channel_idxs || [];
      if (!supplierLang || !targetIdxs.length) return null;
      const mismatched = [];
      for (const idx of targetIdxs) {
        const ch = (this.channels || []).find((c) => c.idx === idx);
        if (!ch) continue;
        const chLangs = Array.isArray(ch.languages) ? ch.languages.map((l) => String(l).toLowerCase()) : [];
        if (chLangs.length && !chLangs.includes(supplierLang)) {
          mismatched.push(idx);
        }
      }
      if (!mismatched.length) return null;
      return this.$t("atlas.mappings.import_language_warning_mismatch", {
        supplier_lang: supplierLang.toUpperCase(),
        channels: mismatched.join(", "),
      });
    },
    featureSetOptions() {
      return (this.featureSets || []).map((fs) => ({
        value: fs.idx,
        label: fs.name ? `${fs.name} (${fs.idx})` : fs.idx,
      }));
    },
  },
  watch: {
    "supplier.idx"() {
      this.fetchProfiles();
      this.fetchDataKeys();
    },
    // Auto-derive IDENTIFIER from NAME until the operator edits it manually.
    "formData.name"(val) {
      if (!this.idxTouched) this.formData.idx = slugBuilder(val || "");
    },
  },
  mounted() {
    this.fetchProfiles();
    this.fetchPickerSources();
    this.fetchDataKeys();
  },
  methods: {
    async fetchPickerSources() {
      // Channels + languages + feature sets + PIM features — needed once per drawer lifetime.
      // Soft-fail: if any picker source is unavailable, drawer still opens with empty list.
      try {
        const [chRes, langRes, fsRes, featRes] = await Promise.all([
          GET_Channels({ page_size: 100 }),
          GET_RegionalLanguages(),
          GET_FeatureSetsGlobal({ page_size: 100 }),
          GET_Features({ page_size: 200 }),
        ]);
        this.channels = chRes.data?.results || chRes.data || [];
        this.languages = langRes.data?.results || langRes.data || [];
        this.featureSets = fsRes.data?.results || fsRes.data || [];
        this.features = featRes.data?.results || featRes.data || [];
      } catch {
        // Drawer still opens — operator can save and pick later.
      }
    },
    async fetchDataKeys() {
      if (!this.supplier?.idx) return;
      try {
        const { data } = await GET_DataKeys(this.supplier.idx);
        this.dataKeys = data || { tokens: [], data_keys: [], sample_size: 0 };
      } catch {
        this.dataKeys = { tokens: [], data_keys: [], sample_size: 0 };
      }
    },
    async fetchProfiles() {
      if (!this.supplier?.idx) return;
      this.loading = true;
      try {
        const { data } = await GET_MappingProfiles(this.supplier.idx, {
          page_size: 50,
        });
        const profiles = data.results || [];
        // hydrate nested attribute and category mappings for each profile
        await Promise.all(profiles.map((p) => this.hydrateMappings(p)));
        this.profiles = profiles;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async hydrateMappings(profile) {
      profile._busy = false;
      profile._attributeMappings = [];
      profile._categoryMappings = [];
      // etap-02: validation cache per profile; null = never validated yet
      if (profile._validation === undefined) {
        profile._validation = null;
      }
      if (profile._expandValidation === undefined) {
        profile._expandValidation = false;
      }
      try {
        const [attrRes, catRes] = await Promise.all([
          GET_AttributeMappings(profile.id, { page_size: 100 }),
          GET_CategoryMappings(profile.id, { page_size: 100 }),
        ]);
        profile._attributeMappings = attrRes.data.results || [];
        profile._categoryMappings = catRes.data.results || [];
      } catch (err) {
        // soft-fail; user can still see the profile and add mappings
      }
    },
    openCreate() {
      const defaults = EMPTY_PROFILE();
      // Pre-populate defaults from supplier when available (defensive — supplier may not expose them).
      if (this.supplier?.default_feature_set_idx) {
        defaults.feature_set_idx = this.supplier.default_feature_set_idx;
      }
      if (this.supplier?.default_language_id != null) {
        defaults.import_language_id = this.supplier.default_language_id;
      }
      this.formData = defaults;
      this.editingIdx = null;
      this.idxTouched = false;
      this.clearErrors();
      this.formVisible = true;
    },
    openEdit(profile) {
      this.formData = {
        idx: profile.idx,
        name: profile.name || "",
        target_channel_idxs: [...(profile.target_channel_idxs || [])],
        import_language_id: profile.import_language_id ?? null,
        feature_set_idx: profile.feature_set_idx ?? null,
        is_active: profile.is_active,
      };
      this.editingIdx = profile.idx; // edit mode — idx locked, submit PATCHes
      this.idxTouched = true; // never auto-slug an existing profile
      this.clearErrors();
      this.formVisible = true;
    },
    onIdxInput(val) {
      // Manual edit takes over — stop auto-slug. Keep raw input (free text, backend
      // validates the slug) so hyphens aren't eaten mid-typing.
      this.idxTouched = true;
      this.formData.idx = val;
    },
    closeForm() {
      this.formVisible = false;
    },
    async submitForm() {
      if (!this.supplier?.idx) return;
      this.clearErrors();
      if (!this.editingIdx && !this.validateFormats(this.formData, { idx: { format: "key" } })) return;
      this.formBusy = true;
      try {
        const isEdit = !!this.editingIdx;
        const payload = {
          name: this.formData.name,
          target_channel_idxs: this.formData.target_channel_idxs || [],
          is_active: this.formData.is_active,
        };
        if (this.formData.import_language_id != null) {
          payload.import_language_id = this.formData.import_language_id;
        }
        if (this.formData.feature_set_idx) {
          payload.feature_set_idx = this.formData.feature_set_idx;
        }
        if (isEdit) {
          await PATCH_MappingProfile(
            this.supplier.idx,
            this.editingIdx,
            payload
          );
        } else {
          payload.idx = this.formData.idx;
          await POST_MappingProfile(this.supplier.idx, payload);
        }
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t(
            isEdit
              ? "atlas.mappings.toast.updated"
              : "atlas.mappings.toast.created",
            { idx: isEdit ? this.editingIdx : payload.idx }
          ),
        });
        this.formVisible = false;
        this.fetchProfiles();
      } catch (err) {
        this.handleApiError(err);
        if (Object.keys(this.errors).length === 0) {
          this.notify.spawnNotification({
            type: "negative",
            msg: extractApiMessage(err, this.$t("notifications.error")),
          });
        }
      } finally {
        this.formBusy = false;
      }
    },
    async validateProfile(profile, { silent = false } = {}) {
      profile._validation = {
        ok: profile._validation?.ok ?? null,
        errors: profile._validation?.errors || [],
        warnings: profile._validation?.warnings || [],
        busy: true,
      };
      try {
        const { data } = await POST_ValidateProfile(
          this.supplier.idx,
          profile.idx
        );
        const ok = data.ok ?? data.is_valid ?? true;
        const errors = data.errors || [];
        const warnings = data.warnings || [];
        profile._validation = { ok, errors, warnings, busy: false };
        if (silent) return;
        if (ok && !errors.length && !warnings.length) {
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("atlas.mappings.toast.validate_ok"),
          });
        } else {
          this.notify.spawnNotification({
            type: errors.length ? "negative" : "warning",
            msg: this.$t("atlas.mappings.toast.validate_issues", {
              errors: errors.length,
              warnings: warnings.length,
            }),
          });
        }
      } catch (err) {
        profile._validation = {
          ok: false,
          errors: [],
          warnings: [],
          busy: false,
        };
        if (silent) return;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    // etap-02: debounced validate after mapping row save/delete
    _scheduleValidate(profile) {
      const key = profile.idx;
      if (this._validateTimers[key]) clearTimeout(this._validateTimers[key]);
      this._validateTimers[key] = setTimeout(() => {
        this.validateProfile(profile, { silent: true });
        delete this._validateTimers[key];
      }, 500);
    },
    validationBadge(profile) {
      const v = profile._validation;
      if (!v) return null;
      if (v.busy) {
        return {
          label: this.$t("atlas.mappings.badge.checking"),
          variant: "info",
        };
      }
      if (v.errors.length) {
        return {
          label: this.$t("atlas.mappings.badge.errors", {
            n: v.errors.length,
          }),
          variant: "negative",
        };
      }
      if (v.warnings.length) {
        return {
          label: this.$t("atlas.mappings.badge.warnings", {
            n: v.warnings.length,
          }),
          variant: "warning",
        };
      }
      if (v.ok) {
        return {
          label: this.$t("atlas.mappings.badge.clean"),
          variant: "positive",
        };
      }
      return null;
    },
    toggleValidationDetail(profile) {
      profile._expandValidation = !profile._expandValidation;
    },
    groupedValidation(profile) {
      const v = profile._validation;
      if (!v) return {};
      const groups = { profile: [], category: [], attribute: [] };
      // errors come as strings — wrap to a uniform shape for the detail list
      for (const e of v.errors || []) {
        groups.profile.push({
          code: "error",
          message: typeof e === "string" ? e : e.message || JSON.stringify(e),
          severity: "error",
        });
      }
      for (const w of v.warnings || []) {
        const kind = groups[w.mapping_kind] ? w.mapping_kind : "profile";
        groups[kind].push({ ...w, severity: "warning" });
      }
      const out = {};
      for (const [k, list] of Object.entries(groups)) {
        if (list.length) out[k] = list;
      }
      return out;
    },
    confirmDeleteProfile(profile) {
      this.deleteTarget = profile;
      this.deleteVisible = true;
    },
    async executeDeleteProfile() {
      if (!this.deleteTarget) return;
      try {
        await DELETE_MappingProfile(this.supplier.idx, this.deleteTarget.idx);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.mappings.toast.deleted", {
            idx: this.deleteTarget.idx,
          }),
        });
        this.deleteVisible = false;
        this.deleteTarget = null;
        this.fetchProfiles();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    addAttributeRow(profile) {
      profile._attributeMappings = [
        ...(profile._attributeMappings || []),
        {
          source_field: "",
          target_type: "feature",
          target_identifier: "",
          is_required: false,
        },
      ];
    },
    async saveAttributeMapping(profile, payload) {
      const isNewRow = !payload.id;
      profile._busy = true;
      try {
        if (payload.id) {
          await PATCH_AttributeMapping(profile.id, payload.id, payload);
        } else {
          delete payload.id;
          await POST_AttributeMapping(profile.id, payload);
        }
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.mappings.toast.attr_saved"),
        });
        await this.hydrateMappings(profile);
        this._scheduleValidate(profile);
      } catch (err) {
        // Revert unsaved draft row so the bogus value doesn't linger in the list.
        if (isNewRow) {
          profile._attributeMappings = (
            profile._attributeMappings || []
          ).filter((r) => r.id !== undefined);
        }
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        profile._busy = false;
      }
    },
    async deleteAttributeMapping(profile, mapping) {
      try {
        await DELETE_AttributeMapping(profile.id, mapping.id);
        await this.hydrateMappings(profile);
        this._scheduleValidate(profile);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    addCategoryRow(profile) {
      profile._categoryMappings = [
        ...(profile._categoryMappings || []),
        { source_field: "", source_value: "", target_category_idx: "" },
      ];
    },
    async saveCategoryMapping(profile, payload) {
      const isNewRow = !payload.id;
      profile._busy = true;
      try {
        if (payload.id) {
          await PATCH_CategoryMapping(profile.id, payload.id, payload);
        } else {
          delete payload.id;
          await POST_CategoryMapping(profile.id, payload);
        }
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.mappings.toast.cat_saved"),
        });
        await this.hydrateMappings(profile);
        this._scheduleValidate(profile);
      } catch (err) {
        if (isNewRow) {
          profile._categoryMappings = (profile._categoryMappings || []).filter(
            (r) => r.id !== undefined
          );
        }
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        profile._busy = false;
      }
    },
    async deleteCategoryMapping(profile, mapping) {
      try {
        await DELETE_CategoryMapping(profile.id, mapping.id);
        await this.hydrateMappings(profile);
        this._scheduleValidate(profile);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.mapping-profile__expand summary {
  cursor: pointer;
}
.pointer {
  cursor: pointer;
}
.validation-detail {
  background: var(--surface-raised);
}
.validation-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.validation-entry {
  padding: 2px 0;
  line-height: 1.4;
}
.mb-1 {
  margin-bottom: var(--space-1);
}
</style>
