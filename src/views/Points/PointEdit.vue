<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader
        :title="isEdit ? String(point.name || point.code || '') : $t('dp.create_point')"
        back="/points/list"
      >
        <template #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSwitch
              :label="$t('dp.is_active')"
              v-model="form.is_active"
            />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else>
        <!-- Carrier read-only banner -->
        <div
          v-if="isCarrier"
          class="flex ai-ct gap-5 mb-8 p-8 bg-accent-subtle rounded t-strong fs-200"
        >
          <font-awesome-icon :icon="$icons.lock" />
          <span>{{ $t("dp.carrier_point_read_only") }}</span>
        </div>

        <BasicCard :title="$t('dp.address')" gap class="mb-8">
          <!-- Geocode address search -->
          <template v-if="!isCarrier">
            <div
              v-if="!geocodeAvailable"
              class="flex ai-ct gap-5 p-5 bg-accent-subtle rounded t-strong fs-200"
            >
              <font-awesome-icon :icon="$icons.info" />
              <span>{{ $t("dp.geocoding_unavailable") }}</span>
            </div>
            <FormField :label="$t('dp.address_search')">
              <div class="geocode-search">
                <BasicInput
                  v-model="geocodeQuery"
                  :placeholder="$t('dp.address_search_placeholder')"
                  icon="search"
                  :disabled="!geocodeAvailable"
                  @input="debouncedGeocode"
                />
                <div
                  v-if="geocodeResults.length"
                  class="geocode-search__results"
                >
                  <div
                    v-for="(result, idx) in geocodeResults"
                    :key="idx"
                    class="geocode-search__result pointer"
                    @click="selectGeoResult(result)"
                  >
                    {{ result.formatted_address }}
                  </div>
                </div>
              </div>
            </FormField>
          </template>

          <div class="form-grid">
            <FormField
              :label="$t('dp.code')"
              required
              :error="formErrors.getFieldError('code')?.msg || ''"
            >
              <BasicInput
                v-model="form.code"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.name')"
              required
              :error="formErrors.getFieldError('name')?.msg || ''"
            >
              <BasicInput
                v-model="form.name"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.type')"
              required
              :error="formErrors.getFieldError('type_id')?.msg || ''"
            >
              <BasicSelect
                :options="typeOptions"
                v-model="form.type_id"
                :placeholder="$t('common.select')"
                :disabled="isCarrier || (isEdit && !typeChangeSupported)"
              />
            </FormField>
            <FormField
              :label="$t('dp.channels')"
              :error="formErrors.getFieldError('channel_ids')?.msg || ''"
            >
              <BasicSelect
                v-if="isCarrier"
                :options="[{ label: $t('dp.global'), value: '__global' }]"
                :model-value="'__global'"
                :disabled="true"
              />
              <BasicSelect
                v-else
                v-model="form.channel_ids"
                :options="channelOptions"
                :placeholder="$t('dp.global')"
                multiple
                searchable
              />
            </FormField>
            <FormField
              :label="$t('dp.street')"
              :error="formErrors.getFieldError('street')?.msg || ''"
            >
              <BasicInput
                v-model="form.street"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.city')"
              :error="formErrors.getFieldError('city')?.msg || ''"
            >
              <BasicInput
                v-model="form.city"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.state')"
              :error="formErrors.getFieldError('state')?.msg || ''"
            >
              <BasicInput
                v-model="form.state"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.post_code')"
              :error="formErrors.getFieldError('post_code')?.msg || ''"
            >
              <BasicInput
                v-model="form.post_code"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.country')"
              :error="formErrors.getFieldError('country')?.msg || ''"
            >
              <BasicSelect
                v-if="isCarrier"
                :options="countryOptions"
                :model-value="form.country"
                :disabled="true"
              />
              <BasicSelect
                v-else
                :options="countryOptions"
                v-model="form.country"
                :placeholder="$t('dp.select_country')"
              />
            </FormField>
          </div>
        </BasicCard>

        <BasicCard :title="$t('dp.location')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('dp.lat')"
              :error="formErrors.getFieldError('latitude')?.msg || ''"
            >
              <BasicInput
                v-model="form.latitude"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.lon')"
              :error="formErrors.getFieldError('longitude')?.msg || ''"
            >
              <BasicInput
                v-model="form.longitude"
                :disabled="isCarrier"
              />
            </FormField>
          </div>
        </BasicCard>

        <BasicCard :title="$t('dp.contact')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('dp.phone')"
              :error="formErrors.getFieldError('phone')?.msg || ''"
            >
              <BasicInput
                v-model="form.phone"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.email')"
              :error="formErrors.getFieldError('email')?.msg || ''"
            >
              <BasicInput
                v-model="form.email"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.website')"
              :error="formErrors.getFieldError('website')?.msg || ''"
            >
              <BasicInput
                v-model="form.website"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.opening_hours')"
              :error="formErrors.getFieldError('opening_hours')?.msg || ''"
            >
              <BasicInput
                v-model="form.opening_hours"
                :disabled="isCarrier"
              />
            </FormField>
            <FormField
              :label="$t('dp.hint')"
              class="form-grid__wide"
              :error="formErrors.getFieldError('hint')?.msg || ''"
            >
              <BasicTextarea
                v-model="form.hint"
                rows="3"
                :disabled="isCarrier"
              />
            </FormField>
          </div>
        </BasicCard>

        <!-- Translations (edit mode only, hidden for single-language setups) -->
        <BasicCard
          v-if="isEdit && showTranslations"
          :title="$t('dp.translations')"
          gap
          class="mb-8"
        >
          <template v-if="availableLanguageCodes.length" #actions>
            <div class="flex ai-ct gap-3">
              <BasicSelect
                :floating-label="$t('dp.language')"
                :options="availableLanguageCodes"
                v-model="addingLanguage"
                class="t9n-lang-select"
              />
              <BasicButton mutates
                variant="secondary"
                :disabled="!addingLanguage"
                @click="addTranslation"
              >
                {{ $t('dp.add_translation') }}
              </BasicButton>
            </div>
          </template>

          <EmptyState
            v-if="!translations.length"
            icon="translate"
            :title="$t('dp.no_translations')"
          />

          <section
            v-for="t9n in translations"
            :key="t9n.language"
            class="t9n-row"
            :aria-label="t9n.language.toUpperCase()"
          >
            <div class="t9n-lang-header flex ai-ct jc-sb mb-4">
              <span class="field-label t-accent">{{
                t9n.language.toUpperCase()
              }}</span>
              <IconButton mutates
                icon="delete"
                :label="$t('common.delete')"
                variant="danger"
                size="sm"
                @click="deleteTranslation(t9n.language)"
              />
            </div>
            <div class="form-grid">
              <FormField :label="$t('dp.translation_name')">
                <BasicInput v-model="t9n.name" />
              </FormField>
              <FormField :label="$t('dp.translation_opening_hours')">
                <BasicInput v-model="t9n.opening_hours" />
              </FormField>
              <FormField :label="$t('dp.translation_hint')" class="form-grid__wide">
                <BasicInput v-model="t9n.hint" />
              </FormField>
            </div>
            <div class="flex jc-fe mt-4">
              <BasicButton mutates
                variant="secondary"
                @click="saveTranslation(t9n)"
              >
                {{ $t('common.save') }}
              </BasicButton>
            </div>
          </section>
        </BasicCard>
      </template>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deletePoint"
      @cancel="showDeleteConfirm = false"
      :title="$t('dp.confirm_delete_title')"
    >
      <template #default
        ><p>{{ $t("dp.confirm_delete_point") }}</p></template
      >
    </ConfirmDialog>

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
import { useLoaderStore } from "@/stores/loader";
import { useMuninStore } from "@/stores/munin";
import { useNotifyStore } from "@/stores/notify";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_Point,
  POST_Point,
  PATCH_Point,
  DELETE_Point,
  GET_Types,
  GET_DPChannels,
  GET_Countries,
  GET_PointT9N,
  POST_PointT9N,
  PATCH_PointT9N,
  DELETE_PointT9N,
  POST_GeocodeSearch,
} from "@/api/deliverypoints/api";

export default {
  name: "PointEdit",
  components: {},
  setup() {
    const loader = useLoaderStore();
    const munin = useMuninStore();
    const notify = useNotifyStore();
    const unsaved = useUnsavedChanges();
    const formErrors = useFormErrors();
    return { loader, munin, notify, ...unsaved, formErrors };
  },
  data() {
    return {
      point: {},
      types: [],
      channels: [],
      countries: [],
      translations: [],
      addingLanguage: null,
      loading: false,
      showDeleteConfirm: false,
      geocodeAvailable: true,
      geocodeQuery: "",
      geocodeResults: [],
      geocodeTimer: null,
      form: {
        code: "",
        name: "",
        type_id: null,
        channel_ids: [],
        street: "",
        city: "",
        state: "",
        post_code: "",
        country: "",
        latitude: "",
        longitude: "",
        phone: "",
        email: "",
        website: "",
        opening_hours: "",
        hint: "",
        is_active: true,
      },
    };
  },
  computed: {
    // Delete is not offered for a carrier point: it is read-only apart from its on/off switch.
    headerActions() {
      const save = { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.savePoint };
      if (!this.isEdit || this.isCarrier) return [save];
      const remove = { key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete") };
      return [{ ...remove, onClick: () => (this.showDeleteConfirm = true) }, save];
    },
    isEdit() {
      return !!this.$route.params.id;
    },
    isCarrier() {
      if (!this.isEdit) return false;
      const typeObj = this.types.find((t) => t.id === this.form.type_id);
      return typeObj?.is_carrier ?? false;
    },
    // Backend accepts type_id on PATCH since deliverypoints 1.1.0 —
    // older backends silently drop it, so keep the dropdown locked there.
    typeChangeSupported() {
      return this.munin.isModuleAtLeast("deliverypoints", "1.1.0");
    },
    // Carrier types are not selectable, but a carrier point still shows its own type.
    typeOptions() {
      return this.types
        .filter((t) => !t.is_carrier || t.id === this.form.type_id)
        .map((t) => ({ label: t.name, value: t.id }));
    },
    channelOptions() {
      return this.channels.map((ch) => ({
        label: ch.name || ch.idx,
        value: ch.id,
      }));
    },
    countryOptions() {
      return this.countries.map((c) => ({
        label: `${c.iso2} — ${c.name}`,
        value: c.iso2,
      }));
    },
    // Single-language setups have nothing to translate into — hide the whole
    // section unless legacy translations already exist (so they stay manageable).
    showTranslations() {
      const codes = new Set();
      for (const ch of this.channels) {
        for (const code of ch.language_codes || []) codes.add(code);
      }
      return codes.size > 1 || this.translations.length > 0;
    },
    availableLanguageCodes() {
      const usedCodes = new Set(this.translations.map((t) => t.language));
      const codes = new Set();
      for (const ch of this.channels) {
        if (ch.language_codes) {
          for (const code of ch.language_codes) {
            if (!usedCodes.has(code)) codes.add(code);
          }
        }
      }
      return Array.from(codes).map((code) => ({
        label: code.toUpperCase(),
        value: code,
      }));
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  async mounted() {
    await this.checkGeocode();
    await this.fetchChannels();
    await this.fetchTypes();
    await this.fetchCountries();
    if (this.isEdit) {
      await this.fetchPoint();
      await this.fetchTranslations();
    } else {
      this.snapshot(this.form);
      this.track(this.form);
    }
  },
  methods: {
    async checkGeocode() {
      try {
        const { data } = await POST_GeocodeSearch({ query: "test" });
        if (data.available === false) {
          this.geocodeAvailable = false;
        }
      } catch {
        this.geocodeAvailable = false;
      }
    },
    debouncedGeocode() {
      clearTimeout(this.geocodeTimer);
      if (!this.geocodeQuery || this.geocodeQuery.length < 3) {
        this.geocodeResults = [];
        return;
      }
      this.geocodeTimer = setTimeout(() => this.searchAddress(), 300);
    },
    async searchAddress() {
      try {
        const { data } = await POST_GeocodeSearch({
          query: this.geocodeQuery,
          limit: 5,
        });
        if (Array.isArray(data)) {
          this.geocodeResults = data;
        } else {
          this.geocodeResults = [];
        }
      } catch {
        this.geocodeResults = [];
      }
    },
    selectGeoResult(result) {
      this.form.street = result.street || "";
      this.form.city = result.city || "";
      this.form.state = result.state || "";
      this.form.post_code = result.post_code || "";
      this.form.country = result.country || "";
      this.form.latitude = result.latitude || "";
      this.form.longitude = result.longitude || "";
      this.geocodeQuery = result.formatted_address || "";
      this.geocodeResults = [];
    },
    async fetchChannels() {
      try {
        const { data } = await GET_DPChannels({ page_size: 100 });
        this.channels = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async fetchTranslations() {
      try {
        const { data } = await GET_PointT9N(this.$route.params.id);
        this.translations = data.results || data || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async addTranslation() {
      if (!this.addingLanguage) return;
      try {
        await POST_PointT9N(this.$route.params.id, {
          language: this.addingLanguage,
          name: "",
          hint: "",
          opening_hours: "",
        });
        this.addingLanguage = null;
        await this.fetchTranslations();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async saveTranslation(t9n) {
      try {
        await PATCH_PointT9N(this.$route.params.id, t9n.language, {
          name: t9n.name,
          hint: t9n.hint,
          opening_hours: t9n.opening_hours,
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("dp.point_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      }
    },
    async deleteTranslation(language) {
      try {
        await DELETE_PointT9N(this.$route.params.id, language);
        await this.fetchTranslations();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async saveAndLeave() {
      await this.savePoint();
      this.confirmLeave();
    },
    async fetchTypes() {
      try {
        const { data } = await GET_Types({ page_size: 100 });
        this.types = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async fetchCountries() {
      try {
        const { data } = await GET_Countries();
        this.countries = data || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async fetchPoint() {
      this.loading = true;
      try {
        const { data } = await GET_Point(this.$route.params.id);
        this.point = data;
        this.resetForm(data);
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
    resetForm(data) {
      this.form = {
        code: data.code || "",
        name: data.name || "",
        type_id: data.type?.id || null,
        channel_ids: data.channel_ids || [],
        street: data.street || "",
        city: data.city || "",
        state: data.state || "",
        post_code: data.post_code || "",
        country: data.country || "",
        latitude: data.latitude || "",
        longitude: data.longitude || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        opening_hours: data.opening_hours || "",
        hint: data.hint || "",
        is_active: data.is_active ?? true,
      };
    },
    buildPayload() {
      if (this.isCarrier) {
        return { is_active: this.form.is_active };
      }
      return {
        code: this.form.code,
        name: this.form.name,
        type_id: this.form.type_id,
        channel_ids: this.form.channel_ids,
        street: this.form.street || "",
        city: this.form.city || "",
        state: this.form.state || "",
        post_code: this.form.post_code || "",
        country: this.form.country || "",
        latitude: this.form.latitude || null,
        longitude: this.form.longitude || null,
        phone: this.form.phone || "",
        email: this.form.email || "",
        website: this.form.website || "",
        opening_hours: this.form.opening_hours || "",
        hint: this.form.hint || "",
        is_active: this.form.is_active,
      };
    },
    async savePoint() {
      this.loader.loaderStart();
      try {
        const payload = this.buildPayload();
        if (this.isEdit) {
          await PATCH_Point(this.$route.params.id, payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("dp.point_saved"),
          });
          await this.fetchPoint();
        } else {
          const { data } = await POST_Point(payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("dp.point_created"),
          });
          this.snapshot(this.form);
          this.$router.push(`/points/${data.id}`);
        }
      } catch (err) {
        this.formErrors.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async deletePoint() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_Point(this.$route.params.id);
        this.snapshot(this.form);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("dp.point_deleted"),
        });
        this.$router.push("/points/list");
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
.t9n-row {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  padding: var(--space-4);
}

.t9n-lang-header {
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: var(--space-2);
}

.t9n-lang-select {
  width: 120px;
}

.geocode-search {
  position: relative;
}

.geocode-search__results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--surface-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-md);
  margin-top: var(--space-1);
  max-height: 240px;
  overflow-y: auto;
}

.geocode-search__result {
  padding: var(--space-2) var(--space-5);
  font-size: var(--fs-300);
  color: var(--text-body);
  border-bottom: 1px solid var(--border-subtle);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--surface-raised);
  }
}
</style>
