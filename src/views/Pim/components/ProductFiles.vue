<script setup>
import { ref, computed, onMounted } from "vue";
import { t } from "@/i18n";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import {
  GET_ProductFiles,
  POST_UploadFile,
  POST_ProductFile,
  DELETE_ProductFile,
  GET_FilesCategories,
  PATCH_File,
  POST_FilesCategory,
} from "@/api/pim/api";
import { extractApiMessage } from "@/composables/useFormErrors";

const props = defineProps({
  channelIdx: { type: String, required: true },
  sku: { type: String, required: true },
  readonly: { type: Boolean, default: false },
});

const notify = useNotifyStore();
const pimChannel = usePimChannelStore();

const files = ref([]);
const loading = ref(false);
const uploadingFile = ref(false);
const deletingFilePk = ref(null);
const isDragging = ref(false);
const categories = ref([]);
const editingStates = ref({});
const expandedFiles = ref({});
const savingFilePk = ref(null);

// Pending file (held until user confirms via popup)
const pendingFile = ref(null);
const uploadCategory = ref(null);
const uploadLabelT9n = ref({});

// Category quick-add
const showCategoryCreate = ref(false);
const newCategoryCode = ref("");
const newCategoryNameT9n = ref({});
const creatingCategory = ref(false);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const FILE_TYPE_BADGES = {
  1: { label: "Image", variant: "info" },
  2: { label: "PDF", variant: "warning" },
  3: { label: "Document", variant: "neutral" },
  4: { label: "Video", variant: "positive" },
};

const formLanguages = computed(() => {
  return pimChannel.activeChannelLanguages?.length > 0
    ? pimChannel.activeChannelLanguages
    : ["en"];
});

const categoryDropdownValues = computed(() => {
  const items = categories.value.map((c) => ({
    label: c.name || c.code,
    value: c.code,
  }));
  items.push({ label: `+ ${t("pim.create_category")}`, value: "__create__" });
  return items;
});

function fileTypeBadge(pf) {
  const ft = pf.file?.file_type;
  return FILE_TYPE_BADGES[ft] || null;
}

async function fetchFiles() {
  loading.value = true;
  try {
    const { data } = await GET_ProductFiles(props.channelIdx, props.sku);
    files.value = data.results || data || [];
    const states = {};
    for (const pf of files.value) {
      const f = pf.file || {};
      states[f.pk] = {
        file_label_t9n: { ...(f.file_label_t9n || {}) },
        category_code: f.category_code || null,
      };
    }
    editingStates.value = states;
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    loading.value = false;
  }
}

async function fetchCategories() {
  try {
    const { data } = await GET_FilesCategories();
    categories.value = data.results || data || [];
  } catch {
    categories.value = [];
  }
}

// --- Drop / select: stage the file, show popup ---

function onFileInputChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  stageFile(file);
  event.target.value = "";
}

function onDragOver(event) {
  event.preventDefault();
  isDragging.value = true;
}

function onDragLeave() {
  isDragging.value = false;
}

function onDrop(event) {
  event.preventDefault();
  isDragging.value = false;
  if (props.readonly) return;
  const file = event.dataTransfer.files?.[0];
  if (file) stageFile(file);
}

function stageFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    notify.spawnNotification({
      type: "negative",
      msg: t("pim.file_too_large"),
    });
    return;
  }
  pendingFile.value = file;
  uploadCategory.value = null;
  uploadLabelT9n.value = {};
  showCategoryCreate.value = false;
}

function cancelUpload() {
  pendingFile.value = null;
  uploadCategory.value = null;
  uploadLabelT9n.value = {};
  showCategoryCreate.value = false;
}

async function confirmUpload() {
  if (!pendingFile.value) return;
  const file = pendingFile.value;

  uploadingFile.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);

    const hasT9n = Object.values(uploadLabelT9n.value).some((v) => !!v);
    if (hasT9n) {
      formData.append("file_label_t9n", JSON.stringify(uploadLabelT9n.value));
    }

    const uploadRes = await POST_UploadFile(formData);
    const filePk = uploadRes.data.pk;

    if (uploadCategory.value) {
      try {
        await PATCH_File(filePk, { file_category_code: uploadCategory.value });
      } catch {
        // Non-critical
      }
    }

    notify.spawnNotification({ type: "positive", msg: t("pim.file_uploaded") });

    try {
      await POST_ProductFile(props.channelIdx, props.sku, { file_pk: filePk });
      notify.spawnNotification({ type: "positive", msg: t("pim.file_linked") });
    } catch (linkErr) {
      if (
        linkErr?.response?.status === 400 ||
        linkErr?.error === "VALIDATION_ERROR"
      ) {
        notify.spawnNotification({
          type: "warning",
          msg: t("pim.file_already_linked"),
        });
      } else {
        notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(linkErr, t("notifications.error")),
        });
      }
    }

    cancelUpload();
    await fetchFiles();
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    uploadingFile.value = false;
  }
}

// --- Inline editing on existing files ---

async function patchFile(filePk, payload) {
  savingFilePk.value = filePk;
  try {
    await PATCH_File(filePk, payload);
    notify.spawnNotification({ type: "positive", msg: t("pim.file_updated") });
    await fetchFiles();
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    savingFilePk.value = null;
  }
}

function toggleEditRow(filePk) {
  expandedFiles.value[filePk] = !expandedFiles.value[filePk];
}

function closeEditRow(filePk) {
  expandedFiles.value[filePk] = false;
}

function saveFileMetadata(filePk) {
  const state = editingStates.value[filePk];
  if (!state) return;
  const payload = {};
  payload.file_label_t9n = state.file_label_t9n;
  payload.file_category_code = state.category_code || null;
  patchFile(filePk, payload);
}

function onCategorySelect(filePk, val) {
  if (val === "__create__") {
    showCategoryCreate.value = true;
    return;
  }
  const state = editingStates.value[filePk];
  if (state) state.category_code = val;
}

function onUploadCategorySelect(val) {
  if (val === "__create__") {
    showCategoryCreate.value = true;
    return;
  }
  uploadCategory.value = val;
}

// --- Category quick-add ---

async function createCategory() {
  if (!newCategoryCode.value) return;
  creatingCategory.value = true;
  try {
    const { data } = await POST_FilesCategory({
      code: newCategoryCode.value,
      name_t9n: newCategoryNameT9n.value,
    });
    categories.value.push(data);
    notify.spawnNotification({
      type: "positive",
      msg: t("pim.category_created"),
    });
    showCategoryCreate.value = false;
    newCategoryCode.value = "";
    newCategoryNameT9n.value = {};
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    creatingCategory.value = false;
  }
}

function cancelCategoryCreate() {
  showCategoryCreate.value = false;
  newCategoryCode.value = "";
  newCategoryNameT9n.value = {};
}

// --- File list helpers ---

async function deleteFile(pk) {
  if (props.readonly) return;
  deletingFilePk.value = pk;
  try {
    await DELETE_ProductFile(props.channelIdx, props.sku, pk);
    notify.spawnNotification({ type: "positive", msg: t("pim.file_deleted") });
    await fetchFiles();
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    deletingFilePk.value = null;
  }
}

function fileData(pf) {
  return pf.file || {};
}

function fileName(pf) {
  const f = fileData(pf);
  return f.original_file_name || f.file_label || "";
}

function fileIcon(pf) {
  const name = fileName(pf).toLowerCase();
  if (name.endsWith(".pdf")) return "file-pdf";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "file-word";
  if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return "file-image";
  if (name.match(/\.(mp4|avi|mov|webm)$/)) return "file-video";
  return "file";
}

function fileUrl(pf) {
  const url = pf.file?.file_url;
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = (process.env.VUE_APP_API_URL || "").replace(/\/$/, "");
  return `${base}${url}`;
}

onMounted(() => {
  fetchFiles();
  fetchCategories();
});
</script>

<template>
  <div class="product-files">
    <div class="product-files__header flex ai-ct jc-sb mb-8">
      <h3 class="fs-500 fw-600">{{ $t("pim.files") }}</h3>
      <span v-if="files.length" class="fs-200 t-muted">
        {{ files.length }} {{ files.length === 1 ? "file" : "files" }}
      </span>
    </div>

    <Loader block v-if="loading" />

    <template v-else>
      <!-- Upload drop zone -->
      <label
        v-if="!readonly && !pendingFile"
        for="product-file-upload-input"
        class="product-files__dropzone"
        :class="{ 'product-files__dropzone--dragover': isDragging }"
        :aria-label="$t('pim.drop_files_here')"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <FontAwesomeIcon :icon="$icons.upload" class="t-muted fs-500" />
        <span class="t-secondary fs-200 mt-2">{{
          $t("pim.drop_files_here")
        }}</span>
        <span class="t-muted fs-200 mt-2">{{
          $t("pim.files_supported_hint")
        }}</span>
      </label>
      <input
        id="product-file-upload-input"
        type="file"
        class="sr-only"
        @change="onFileInputChange"
      />

      <!-- Upload popup (shown after file is staged) -->
      <div v-if="pendingFile" class="product-files__popup">
        <div class="product-files__popup-header flex ai-ct gap-5 mb-5">
          <FontAwesomeIcon :icon="$icons.file" class="t-accent fs-400" />
          <span class="fs-300 fw-600 t-body">{{ pendingFile.name }}</span>
        </div>

        <div class="product-files__popup-fields">
          <div class="product-files__field">
            <label class="product-files__label field-label">{{
              $t("pim.file_category")
            }}</label>
            <BasicSelect
              :options="categoryDropdownValues"
              :model-value="uploadCategory"
              :placeholder="$t('pim.select_category')"
              @update:model-value="onUploadCategorySelect"
            />
          </div>
          <div
            v-for="lang in formLanguages"
            :key="`upload-label-${lang}`"
            class="product-files__field"
          >
            <label class="product-files__label field-label">
              {{ $t("pim.file_label") }}
              <StatusBadge
                tone="accent"
                size="sm"
                :dot="false"
                :label="lang.toUpperCase()"
              />
            </label>
            <BasicInput
              :model-value="uploadLabelT9n[lang] || ''"
              @update:modelValue="(val) => (uploadLabelT9n[lang] = val)"
            />
          </div>
        </div>

        <!-- Category quick-add (inside popup) -->
        <div v-if="showCategoryCreate" class="product-files__cat-create mt-5">
          <div class="product-files__cat-create-fields">
            <div class="product-files__field">
              <label class="product-files__label field-label required">{{ $t("pim.code") }}</label>
              <BasicInput
                v-model="newCategoryCode"
                :placeholder="$t('pim.file_category_code_placeholder')"
              />
            </div>
            <div
              v-for="lang in formLanguages"
              :key="`cat-name-${lang}`"
              class="product-files__field"
            >
              <label class="product-files__label field-label">
                {{ $t("pim.name") }}
                <StatusBadge
                  tone="accent"
                  size="sm"
                  :dot="false"
                  :label="lang.toUpperCase()"
                />
              </label>
              <BasicInput
                :model-value="newCategoryNameT9n[lang] || ''"
                @update:modelValue="(val) => (newCategoryNameT9n[lang] = val)"
              />
            </div>
          </div>
          <div class="product-files__cat-create-actions mt-2">
            <BasicButton mutates
              variant="secondary"
              :disabled="creatingCategory || !newCategoryCode"
              @click="createCategory"
            >
              {{ $t('pim.create_category') }}
            </BasicButton>
            <BasicButton
              variant="secondary"
              @click="cancelCategoryCreate"
            >
              {{ $t('common.cancel') }}
            </BasicButton>
          </div>
        </div>

        <div class="product-files__popup-actions mt-5">
          <BasicButton mutates
            variant="primary"
            :disabled="uploadingFile"
            @click="confirmUpload"
          >
            {{ $t('pim.upload_file') }}
          </BasicButton>
          <BasicButton
            variant="secondary"
            :disabled="uploadingFile"
            @click="cancelUpload"
          >
            {{ $t('common.cancel') }}
          </BasicButton>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!files.length && !pendingFile" class="product-files__empty">
        <FontAwesomeIcon :icon="$icons.file" class="t-muted fs-600" />
        <span class="t-muted fs-200 mt-5">{{ $t("pim.no_files") }}</span>
      </div>

      <!-- File list -->
      <div v-if="files.length" class="product-files__list mt-8">
        <div v-for="pf in files" :key="pf.pk" class="product-files__row">
          <!-- Row 1: icon + filename + type badge + delete -->
          <div class="product-files__row-top">
            <FontAwesomeIcon
              :icon="fileIcon(pf)"
              class="product-files__icon t-muted"
            />
            <div class="product-files__meta">
              <a
                v-if="fileUrl(pf)"
                :href="fileUrl(pf)"
                target="_blank"
                rel="noopener noreferrer"
                class="product-files__name product-files__name--link t-body fs-300 fw-500"
              >
                {{ fileName(pf) || "—" }}
              </a>
              <span
                v-else
                class="product-files__name t-body fs-300 fw-500"
              >
                {{ fileName(pf) || "—" }}
              </span>
              <div
                class="product-files__details flex ai-ct gap-5 fs-200 t-muted"
              >
                <StatusBadge
                  v-if="fileTypeBadge(pf)"
                  :tone="fileTypeBadge(pf).variant"
                  :label="fileTypeBadge(pf).label"
                />
                <span v-if="pf.file && pf.file.category_name">{{
                  pf.file.category_name
                }}</span>
              </div>
            </div>
            <IconButton
              v-if="!readonly"
              icon="edit"
              size="sm"
              :label="$t('pim.settings')"
              @click="toggleEditRow(fileData(pf).pk)"
            />
            <IconButton mutates
              v-if="!readonly"
              icon="delete"
              size="sm"
              variant="danger"
              :label="$t('common.delete')"
              :disabled="deletingFilePk === pf.pk"
              @click="deleteFile(pf.pk)"
            />
          </div>

          <!-- Row 2: inline editing (category + labels) — toggled -->
          <div
            v-if="
              !readonly &&
              expandedFiles[fileData(pf).pk] &&
              editingStates[fileData(pf).pk]
            "
            class="product-files__row-edit"
          >
            <div class="product-files__row-edit-fields">
              <div class="product-files__field product-files__field--compact">
                <label class="product-files__label field-label">{{
                  $t("pim.file_category")
                }}</label>
                <BasicSelect
                  :options="categoryDropdownValues"
                  :model-value="editingStates[fileData(pf).pk].category_code"
                  :placeholder="$t('pim.select_category')"
                  @update:model-value="(sel) => onCategorySelect(fileData(pf).pk, sel)"
                />
              </div>
              <div
                v-for="lang in formLanguages"
                :key="`label-${fileData(pf).pk}-${lang}`"
                class="product-files__field product-files__field--compact"
              >
                <label class="product-files__label field-label">
                  {{ $t("pim.file_label") }}
                  <StatusBadge
                    tone="accent"
                    size="sm"
                    :dot="false"
                    :label="lang.toUpperCase()"
                  />
                </label>
                <BasicInput
                  :model-value="
                    editingStates[fileData(pf).pk].file_label_t9n[lang] || ''
                  "
                  @update:modelValue="
                    (val) =>
                      (editingStates[fileData(pf).pk].file_label_t9n[lang] =
                        val)
                  "
                />
              </div>
            </div>
            <div class="product-files__row-edit-actions mt-2">
              <BasicButton mutates
                variant="secondary"
                :disabled="savingFilePk === fileData(pf).pk"
                @click="saveFileMetadata(fileData(pf).pk)"
              >
                {{ $t('common.save') }}
              </BasicButton>
              <BasicButton
                variant="secondary"
                @click="closeEditRow(fileData(pf).pk)"
              >
                {{ $t('common.close') }}
              </BasicButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.product-files {
  &__dropzone {
    border: 2px dashed var(--border-default);
    border-radius: var(--radius-base);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    min-height: 80px;

    &:hover,
    &:focus-visible {
      border-color: var(--accent);
      background: var(--surface-raised);
      outline: none;
    }

    &--dragover {
      border-color: var(--accent);
      background: var(--surface-raised);
    }
  }

  &__popup {
    padding: var(--space-4);
    border: 1px solid var(--accent);
    border-radius: var(--radius-base);
    background: var(--surface-base);
    box-shadow: var(--shadow-md);
  }

  &__popup-fields {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: flex-end;
  }

  &__popup-actions {
    display: flex;
    gap: var(--space-2);
  }

  &__cat-create {
    padding: var(--space-3);
    border: 1px solid var(--accent);
    border-radius: var(--radius-base);
    background: var(--surface-raised);
  }

  &__cat-create-fields {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  &__cat-create-actions {
    display: flex;
    gap: var(--space-2);
  }

  &__field {
    flex: 1;
    min-width: 140px;

    &--compact {
      min-width: 120px;
    }
  }

  &__label {
    display: block;
    margin-bottom: var(--space-1);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-10) var(--space-5);
    gap: var(--space-2);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  &__row {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-base);
    background: var(--surface-base);
  }

  &__row-top {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  &__row-edit {
    padding: var(--space-3);
    border-top: 1px solid var(--border-subtle);
  }

  &__row-edit-fields {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: flex-end;
  }

  &__row-edit-actions {
    display: flex;
    gap: var(--space-2);
  }

  &__icon {
    font-size: var(--fs-500);
    flex-shrink: 0;
    width: 24px;
    text-align: center;
  }

  &__meta {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--link {
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  &__details {
    margin-top: 2px;
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
.mt-5 {
  margin-top: var(--space-5);
}
.mt-8 {
  margin-top: var(--space-8);
}
</style>
