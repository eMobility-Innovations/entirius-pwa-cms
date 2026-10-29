<script setup>
import { ref, watch, computed } from "vue";
import BasicModal from "@/boots/BasicModal/index.vue";
import { t } from "@/i18n";
import { GET_Images } from "@/api/contentDB/api";
import { useCategoryFetch, usePageFetch } from "@/composables/useEntityFetch";
import { useMuninStore } from "@/stores/munin";
import { linkTypeOptions } from "@/functionals/linkTypeOptions";

const GALLERY_PAGE_SIZE = 9;
// In form order: the text fields under the image, each with its per-language values in `<field>_t9n`.
const TRANSLATABLE_FIELDS = ["alt_text", "caption", "button_label"];

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  banner: {
    type: Object,
    default: null,
  },
  languages: {
    type: Array,
    default: () => [],
  },
  defaultLanguage: {
    type: String,
    default: "en",
  },
  channelIdx: {
    type: String,
    default: "",
  },
});

const muninStore = useMuninStore();
const pimEnabled = computed(() => muninStore.isPanelEnabled("pim"));
const categoryFetch = computed(() => useCategoryFetch(props.channelIdx));
const pageFetch = computed(() => usePageFetch());

const emit = defineEmits(["save", "close"]);

const linkTypes = computed(linkTypeOptions);

const footerActions = computed(() => [
  { key: "cancel", label: t("common.cancel"), role: "secondary", onClick: () => emit("close") },
  { key: "save", label: t("common.save"), role: "primary", onClick: onSave, testid: "modal-save" },
]);

const translatingField = ref(null);

const translatingFieldLabel = computed(() =>
  TRANSLATABLE_FIELDS.includes(translatingField.value) ? t(`layout_extender.${translatingField.value}`) : ""
);

const translatingFieldValues = computed(() => {
  if (!translatingField.value) return {};
  return form.value[translatingField.value + "_t9n"] || {};
});

const form = ref({
  heading: "",
  media_url: "",
  caption: "",
  caption_t9n: {},
  button_label: "",
  button_label_t9n: {},
  button_link_type: "category",
  button_link_value: "",
  button_link_display: "",
  alt_text: "",
  alt_text_t9n: {},
});

const galleryOpen = ref(false);
const galleryImages = ref([]);
const galleryPage = ref(1);
const galleryTotal = ref(0);
const galleryLoading = ref(false);
// A failed page load is an error with a retry, never the "no images" empty state.
const galleryError = ref(false);
const galleryButtonText = computed(() => {
  if (galleryOpen.value) return t("layout_extender.hide_gallery");
  return form.value.media_url ? t("layout_extender.change_image") : t("layout_extender.choose_from_gallery");
});
const galleryPages = computed(() => Math.ceil(galleryTotal.value / GALLERY_PAGE_SIZE));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    galleryOpen.value = false;
    galleryImages.value = [];
    galleryError.value = false;
    galleryPage.value = 1;
    translatingField.value = null;
    skipLinkTypeClear.value = true;
    if (props.banner) {
      form.value = {
        heading: props.banner.heading || "",
        media_url: props.banner.media_url || "",
        caption: props.banner.caption || "",
        caption_t9n: props.banner.caption_t9n ? { ...props.banner.caption_t9n } : {},
        button_label: props.banner.button_label || "",
        button_label_t9n: props.banner.button_label_t9n ? { ...props.banner.button_label_t9n } : {},
        button_link_type: props.banner.button_link_type || "category",
        button_link_value: props.banner.button_link_value || "",
        button_link_display: props.banner.button_link_display || "",
        alt_text: props.banner.alt_text || "",
        alt_text_t9n: props.banner.alt_text_t9n ? { ...props.banner.alt_text_t9n } : {},
      };
    } else {
      form.value = { heading: "", media_url: "", caption: "", caption_t9n: {}, button_label: "", button_label_t9n: {}, button_link_type: "category", button_link_value: "", button_link_display: "", alt_text: "", alt_text_t9n: {} };
    }
  }
);

const skipLinkTypeClear = ref(false);

watch(
  () => form.value.button_link_type,
  () => {
    if (skipLinkTypeClear.value) { skipLinkTypeClear.value = false; return; }
    form.value.button_link_value = "";
    form.value.button_link_display = "";
  }
);

function resolveMediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return (process.env.VUE_APP_API_URL || "") + path;
}

function clearImage() {
  form.value.media_url = "";
  form.value.alt_text = "";
}

async function openGallery() {
  galleryOpen.value = true;
  await loadGallery(1);
}

function toggleGallery() {
  if (galleryOpen.value) galleryOpen.value = false;
  else openGallery();
}

async function loadGallery(page = 1) {
  galleryPage.value = page;
  galleryLoading.value = true;
  galleryError.value = false;
  try {
    const { data } = await GET_Images({ limit: GALLERY_PAGE_SIZE, page });
    galleryImages.value = data.data || [];
    galleryTotal.value = data.pagination?.total || 0;
  } catch {
    galleryImages.value = [];
    galleryError.value = true;
  } finally {
    galleryLoading.value = false;
  }
}

function selectImage(image) {
  form.value.media_url = image.image;
  form.value.alt_text = image.meta?.alt || image.meta?.fileName || "";
  galleryOpen.value = false;
}

function translationsLabel(field) {
  return `${t("layout_extender.translations")}: ${t(`layout_extender.${field}`)}`;
}

function onTranslationsSave({ values }) {
  form.value[translatingField.value + "_t9n"] = { ...values };
  translatingField.value = null;
}

function onSave() {
  emit("save", { type: "banner", ...form.value });
}
</script>

<template>
  <BasicModal
    :open="visible"
    :title="banner ? $t('layout_extender.edit_banner') : $t('layout_extender.add_banner')"
    size="md"
    :actions="footerActions"
    @update:open="(open) => !open && emit('close')"
  >
    <div class="flex-column gap-4">
      <FormField
        id="banner-media"
        :label="$t('layout_extender.media_url')"
        hint-level="important"
        :hint="$t('layout_extender.aspect_ratio_hint')"
      >
        <div class="flex-column gap-2">
          <div v-if="form.media_url" class="banner-image-area">
            <img :src="resolveMediaUrl(form.media_url)" :alt="form.alt_text || ''" class="banner-image-preview" />
            <span class="banner-image-area__remove">
              <IconButton
                icon="remove"
                variant="danger"
                size="sm"
                :label="$t('layout_extender.remove_image')"
                @click="clearImage"
              />
            </span>
          </div>

          <!-- The field's control, open gallery or not: the label's `for` targets it, its name is the label followed by
               its own text; it opens and hides the gallery below. -->
          <BasicButton
            id="banner-media"
            :label="`${$t('layout_extender.media_url')}: ${galleryButtonText}`"
            :aria-expanded="String(galleryOpen)"
            @click="toggleGallery"
          >
            {{ galleryButtonText }}
          </BasicButton>

          <div v-if="galleryOpen" class="flex-column gap-2">
            <Loader v-if="galleryLoading" />
            <EmptyState
              v-else-if="galleryError"
              size="sm"
              icon="warning"
              :title="$t('layout_extender.gallery_error')"
              data-testid="banner-gallery-error"
            >
              <BasicButton size="sm" variant="secondary" @click="loadGallery(galleryPage)">
                {{ $t("layout_extender.gallery_retry") }}
              </BasicButton>
            </EmptyState>
            <EmptyState
              v-else-if="!galleryImages.length"
              size="sm"
              icon="image"
              :title="$t('layout_extender.gallery_empty')"
            />
            <div v-else class="banner-gallery__grid">
              <div
                v-for="img in galleryImages"
                :key="img.uid"
                role="button"
                tabindex="0"
                class="banner-gallery__item"
                :class="{ 'banner-gallery__item--selected': form.media_url === img.image }"
                :aria-label="img.meta?.fileName || $t('layout_extender.gallery_image')"
                :aria-pressed="form.media_url === img.image ? 'true' : 'false'"
                @click="selectImage(img)"
                @keydown.enter.prevent="selectImage(img)"
                @keydown.space.prevent="selectImage(img)"
              >
                <img :src="resolveMediaUrl(img.image)" alt="" />
              </div>
            </div>
            <!-- Outside the empty branch: a failed or empty page keeps the way back to the others. -->
            <Pagination v-if="!galleryLoading" :page="galleryPage" :pages="galleryPages" @update:page="loadGallery" />
          </div>
        </div>
      </FormField>

      <FormField v-for="field in TRANSLATABLE_FIELDS" :key="field" :label="$t(`layout_extender.${field}`)">
        <div class="flex ai-st gap-3">
          <BasicInput v-model="form[field]" class="fg-1" />
          <IconButton
            v-if="languages.length > 1"
            icon="translate"
            :label="translationsLabel(field)"
            variant="outline"
            @click="translatingField = field"
          />
        </div>
      </FormField>

      <FormField :label="$t('layout_extender.link_type')">
        <BasicRadioGroup v-model="form.button_link_type" :options="linkTypes" />
      </FormField>

      <FormField
        :label="form.button_link_type === 'url' ? $t('layout_extender.url') : $t('layout_extender.link_value')"
      >
        <EntitySearchPicker
          v-if="form.button_link_type === 'category'"
          :modelValue="form.button_link_value"
          :displayValue="form.button_link_display"
          :fetchFn="categoryFetch"
          :placeholder="$t('layout_extender.search_category')"
          :manual="!pimEnabled"
          @update:modelValue="form.button_link_value = $event"
          @update:displayValue="form.button_link_display = $event"
          @clear="form.button_link_value = ''; form.button_link_display = ''"
        />
        <EntitySearchPicker
          v-else-if="form.button_link_type === 'page'"
          :modelValue="form.button_link_value"
          :displayValue="form.button_link_display"
          :fetchFn="pageFetch"
          :placeholder="$t('layout_extender.search_page')"
          :clientFilter="true"
          @update:modelValue="form.button_link_value = $event"
          @update:displayValue="form.button_link_display = $event"
          @clear="form.button_link_value = ''; form.button_link_display = ''"
        />
        <BasicInput v-else v-model="form.button_link_value" :placeholder="'https://...'" />
      </FormField>
    </div>
  </BasicModal>

  <TranslationsDrawer
    :visible="!!translatingField"
    :title="translatingFieldLabel"
    :languages="languages"
    :default-language="defaultLanguage"
    :values="translatingFieldValues"
    @cancel="translatingField = null"
    @save="onTranslationsSave"
  />
</template>

<style scoped>
.banner-image-area {
  position: relative;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  overflow: hidden;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-raised);
}

.banner-image-preview {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
}

.banner-image-area__remove {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: inline-flex;
  background: var(--surface-base);
  border-radius: var(--radius-base);
}

.banner-gallery__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1);
  max-height: 240px;
  overflow-y: auto;
  padding: var(--space-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
}

.banner-gallery__item {
  aspect-ratio: 1;
  border-radius: var(--radius-base);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.1s;
}

.banner-gallery__item:hover,
.banner-gallery__item--selected {
  border-color: var(--accent);
}

.banner-gallery__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.banner-gallery__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
