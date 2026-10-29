<template>
  <div class="fs-300 t-body h-100 ov-h relative">
    <PageLayout>
      <template v-if="!loading" #header>
        <PageHeader
          :title="form.name || $t('authors.create')"
          back="/pages/authors"
        >
          <template #actions>
            <div class="flex ai-ct jc-fe wrap gap-3">
              <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
              <BasicSwitch
                :label="$t('authors.is_active')"
                v-model="form.is_active"
              />
              <ActionBar :actions="headerActions" />
            </div>
          </template>
        </PageHeader>
      </template>
      <Loader block v-if="loading" />

      <template v-else>
        <BasicCard :title="$t('pim.basic_info')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('authors.name')"
              required
              :error="formErrors.getFieldError('name')?.msg || ''"
            >
              <BasicInput
                v-model="form.name"
              />
            </FormField>
            <FormField :label="$t('authors.slug')" :error="formErrors.getFieldError('slug')?.msg || ''">
              <BasicInput
                v-model="form.slug"
              />
            </FormField>
            <div class="form-grid__wide">
              <span id="author-photo-label" class="field-label">{{ $t("authors.photo") }}</span>
              <div class="flex ai-ct gap-8" role="group" aria-labelledby="author-photo-label">
                <div class="author-photo-preview">
                  <img
                    v-if="form.photo_url"
                    :src="form.photo_url"
                    :alt="$t('authors.photo')"
                    class="author-photo-preview__img"
                  />
                  <div v-else class="author-photo-preview__placeholder">
                    <FontAwesomeIcon :icon="$icons.user" class="t-muted fs-600" />
                  </div>
                </div>
                <div class="flex ai-ct gap-2">
                  <BasicButton
                    variant="secondary"
                    @click="$refs.photoController.init()"
                  >
                    {{ form.photo_uid ? $t('common.edit') : $t('common.select') }}
                  </BasicButton>
                  <IconButton
                    v-if="form.photo_uid"
                    icon="close"
                    :label="$t('gallery.delete_photo')"
                    variant="danger"
                    @click="clearPhoto"
                  />
                </div>
              </div>
            </div>
          </div>
        </BasicCard>

        <BasicCard :title="$t('pim.translations')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              v-for="field in t9nFields"
              :key="field.key"
              :label="`${field.label} (${defaultLang.toUpperCase()})`"
              class="form-grid__wide"
              :error="formErrors.getFieldError(field.key)?.msg || ''"
            >
              <div class="flex ai-st gap-3">
                <BasicInput
                  v-model="form[field.key][defaultLang]"
                  class="flex-1"
                />
                <IconButton
                  v-if="availableLanguages.length > 1"
                  icon="translate"
                  :label="$t('authors.translations_of', { field: field.label })"
                  variant="outline"
                  @click="openTranslations(field.name)"
                />
              </div>
            </FormField>
          </div>
        </BasicCard>

        <BasicCard :title="$t('dp.contact')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('authors.contact_email')"
              :error="formErrors.getFieldError('contact_email')?.msg || ''"
            >
              <BasicInput
                v-model="form.contact_email"
              />
            </FormField>
            <FormField
              :label="$t('authors.contact_phone')"
              :error="formErrors.getFieldError('contact_phone')?.msg || ''"
            >
              <BasicInput
                v-model="form.contact_phone"
              />
            </FormField>
            <FormField
              :label="$t('authors.contact_url')"
              class="form-grid__wide"
              :error="formErrors.getFieldError('contact_url')?.msg || ''"
            >
              <BasicInput
                v-model="form.contact_url"
              />
            </FormField>
          </div>
        </BasicCard>

        <BasicCard :title="$t('authors.social_profiles')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              v-for="platform in knownPlatforms"
              :key="platform"
              :label="platform"
            >
              <BasicInput
                v-model="form.social_profiles[platform]"
              />
            </FormField>
          </div>
        </BasicCard>
      </template>
    </PageLayout>

    <!-- Photo gallery (outside the scrolling PageLayout so modal overlays correctly) -->
    <div class="author-photo-controller-hidden">
      <ImagesController
        ref="photoController"
        :label="false"
        :value="photoControllerValue"
        @onChange="onPhotoControllerChange"
      />
    </div>

    <!-- Translations drawer -->
    <TranslationsDrawer
      :visible="!!translatingField"
      :title="translatingFieldLabel"
      :languages="availableLanguages"
      :default-language="defaultLang"
      :values="translatingField ? form[translatingFieldKey] : {}"
      @cancel="translatingField = null"
      @save="onTranslationsSave"
    />

    <!-- Delete confirmation -->
    <ConfirmDialog
      tone="danger"
      :title="$t('authors.confirm_delete_title')"
      :open="showDeleteConfirm"
      @confirm="deleteAuthor"
      @cancel="showDeleteConfirm = false"
    >
      <template #default>
        <p>{{ $t("authors.delete_confirm") }}</p>
        <p v-if="form.post_count" class="mt-5 t-secondary fs-200">
          {{ $t("authors.post_count") }}: <strong>{{ form.post_count }}</strong>
        </p>
        <FormField v-if="reassignOptions.length" :label="$t('authors.reassign_label')" class="mt-8">
          <BasicSelect
            :options="reassignOptions"
            v-model="reassignTo"
            :placeholder="$t('authors.reassign_none')"
          />
        </FormField>
      </template>
    </ConfirmDialog>
  </div>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import ImagesController from "@/configs/builder/components/ImagesController/index.vue";
import {
  GET_Author,
  POST_Author,
  PATCH_Author,
  DELETE_Author,
  GET_Authors,
} from "@/api/contentDB/api";

const KNOWN_PLATFORMS = [
  "twitter",
  "linkedin",
  "github",
  "facebook",
  "instagram",
  "youtube",
];

export default {
  name: "AuthorEdit",
  components: { ImagesController },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const contentDBChannel = useContentDBChannelStore();
    const formErrors = useFormErrors();
    return { loader, notify, contentDBChannel, formErrors };
  },
  data() {
    return {
      loading: false,
      showDeleteConfirm: false,
      reassignTo: null,
      reassignOptions: [],
      isDirty: false,
      initialSnapshot: null,
      translatingField: null,
      form: {
        name: "",
        slug: "",
        is_active: true,
        photo_uid: null,
        photo_url: null,
        role_t9n: { en: "" },
        description_t9n: { en: "" },
        tag_t9n: { en: "" },
        contact_email: "",
        contact_phone: "",
        contact_url: "",
        social_profiles: {},
        post_count: 0,
      },
      knownPlatforms: KNOWN_PLATFORMS,
    };
  },
  computed: {
    headerActions() {
      return [
        ...(this.isEdit
          ? [{ key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
              onClick: () => (this.showDeleteConfirm = true) }]
          : []),
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.save },
      ];
    },
    isEdit() {
      return Boolean(this.$route.params.uid);
    },
    photoControllerValue() {
      if (!this.form.photo_uid) return null;
      const asset = {
        uid: this.form.photo_uid,
        image: this.form.photo_url,
        meta: { fileName: "author-photo" },
        width: 0,
        height: 0,
      };
      return { desktop: asset };
    },
    availableLanguages() {
      return this.contentDBChannel.availableLanguages.length
        ? this.contentDBChannel.availableLanguages
        : ["en"];
    },
    defaultLang() {
      return this.contentDBChannel.defaultLanguage || "en";
    },
    t9nFields() {
      return [
        { key: "role_t9n", name: "role", label: this.$t("authors.role") },
        {
          key: "description_t9n",
          name: "description",
          label: this.$t("authors.description"),
        },
        { key: "tag_t9n", name: "tag", label: this.$t("authors.tag") },
      ];
    },
    translatingFieldKey() {
      if (!this.translatingField) return null;
      return `${this.translatingField}_t9n`;
    },
    translatingFieldLabel() {
      const labels = {
        role: this.$t("authors.role"),
        description: this.$t("authors.description"),
        tag: this.$t("authors.tag"),
      };
      return labels[this.translatingField] || this.translatingField;
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.initialSnapshot) {
          this.isDirty =
            JSON.stringify(this.form) !== this.initialSnapshot;
        }
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  mounted() {
    KNOWN_PLATFORMS.forEach((p) => {
      if (!this.form.social_profiles[p]) this.form.social_profiles[p] = "";
    });
    this.contentDBChannel.fetchChannelsAndLanguages();
    if (this.isEdit) {
      this.fetchAuthor();
      this.fetchReassignOptions();
    } else {
      this.snapshotForm();
    }
  },
  methods: {
    snapshotForm() {
      this.$nextTick(() => {
        this.initialSnapshot = JSON.stringify(this.form);
        this.isDirty = false;
      });
    },
    openTranslations(fieldName) {
      this.translatingField = fieldName;
    },
    onTranslationsSave({ values }) {
      this.form[this.translatingFieldKey] = values;
      this.translatingField = null;
    },
    ensureAllLangs(t9nObj) {
      const base = t9nObj || {};
      const result = {};
      this.availableLanguages.forEach((lang) => {
        result[lang] = base[lang] || "";
      });
      return result;
    },
    async fetchAuthor() {
      this.loading = true;
      try {
        const { data } = await GET_Author(this.$route.params.uid);
        const social = this.normalizeSocial(data.social_profiles || {});
        this.form = {
          name: data.name || "",
          slug: data.slug || "",
          is_active: data.is_active ?? true,
          photo_uid: data.photo_uid || null,
          photo_url: data.photo_url ? this.resolveMediaUrl(data.photo_url) : null,
          role_t9n: this.ensureAllLangs(data.role_t9n),
          description_t9n: this.ensureAllLangs(data.description_t9n),
          tag_t9n: this.ensureAllLangs(data.tag_t9n),
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          contact_url: data.contact_url || "",
          social_profiles: social,
          post_count: data.published_post_count || 0,
        };
        this.snapshotForm();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    normalizeSocial(profiles) {
      const result = {};
      KNOWN_PLATFORMS.forEach((p) => {
        result[p] = profiles[p] || "";
      });
      Object.entries(profiles).forEach(([k, v]) => {
        if (!KNOWN_PLATFORMS.includes(k)) result[k] = v;
      });
      return result;
    },
    async fetchReassignOptions() {
      try {
        const { data } = await GET_Authors({ page_size: 100, is_active: true });
        this.reassignOptions = (data.results || [])
          .filter((a) => a.uid !== this.$route.params.uid)
          .map((a) => ({ label: a.name, value: a.uid }));
      } catch {
        // non-critical
      }
    },
    buildPayload() {
      const social = {};
      Object.entries(this.form.social_profiles).forEach(([k, v]) => {
        if (v) social[k] = v;
      });
      return {
        name: this.form.name,
        slug: this.form.slug,
        is_active: this.form.is_active,
        photo_uid: this.form.photo_uid || null,
        role_t9n: this.form.role_t9n,
        description_t9n: this.form.description_t9n,
        tag_t9n: this.form.tag_t9n,
        contact_email: this.form.contact_email || null,
        contact_phone: this.form.contact_phone || null,
        contact_url: this.form.contact_url || null,
        social_profiles: social,
      };
    },
    async save() {
      const valid = this.formErrors.validateRequired(this.form, {
        name: this.$t("authors.name"),
      });
      if (!valid) return;

      this.loader.loaderStart();
      try {
        if (this.isEdit) {
          await PATCH_Author(this.$route.params.uid, this.buildPayload());
          this.snapshotForm();
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("authors.author_saved"),
          });
        } else {
          const { data } = await POST_Author(this.buildPayload());
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("authors.author_created"),
          });
          this.$router.replace(`/pages/authors/${data.uid}`);
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
    resolveMediaUrl(url) {
      if (!url) return null;
      if (url.startsWith("http")) return url;
      const base = (process.env.VUE_APP_API_URL || "").replace(/\/+$/, "");
      return `${base}${url}`;
    },
    onPhotoControllerChange(value) {
      const asset = value?.desktop || value?.mobile;
      if (asset) {
        this.form.photo_uid = asset.uid;
        this.form.photo_url = asset.image;
      }
    },
    clearPhoto() {
      this.form.photo_uid = null;
      this.form.photo_url = null;
    },
    async deleteAuthor() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_Author(
          this.$route.params.uid,
          this.reassignTo ? { reassign_to: this.reassignTo } : {}
        );
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("authors.author_deleted"),
        });
        this.$router.push("/pages/authors");
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
.author-photo-preview {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-base);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  flex-shrink: 0;

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-raised);
  }
}

.author-photo-controller-hidden {
  /* Hide ImagesController's own "Set new" button & dropdown,
     but keep the gallery overlay functional (position: absolute on content card) */
  :deep(.images-controller > .flex:first-child) {
    height: 0;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }
}
</style>
