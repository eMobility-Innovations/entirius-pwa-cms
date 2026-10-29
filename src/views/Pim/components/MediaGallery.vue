<script setup>
import { ref, reactive, computed, watch, nextTick } from "vue";
import { t } from "@/i18n";
import { useNotifyStore } from "@/stores/notify";
import { safeHref } from "@/utils/safeHref";
import { usePimChannelStore } from "@/stores/pimChannel";
import draggable from "vuedraggable";
import { useReadonly } from "@/composables/useReadonly";
import {
  POST_UploadPicture,
  GET_ProductPictures,
  POST_ProductPicture,
  PATCH_ProductPicture,
  DELETE_ProductPicture,
  GET_ProductVideos,
  POST_ProductVideo,
  PATCH_ProductVideo,
  DELETE_ProductVideo,
} from "@/api/pim/api";
import { extractApiMessage } from "@/composables/useFormErrors";

const props = defineProps({
  channelIdx: { type: String, required: true },
  sku: { type: String, required: true },
  // AI actions on one picture ([{ key, label }], the product page's image templates): a tile menu that emits
  // `ai-run` with the action's key and the picture's ref (its product-picture pk). Empty = no menu.
  aiActions: { type: Array, default: () => [] },
});

const emit = defineEmits(["media-changed", "ai-run"]);

const notify = useNotifyStore();
// The product page's read-only mode: no reorder, upload, drop or edit of the media.
const readonly = useReadonly();
const pimChannel = usePimChannelStore();
const API_BASE = process.env.VUE_APP_API_URL || "";

const defaultLang = computed(
  () =>
    pimChannel.activeChannel?.default_language ||
    pimChannel.activeChannelLanguages[0] ||
    "en"
);

// Display string for the gallery/lightbox: default language first, any filled language as fallback.
function altForDisplay(altT9n) {
  if (!altT9n) return "";
  return (
    altT9n[defaultLang.value] || Object.values(altT9n).find((v) => v) || ""
  );
}

function mediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return API_BASE + path;
}

// --- State ---
const pictures = ref([]);
const videos = ref([]);
const loading = ref(false);
const selectedIndex = ref(0);
const editingItem = ref(null);

const isDraggingOver = ref(false);
const uploadingPicture = ref(false);

const newVideoUrl = ref("");
const addingVideo = ref(false);

const deletingKey = ref(null);
const confirmingDeleteItem = ref(null);

const vimeoThumbnails = reactive({});
const brokenImages = reactive(new Set());

function onImgError(url) {
  brokenImages.add(url);
}

// --- Computed ---
const mediaItems = computed(() => {
  const pics = pictures.value.map((p) => ({
    type: "picture",
    pk: p.pk,
    position: p.position ?? 0,
    imageUrl: mediaUrl(p.picture?.image_url || p.url || p.image),
    role: p.picture_role || "GENERAL",
    altTextT9n: p.alt_text_t9n || {},
    altText: altForDisplay(p.alt_text_t9n),
    raw: p,
  }));
  const vids = videos.value.map((v) => {
    const url = v.video?.video_url || v.url || "";
    return {
      type: "video",
      pk: v.pk,
      position: v.position ?? 0,
      videoUrl: url,
      title: v.video?.title || v.title || "",
      source: v.video?.source || detectVideoSource(url),
      thumbnailUrl: getVideoThumbnail(url),
      raw: v,
    };
  });
  return [...pics, ...vids].sort((a, b) => a.position - b.position);
});

const orderedItems = computed({
  get: () => mediaItems.value,
  set: () => {},
});

const selectedItem = computed(() => {
  if (!mediaItems.value.length) return null;
  return mediaItems.value[selectedIndex.value] || mediaItems.value[0];
});

const totalAssets = computed(() => mediaItems.value.length);

const roleOptions = computed(() => [
  { label: t("pim.role_main"), value: "MAIN" },
  { label: t("pim.role_general"), value: "GENERAL" },
  { label: t("pim.role_variant"), value: "VARIANT" },
  { label: t("pim.role_angle"), value: "ANGLE" },
]);

const videoRoleOptions = computed(() => [
  { label: t("pim.role_main"), value: "MAIN" },
  { label: t("pim.role_variant"), value: "VARIANT" },
  { label: t("pim.role_general"), value: "GENERAL" },
]);

// --- Helpers ---
function detectVideoSource(url) {
  if (!url) return "unknown";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  return "unknown";
}

function getVideoThumbnail(url) {
  if (!url) return "";
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch && vimeoThumbnails[vimeoMatch[1]])
    return vimeoThumbnails[vimeoMatch[1]];
  return "";
}

function fetchVimeoThumbnails() {
  for (const v of videos.value) {
    const url = v.video?.video_url || v.url || "";
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (!match || vimeoThumbnails[match[1]]) continue;
    const vimeoId = match[1];
    fetch(
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}&width=320`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.thumbnail_url) vimeoThumbnails[vimeoId] = data.thumbnail_url;
      })
      .catch(() => {});
  }
}

function getVideoEmbedUrl(url) {
  if (!url) return "";
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return "";
}

function itemKey(item) {
  return `${item.type}-${item.pk}`;
}

function tileSrc(item) {
  const url = item.type === "picture" ? item.imageUrl : item.thumbnailUrl;
  return url && !brokenImages.has(url) ? url : "";
}

function tileCaption(item) {
  return item.type === "picture" ? item.altText : item.title || item.videoUrl;
}

// --- Data loading ---
async function fetchAll() {
  loading.value = true;
  try {
    const [picRes, vidRes] = await Promise.all([
      GET_ProductPictures(props.channelIdx, props.sku),
      GET_ProductVideos(props.channelIdx, props.sku),
    ]);
    pictures.value = picRes.data.results || picRes.data || [];
    videos.value = vidRes.data.results || vidRes.data || [];
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    loading.value = false;
  }
}

async function refetchPictures() {
  try {
    const { data } = await GET_ProductPictures(props.channelIdx, props.sku);
    pictures.value = data.results || data || [];
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  }
}

async function refetchVideos() {
  try {
    const { data } = await GET_ProductVideos(props.channelIdx, props.sku);
    videos.value = data.results || data || [];
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  }
}

// --- Drag & reorder ---
async function onDragEnd(evt) {
  const newList = [...mediaItems.value];
  const [moved] = newList.splice(evt.oldIndex, 1);
  newList.splice(evt.newIndex, 0, moved);

  for (let i = 0; i < newList.length; i++) {
    const item = newList[i];
    if (item.position !== i) {
      try {
        if (item.type === "picture") {
          await PATCH_ProductPicture(props.channelIdx, props.sku, item.pk, {
            position: i,
          });
        } else {
          await PATCH_ProductVideo(props.channelIdx, props.sku, item.pk, {
            position: i,
          });
        }
      } catch (err) {
        notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, t("notifications.error")),
        });
      }
    }
  }

  await Promise.all([refetchPictures(), refetchVideos()]);

  // Keep selection on the moved item
  const movedKey = itemKey(moved);
  const newIdx = mediaItems.value.findIndex((m) => itemKey(m) === movedKey);
  if (newIdx >= 0) selectedIndex.value = newIdx;

  notify.spawnNotification({ type: "positive", msg: t("pim.media_reordered") });
  emit("media-changed");
}

// --- Thumbnail selection ---
function selectItem(index) {
  selectedIndex.value = index;
}

// --- Upload pictures ---
function onDropZoneClick() {
  if (readonly.value) return;
  document.getElementById("picture-file-input").click();
}

function onFileInputChange(event) {
  const files = event.target.files;
  if (!files?.length) return;
  for (const file of files) {
    uploadPicture(file);
  }
  event.target.value = "";
}

function onDragOver(event) {
  event.preventDefault();
  isDraggingOver.value = true;
}

function onDragLeave() {
  isDraggingOver.value = false;
}

function onDrop(event) {
  event.preventDefault();
  isDraggingOver.value = false;
  if (readonly.value) return;
  const files = event.dataTransfer.files;
  if (files?.length) {
    for (const file of files) {
      uploadPicture(file);
    }
  }
}

async function uploadPicture(file) {
  uploadingPicture.value = true;
  try {
    const formData = new FormData();
    formData.append("image", file);
    const uploadRes = await POST_UploadPicture(formData);
    notify.spawnNotification({
      type: "positive",
      msg: t("pim.picture_uploaded"),
    });

    const role = pictures.value.length === 0 ? "MAIN" : "GENERAL";
    await POST_ProductPicture(props.channelIdx, props.sku, {
      picture_pk: uploadRes.data.pk,
      picture_role: role,
    });
    notify.spawnNotification({
      type: "positive",
      msg: t("pim.picture_linked"),
    });

    await refetchPictures();
    // Select the newly added picture
    await nextTick();
    selectedIndex.value = mediaItems.value.length - 1;
    emit("media-changed");
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    uploadingPicture.value = false;
  }
}

// --- Add video ---
async function addVideo() {
  if (!newVideoUrl.value.trim()) return;
  addingVideo.value = true;
  try {
    await POST_ProductVideo(props.channelIdx, props.sku, {
      video_url: newVideoUrl.value.trim(),
    });
    notify.spawnNotification({ type: "positive", msg: t("pim.video_added") });
    newVideoUrl.value = "";
    await refetchVideos();
    fetchVimeoThumbnails();
    await nextTick();
    selectedIndex.value = mediaItems.value.length - 1;
    emit("media-changed");
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    addingVideo.value = false;
  }
}

// --- Edit item ---
const translatingAlt = ref(false);

function openEdit(item) {
  if (readonly.value) return;
  editingItem.value = {
    ...item,
    editRole: item.role || "GENERAL",
    // Full t9n dict (cloned) — the PATCH sends it whole, so the drawer edit of one
    // language must never drop the siblings (API treats alt_text_t9n as full replace).
    editAltTextT9n: { ...(item.altTextT9n || {}) },
    editTitle: item.title || "",
  };
}

function onAltTranslationsSave({ values }) {
  if (editingItem.value) {
    editingItem.value.editAltTextT9n = { ...values };
  }
  translatingAlt.value = false;
}

const editAltPreview = computed(() =>
  editingItem.value ? altForDisplay(editingItem.value.editAltTextT9n) : ""
);

const editAltFilledCount = computed(() => {
  if (!editingItem.value) return 0;
  return Object.values(editingItem.value.editAltTextT9n || {}).filter((v) => v)
    .length;
});

const altLabel = computed(() => {
  if (!editAltFilledCount.value) return t("pim.alt_text");
  const total = pimChannel.activeChannelLanguages.length;
  return `${t("pim.alt_text")} (${editAltFilledCount.value}/${total})`;
});

function closeEdit() {
  editingItem.value = null;
  translatingAlt.value = false;
}

async function saveEdit() {
  if (!editingItem.value) return;
  const item = editingItem.value;
  try {
    if (item.type === "picture") {
      await PATCH_ProductPicture(props.channelIdx, props.sku, item.pk, {
        picture_role: item.editRole,
        alt_text_t9n: item.editAltTextT9n,
      });
      await refetchPictures();
    } else {
      await PATCH_ProductVideo(props.channelIdx, props.sku, item.pk, {
        title: item.editTitle,
      });
      await refetchVideos();
    }
    notify.spawnNotification({ type: "positive", msg: t("pim.media_saved") });
    emit("media-changed");
    closeEdit();
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  }
}

// --- Delete item ---
async function deleteItem(item) {
  if (readonly.value) return;
  const key = itemKey(item);
  deletingKey.value = key;
  try {
    if (item.type === "picture") {
      await DELETE_ProductPicture(props.channelIdx, props.sku, item.pk);
      notify.spawnNotification({
        type: "positive",
        msg: t("pim.picture_deleted"),
      });
      await refetchPictures();
    } else {
      await DELETE_ProductVideo(props.channelIdx, props.sku, item.pk);
      notify.spawnNotification({
        type: "positive",
        msg: t("pim.video_deleted"),
      });
      await refetchVideos();
    }

    await nextTick();
    if (selectedIndex.value >= mediaItems.value.length) {
      selectedIndex.value = Math.max(0, mediaItems.value.length - 1);
    }
    if (editingItem.value && itemKey(editingItem.value) === key) {
      closeEdit();
    }
    emit("media-changed");
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    deletingKey.value = null;
  }
}

// --- Lifecycle ---
// Fetch only once a real SKU is available. The parent mounts MediaGallery
// before the product GET resolves, so `sku` is briefly undefined — without
// this guard we'd hit /products/undefined/pictures/ (404 + error toast) and
// never retry. `immediate` covers the already-loaded case; the watch covers
// the product-loads-later case.
watch(
  () => props.sku,
  async (sku) => {
    if (!sku) return;
    await fetchAll();
    fetchVimeoThumbnails();
  },
  { immediate: true }
);
</script>

<template>
  <div class="media-gallery">
    <!-- Header -->
    <div class="media-gallery__header">
      <h3 class="fs-400 fw-600 t-body">{{ $t("pim.media_gallery") }}</h3>
      <span v-if="totalAssets" class="media-gallery__count t-muted fs-200">
        {{ totalAssets }} {{ totalAssets === 1 ? "asset" : "assets" }}
      </span>
    </div>

    <Loader block v-if="loading" />

    <template v-else>
      <!-- Large preview -->
      <div class="media-gallery__preview">
        <template v-if="selectedItem">
          <img
            v-if="
              selectedItem.type === 'picture' &&
              !brokenImages.has(selectedItem.imageUrl)
            "
            :src="selectedItem.imageUrl"
            :alt="selectedItem.altText"
            class="media-gallery__main-img"
            @error="onImgError(selectedItem.imageUrl)"
          />
          <div
            v-else-if="
              selectedItem.type === 'picture' &&
              brokenImages.has(selectedItem.imageUrl)
            "
            class="media-gallery__broken-placeholder"
          >
            <FontAwesomeIcon :icon="$icons.video" class="fs-700" />
            <a
              :href="selectedItem.imageUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="t-accent fs-200 mt-2"
            >
              {{ selectedItem.altText || selectedItem.imageUrl }}
            </a>
          </div>
          <div v-else class="media-gallery__video-preview">
            <iframe
              v-if="getVideoEmbedUrl(selectedItem.videoUrl)"
              :src="getVideoEmbedUrl(selectedItem.videoUrl)"
              class="media-gallery__video-iframe"
              frameborder="0"
              allowfullscreen
            />
            <div v-else class="media-gallery__video-link">
              <FontAwesomeIcon
                :icon="$icons.play"
                class="t-muted fs-700"
              />
              <a
                :href="safeHref(selectedItem.videoUrl)"
                target="_blank"
                rel="noopener noreferrer"
                class="t-accent fs-200 mt-2"
              >
                {{ selectedItem.videoUrl }}
              </a>
            </div>
          </div>
        </template>
        <div v-else class="media-gallery__no-image">
          <FontAwesomeIcon
            :icon="$icons.image"
            class="t-muted"
            style="font-size: var(--fs-700)"
          />
          <span class="t-muted fs-200 mt-2">{{
            $t("pim.no_media")
          }}</span>
        </div>

        <!-- Edit panel (overlays preview) -->
        <div v-if="editingItem" class="media-gallery__edit-panel">
          <div class="media-gallery__edit-header">
            <span class="fw-600 fs-300 t-body">{{
              $t("pim.edit_media")
            }}</span>
            <IconButton
              icon="close"
              size="sm"
              :label="$t('common.close')"
              @click="closeEdit"
            />
          </div>

          <div class="media-gallery__edit-body">
            <template v-if="editingItem.type === 'picture'">
              <FormField :label="$t('pim.picture_role')">
                <BasicSelect
                  :options="roleOptions"
                  v-model="editingItem.editRole"
                />
              </FormField>
              <FormField :label="altLabel">
                <span v-if="editAltPreview" class="t-secondary fs-200 lc-1">
                  {{ editAltPreview }}
                </span>
                <BasicButton
                  variant="secondary"
                  @click="translatingAlt = true"
                >
                  {{ $t('pim.translations') }}
                </BasicButton>
              </FormField>
            </template>

            <template v-else>
              <FormField :label="$t('pim.video_title')">
                <BasicInput
                  v-model="editingItem.editTitle"
                  :placeholder="$t('pim.video_title')"
                />
              </FormField>
              <FormField :label="$t('pim.video_url')">
                <BasicInput :model-value="editingItem.videoUrl" readonly />
              </FormField>
            </template>
          </div>

          <div class="media-gallery__edit-actions">
            <BasicButton mutates
              variant="primary"
              @click="saveEdit"
            >
              {{ $t('common.save') }}
            </BasicButton>
            <BasicButton
              variant="secondary"
              @click="closeEdit"
            >
              {{ $t('common.cancel') }}
            </BasicButton>
          </div>
        </div>
      </div>

      <!-- Thumbnail grid -->
      <div class="media-gallery__thumb-strip">
        <draggable
          :model-value="orderedItems"
          ghost-class="media-gallery__ghost"
          :force-fallback="true"
          fallback-class="media-gallery__drag-clone"
          :item-key="itemKey"
          :disabled="readonly"
          class="media-gallery__drag-container"
          @end="onDragEnd"
        >
          <template #item="{ element, index }">
            <MediaTile
              :src="tileSrc(element)"
              :alt="element.altText || ''"
              :caption="tileCaption(element)"
              :selected="index === selectedIndex"
              :video="element.type === 'video'"
              @click="selectItem(index)"
              @keydown.enter.self="selectItem(index)"
              @error.capture="onImgError(tileSrc(element))"
            >
              <template v-if="element.role === 'MAIN'" #overlay>
                <Tag :label="$t('pim.role_main')" />
              </template>
              <template v-if="!readonly" #actions>
                <BasicMenu
                  v-if="aiActions.length && element.type === 'picture'"
                  :items="aiActions"
                  :label="$t('pim.ai_on_picture')"
                  placement="bottom-end"
                  @select="({ key }) => emit('ai-run', { template: key, pictureRef: String(element.pk) })"
                >
                  <template #trigger>
                    <IconButton icon="enrich" size="sm" :label="$t('pim.ai_on_picture')" data-testid="media-ai-menu" />
                  </template>
                </BasicMenu>
                <IconButton
                  icon="edit"
                  size="sm"
                  :label="$t('pim.edit_media')"
                  @click="openEdit(element)"
                />
                <IconButton
                  icon="delete"
                  size="sm"
                  variant="danger"
                  :label="$t('common.delete')"
                  :disabled="deletingKey === itemKey(element)"
                  @click="confirmingDeleteItem = element"
                />
              </template>
            </MediaTile>
          </template>
        </draggable>
      </div>

      <!-- Unified add-media zone -->
      <div v-if="!readonly" class="media-gallery__add-zone">
        <div
          class="media-gallery__upload-area"
          :class="{ 'media-gallery__upload-area--dragover': isDraggingOver }"
          role="button"
          :aria-label="$t('pim.drop_files_here')"
          tabindex="0"
          @click="onDropZoneClick"
          @keydown.enter="onDropZoneClick"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <span v-if="uploadingPicture" class="t-muted fs-200">...</span>
          <template v-else>
            <FontAwesomeIcon :icon="$icons.upload" class="t-muted fs-400" />
            <span class="t-muted fs-200 mt-2">{{
              $t("pim.drop_files_here")
            }}</span>
          </template>
        </div>
        <div class="media-gallery__divider">
          <span class="media-gallery__divider-line" />
          <span class="media-gallery__divider-text t-muted fs-200">{{ $t("pim.upload_or") }}</span>
          <span class="media-gallery__divider-line" />
        </div>
        <div class="media-gallery__video-inline">
          <BasicInput
            v-model="newVideoUrl"
            class="media-gallery__video-input"
            icon="link"
            :placeholder="$t('pim.video_url_placeholder')"
            @on-key-down="addVideo"
          />
          <BasicButton mutates
            variant="secondary"
            class="media-gallery__video-submit"
            :disabled="addingVideo || !newVideoUrl.trim()"
            @click="addVideo"
          >
            {{ $t('pim.add_video') }}
          </BasicButton>
        </div>
      </div>
      <input
        id="picture-file-input"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        :disabled="readonly"
        @change="onFileInputChange"
      />
    </template>

    <TranslationsDrawer
      :visible="translatingAlt"
      :title="$t('pim.alt_text')"
      :languages="pimChannel.activeChannelLanguages"
      :default-language="defaultLang"
      :values="editingItem ? editingItem.editAltTextT9n : {}"
      @cancel="translatingAlt = false"
      @save="onAltTranslationsSave"
    />

    <ConfirmDialog
      tone="danger"
      :open="!!confirmingDeleteItem"
      :title="$t('pim.confirm_delete_title')"
      @confirm="
        deleteItem(confirmingDeleteItem);
        confirmingDeleteItem = null;
      "
      @cancel="confirmingDeleteItem = null"
    >
      <template #default>
        <p>{{ $t("pim.confirm_delete_media") }}</p>
      </template>
    </ConfirmDialog>
  </div>
</template>

<style lang="scss" scoped>
.media-gallery {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  &__count {
    white-space: nowrap;
  }

  &__preview {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-base);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--surface-inverse);
    position: relative;
  }

  &__main-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &__video-preview {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__video-iframe {
    width: 100%;
    height: 100%;
  }

  &__video-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  // Empty preview: a themed sunken box, not the inverse photo backdrop (a light block in dark theme).
  &__preview:has(&__no-image) {
    background: var(--surface-sunken);
  }

  &__no-image {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  &__broken-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    gap: var(--space-1);
  }

  // --- Tile grid ---
  &__thumb-strip {
    margin-top: var(--space-2);
  }

  // One row of tiles that scrolls sideways in its own box: the column holds one 188 px tile, so a wrapping grid
  // would stack every asset under the preview.
  &__drag-container {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-2);

    > * {
      flex-shrink: 0;
    }
  }

  // --- Ghost / drag clone ---
  &__ghost {
    opacity: 0.4;
  }

  // --- Unified add-media zone ---
  &__add-zone {
    margin-top: var(--space-2);
    border: 2px dashed var(--border-default);
    border-radius: var(--radius-base);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  &__upload-area {
    width: 100%;
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: var(--radius-base);
    transition: background 0.15s;

    &:hover,
    &:focus-visible {
      background: var(--surface-raised);
      outline: none;
    }

    &--dragover {
      background: var(--surface-raised);
    }
  }

  &__divider {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
  }

  &__divider-line {
    flex: 1;
    height: 1px;
    background: var(--surface-hover);
  }

  &__divider-text {
    text-transform: lowercase;
    white-space: nowrap;
  }

  &__video-inline {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  &__video-input {
    flex: 1;
    min-width: 0; // an input keeps ~170 px intrinsic width; the row must fit a phone
  }

  &__video-submit {
    flex-shrink: 0;
    white-space: nowrap;
  }

  // --- Edit panel (overlays preview) ---
  &__edit-panel {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-base);
    background: var(--surface-base);
    display: flex;
    flex-direction: column;
    z-index: 2;
  }

  &__edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
  }

  &__edit-body {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
  }

  &__edit-actions {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--border-subtle);
    margin-top: auto;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.mt-2 {
  margin-top: var(--space-2);
}
.lc-1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style lang="scss">
/* Global (unscoped) — SortableJS drag clones are appended to <body> */
.media-gallery__drag-clone {
  opacity: 0.9;
  border: 2px solid var(--accent);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-md);
}
</style>
