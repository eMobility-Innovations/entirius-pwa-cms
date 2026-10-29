<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="category.idx || !loading" #header>
      <PageHeader :title="pageTitle" back="/pim/categories">
        <template #meta>
          <PimChannelSelect />
        </template>
        <template v-if="activeTab === 'details' && !notFound && !loading" #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSwitch v-model="form.is_active" :label="$t('pim.active')" />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <EmptyState
        v-else-if="notFound"
        icon="categories"
        :title="$t('pim.category_not_found')"
        :message="$t('pim.category_not_found_hint')"
      >
        <BasicButton
          variant="secondary"
          @click="$router.push('/pim/categories')"
        >
          {{ $t('pim.back_to_categories') }}
        </BasicButton>
      </EmptyState>

      <template v-else>
        <BasicTabs v-model="activeTab" :options="tabs" class="mb-8" />

        <div v-if="activeTab === 'details'">
          <p v-if="category.breadcrumb_path" class="flex ai-ct gap-2 mb-8 t-muted fs-200">
            <font-awesome-icon :icon="$icons.categories" aria-hidden="true" />
            {{ category.breadcrumb_path }}
          </p>

          <BasicCard :title="$t('pim.basic_info')" gap class="mb-8">
            <div class="form-grid">
              <FormField label="IDX">
                <BasicInput :model-value="category.idx" readonly />
              </FormField>
              <FormField :label="$t('pim.parent')">
                <BasicInput :model-value="category.parent_category_idx || '---'" readonly />
              </FormField>
              <FormField :label="$t('pim.position')">
                <BasicInput :model-value="category.position ?? '---'" readonly />
              </FormField>
              <FormField :label="$t('pim.depth')">
                <BasicInput :model-value="category.tree_deep" readonly />
              </FormField>
              <FormField :label="$t('pim.products')">
                <BasicInput :model-value="category.product_count || 0" readonly />
              </FormField>
              <FormField :label="$t('pim.subcategories')">
                <BasicInput :model-value="category.subcategory_count || 0" readonly />
              </FormField>
              <FormField :label="$t('pim.in_menu')">
                <BasicSwitch v-model="form.is_in_menu" :label="$t('pim.show_in_menu')" />
              </FormField>
            </div>
          </BasicCard>

          <BasicCard :title="$t('pim.name_and_description')" gap class="mb-8">
            <div class="form-grid">
              <ProductT9nField
                v-for="field in CONTENT_FIELDS"
                :key="field"
                v-model="form[`${field}_t9n`][defaultLang]"
                :label="fieldLabel(field)"
                :language="defaultLang"
                :control="fieldControl(field)"
                :translatable="secondaryLanguages.length > 0"
                class="form-grid__wide"
                @translate="openTranslations(field)"
              />
              <!-- Internal AI-grounding desc — single-language, NOT the storefront description_t9n -->
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

          <BasicCard :title="$t('pim.category_image')" gap class="mb-8">
            <div v-if="form.image_url" class="category-image">
              <img :src="fullImageUrl" :alt="$t('pim.category_image')" class="category-image__preview" />
              <IconButton
                mutates
                icon="delete"
                variant="danger"
                size="sm"
                :label="$t('common.delete')"
                class="category-image__delete"
                @click="form.image_url = ''"
              />
            </div>
            <div
              v-else-if="!readonly"
              class="category-image__dropzone"
              :class="{ 'category-image__dropzone--dragover': isDraggingImage }"
              role="button"
              tabindex="0"
              @click="$refs.categoryImageInput.click()"
              @keydown.enter="$refs.categoryImageInput.click()"
              @dragover.prevent="isDraggingImage = true"
              @dragleave="isDraggingImage = false"
              @drop.prevent="onImageDrop"
            >
              <Loader v-if="uploadingImage" :size="32" />
              <template v-else>
                <font-awesome-icon :icon="$icons.upload" class="t-muted fs-400" />
                <span class="t-muted fs-200 mt-2">{{ $t("pim.drop_files_here") }}</span>
              </template>
            </div>
            <input
              ref="categoryImageInput"
              type="file"
              accept="image/*"
              style="display: none"
              :disabled="readonly"
              @change="onCategoryImageUpload"
            />
          </BasicCard>

          <BasicCard :title="$t('pim.seo_settings')" gap class="mb-8">
            <div class="form-grid">
              <FormField :label="$t('pim.index')" :hint="$t('pim.index_help')">
                <BasicSwitch
                  :model-value="!form.noindex"
                  @update:model-value="(on) => (form.noindex = !on)"
                />
              </FormField>
              <FormField :label="$t('pim.follow')" :hint="$t('pim.follow_help')">
                <BasicSwitch
                  :model-value="!form.nofollow"
                  @update:model-value="(on) => (form.nofollow = !on)"
                />
              </FormField>
              <FormField
                :label="$t('pim.og_image_url')"
                :hint="$t('pim.og_image_url_help')"
                class="form-grid__wide"
                :error="formErrors.getFieldError('og_image_url')?.msg || ''"
              >
                <BasicInput v-model="form.og_image_url" format="url" type="url" :maxlength="512" />
              </FormField>
              <ProductT9nField
                v-for="field in SEO_FIELDS"
                :key="field"
                v-model="form[`${field}_t9n`][defaultLang]"
                :label="fieldLabel(field)"
                :language="defaultLang"
                :control="fieldControl(field)"
                :translatable="secondaryLanguages.length > 0"
                class="form-grid__wide"
                @translate="openTranslations(field)"
              />
            </div>
          </BasicCard>
        </div>

        <CategoryProducts
          v-if="activeTab === 'products'"
          :channel-idx="channelIdx"
          :category-idx="category.idx"
        />
      </template>

    <TranslationsDrawer
      :visible="!!translatingField"
      :title="translatingFieldLabel"
      :languages="pimChannel.activeChannelLanguages"
      :default-language="defaultLang"
      :values="translatingField ? form[translatingFieldFormKey] : {}"
      @cancel="translatingField = null"
      @save="onTranslationsSave"
    >
      <template v-if="translatingFieldIsWysiwyg" #input="{ modelValue, onUpdate }">
        <BasicWysiwyg variant="lite" :model-value="modelValue" @update:model-value="onUpdate" />
      </template>
      <template v-else-if="translatingFieldIsTextArea" #input="{ modelValue, onUpdate }">
        <BasicTextarea :model-value="modelValue" @update:model-value="onUpdate" rows="3" />
      </template>
    </TranslationsDrawer>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteCategory"
      @cancel="showDeleteConfirm = false"
      :title="$t('pim.confirm_delete_title')"
    >
      <template #default>
        <p>
          {{
            category.subcategory_count
              ? $t("pim.confirm_delete_category_cascade", {
                  count: category.subcategory_count,
                })
              : $t("pim.confirm_delete_category")
          }}
        </p>
      </template>
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
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { usePageReadonly } from "@/composables/useReadonly";
import { GET_Category, PATCH_Category, DELETE_Category, POST_UploadPicture } from "@/api/pim/api";
import CategoryProducts from "./components/CategoryProducts.vue";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import ProductT9nField from "./components/ProductT9nField.vue";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";

// Translatable fields per card, and the control each one takes (the drawer uses the same).
const CONTENT_FIELDS = ["name", "description"];
const SEO_FIELDS = ["meta_title", "meta_description", "canonical_url"];
const WYSIWYG = { is: "BasicWysiwyg", attrs: {} };
const TEXTAREA = { is: "BasicTextarea", attrs: { rows: 3 } };
const INPUT = { is: "BasicInput", attrs: {} };

export default {
  name: "CategoryDetail",
  components: {
    CategoryProducts,
    PimChannelSelect,
    ProductT9nField,
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const unsaved = useUnsavedChanges();
    const formErrors = useFormErrors();
    // The page's read-only mode reaches the image drop zone (FormField and the buttons follow it on their own).
    const readonly = usePageReadonly();
    return { loader, notify, pimChannel, formErrors, ...unsaved, CONTENT_FIELDS, SEO_FIELDS, readonly };
  },
  data() {
    return {
      activeTab: "details",
      category: {},
      loading: true,
      notFound: false,
      showDeleteConfirm: false,
      translatingField: null,
      isDraggingImage: false,
      uploadingImage: false,
      form: {
        is_active: true,
        is_in_menu: true,
        name_t9n: {},
        description_t9n: {},
        meta_title_t9n: {},
        meta_description_t9n: {},
        canonical_url_t9n: {},
        image_url: "",
        og_image_url: "",
        noindex: false,
        nofollow: false,
        desc: "",
      },
    };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    // Soft-compat: old backend omits `desc` on the category detail → field hidden.
    hasDesc() {
      return "desc" in this.category;
    },
    tabs() {
      return [
        { value: "details", label: this.$t("pim.details") },
        {
          value: "products",
          label: this.$t("pim.products_in_category"),
          count: this.category.product_count || undefined,
        },
      ];
    },
    defaultLang() {
      return (
        this.pimChannel.activeChannel?.default_language ||
        this.pimChannel.activeChannelLanguages[0] ||
        "en"
      );
    },
    secondaryLanguages() {
      return this.pimChannel.activeChannelLanguages.filter(
        (l) => l !== this.defaultLang
      );
    },
    translatingFieldFormKey() {
      if (!this.translatingField) return null;
      return `${this.translatingField}_t9n`;
    },
    translatingFieldLabel() {
      return this.translatingField ? this.fieldLabel(this.translatingField) : "";
    },
    pageTitle() {
      const name = this.category.name_t9n?.[this.defaultLang];
      return name || this.category.idx || this.$t("pim.category_detail");
    },
    headerActions() {
      return [
        { key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
          onClick: () => (this.showDeleteConfirm = true) },
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.saveCategory },
      ];
    },
    fullImageUrl() {
      const url = this.form.image_url || "";
      if (!url) return "";
      if (url.startsWith("http")) return url;
      const base = (process.env.VUE_APP_API_URL || "").replace(/\/$/, "");
      return `${base}${url}`;
    },
    translatingFieldIsWysiwyg() {
      return this.fieldControl(this.translatingField) === WYSIWYG;
    },
    translatingFieldIsTextArea() {
      return this.fieldControl(this.translatingField) === TEXTAREA;
    },
  },
  watch: {
    "pimChannel.activeChannelIdx"() {
      this.fetchCategory();
    },
  },
  mounted() {
    this.fetchCategory();
  },
  methods: {
    async uploadCategoryImage(file) {
      this.uploadingImage = true;
      try {
        const formData = new FormData();
        formData.append("image", file);
        const { data } = await POST_UploadPicture(formData);
        this.form.image_url = data.image_url || "";
        this.notify.spawnNotification({ type: "positive", msg: this.$t("pim.picture_uploaded") });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.uploadingImage = false;
      }
    },
    onCategoryImageUpload(e) {
      const file = e.target.files?.[0];
      if (file) this.uploadCategoryImage(file);
      e.target.value = "";
    },
    onImageDrop(e) {
      this.isDraggingImage = false;
      const file = e.dataTransfer.files?.[0];
      if (file) this.uploadCategoryImage(file);
    },
    fieldLabel(field) {
      return this.$t(`pim.${field}`);
    },
    fieldControl(field) {
      if (field === "description") return WYSIWYG;
      if (field === "meta_description") return TEXTAREA;
      return INPUT;
    },
    openTranslations(fieldName) {
      this.translatingField = fieldName;
    },
    onTranslationsSave(values) {
      const formKey = `${this.translatingField}_t9n`;
      this.form[formKey] = { ...values };
      this.translatingField = null;
    },
    async fetchCategory() {
      this.loading = true;
      this.notFound = false;
      try {
        const { data } = await GET_Category(
          this.channelIdx,
          this.$route.params.idx
        );
        this.category = data;
        this.resetForm();
      } catch (err) {
        this.notFound = isNotFound(err);
        if (this.notFound) return;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    resetForm() {
      const t9nKeys = ["name_t9n", "description_t9n", "meta_title_t9n", "meta_description_t9n", "canonical_url_t9n"];
      const t9nData = {};
      for (const key of t9nKeys) {
        const src = { ...(this.category[key] || {}) };
        for (const lang of this.pimChannel.activeChannelLanguages) {
          if (!(lang in src)) src[lang] = "";
        }
        t9nData[key] = src;
      }
      this.form = {
        is_active: this.category.is_active,
        is_in_menu: this.category.is_in_menu,
        image_url: this.category.image_url || "",
        og_image_url: this.category.og_image_url || "",
        noindex: this.category.noindex || false,
        nofollow: this.category.nofollow || false,
        desc: this.category.desc || "",
        ...t9nData,
      };
      this.snapshot(this.form);
      this.track(this.form);
    },
    async saveCategory() {
      // Only a URL typed here is checked: a stored one the operator did not touch never blocks other edits.
      const urlChanged = this.form.og_image_url !== (this.category.og_image_url || "");
      if (urlChanged && !this.formErrors.validateFormats(this.form, { og_image_url: { format: "url" } })) return;
      this.loader.loaderStart();
      try {
        const payload = {};
        if (this.form.is_active !== this.category.is_active)
          payload.is_active = this.form.is_active;
        if (this.form.is_in_menu !== this.category.is_in_menu)
          payload.is_in_menu = this.form.is_in_menu;
        const t9nFields = ["name_t9n", "description_t9n", "meta_title_t9n", "meta_description_t9n", "canonical_url_t9n"];
        for (const f of t9nFields) {
          if (JSON.stringify(this.form[f]) !== JSON.stringify(this.category[f])) {
            payload[f] = this.form[f];
          }
        }
        for (const f of ["image_url", "og_image_url", "noindex", "nofollow"]) {
          if (this.form[f] !== (this.category[f] ?? (f === "og_image_url" ? "" : false))) {
            payload[f] = this.form[f];
          }
        }
        if (this.hasDesc && (this.form.desc || "") !== (this.category.desc || "")) {
          payload.desc = this.form.desc;
        }

        await PATCH_Category(this.channelIdx, this.category.idx, payload);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.category_saved"),
        });
        await this.fetchCategory();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async saveAndLeave() {
      await this.saveCategory();
      this.confirmLeave();
    },
    async deleteCategory() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_Category(this.channelIdx, this.category.idx);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("notifications.deleted"),
        });
        this.confirmLeave();
        this.$router.push("/pim/categories");
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
.category-image {
  position: relative;
  display: inline-block;

  &__preview {
    width: 200px;
    height: 140px;
    border-radius: var(--radius-base);
    border: 1px solid var(--border-subtle);
    object-fit: cover;
    display: block;
  }

  &__delete {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
  }

  &__dropzone {
    width: 100%;
    padding: var(--space-8) var(--space-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 2px dashed var(--border-subtle);
    border-radius: var(--radius-base);
    transition: background 0.15s, border-color 0.15s;

    &:hover,
    &:focus-visible {
      background: var(--surface-raised);
      border-color: var(--border-default);
      outline: none;
    }

    &--dragover {
      background: var(--accent-subtle);
      border-color: var(--accent);
    }
  }
}
</style>
