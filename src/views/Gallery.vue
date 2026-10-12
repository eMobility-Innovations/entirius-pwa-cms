<template>
  <PageLayout class="gallery" roomy>
    <template #header>
      <PageHeader :title="$t('nav.gallery')" />
    </template>
    <template #toolbar>
      <div class="gallery__controls">
        <span id="gallery-filter-label" class="gallery__label">{{ $t("gallery.filter_by_tag") }}</span>
        <div v-if="tags.length" class="gallery__chips" role="group" aria-labelledby="gallery-filter-label">
          <FilterChip
            v-for="tag in tags"
            :key="`filter-${tag.slug}`"
            :label="tag.label"
            :active="filter_tags.includes(tag.slug)"
            :aria-pressed="String(filter_tags.includes(tag.slug))"
            @click="toggleFilterTag(tag)"
          />
          <IconButton
            v-if="filter_tags.length"
            icon="close"
            size="sm"
            :label="$t('gallery.reset_filters')"
            @click="resetFilter"
          />
        </div>
        <div class="gallery__selects">
          <BasicSelect
            :floating-label="$t('common.sort_by')"
            class="gallery__select"
            :options="sortOptions"
            :model-value="sort_by"
            @update:model-value="setSort"
          />
          <BasicSelect
            :floating-label="$t('gallery.page_size')"
            class="gallery__select"
            :options="pageSizeOptions"
            :model-value="limit"
            @update:model-value="setLimit"
          />
        </div>
      </div>
    </template>

    <Loader v-if="!gallery" block />
    <template v-else>
      <div v-if="currentImages.length" class="gallery__grid">
        <MediaTile
          v-for="image in currentImages"
          :key="image.uid"
          :src="thumbnailOf(image.set)"
          :alt="image.meta?.alt || ''"
          :caption="image.meta?.fileName || ''"
        >
          <template v-if="image.tags?.length" #overlay>
            <Tag v-for="tag in image.tags" :key="`img-tag-${image.uid}-${tag.slug}`" :label="tag.label" />
          </template>
          <template #actions>
            <IconButton icon="tag" size="sm" :label="$t('gallery.edit_tags')" @click="openTagEditor(image)" />
            <IconButton
              icon="delete"
              size="sm"
              variant="danger"
              :label="$t('gallery.delete_photo')"
              @click="askDeleteImage(image)"
            />
          </template>
        </MediaTile>
      </div>
      <EmptyState v-else icon="empty" :title="$t('gallery.no_photos')" />
      <Pagination
        v-if="gallery_pagination"
        class="gallery__pagination"
        :nav_size="32"
        :page="current_view_page"
        :pages="gallery_pagination.pages"
        @update:page="set_page({ page: $event, limit, sort: sort_by })"
      />
    </template>

    <FloatingActions :actions="fabActions" />

    <BasicModal
      :open="dialog === 'tags'"
      :title="$t('gallery.go_to_manage_tags')"
      :actions="tagManagerActions"
      @update:open="closeDialog"
    >
      <div class="flex-column gap-4">
        <FormField :label="$t('gallery.tag_list')">
          <BasicSelect
            v-model="selected_tags"
            multiple
            searchable
            :options="tagOptions"
            :placeholder="tags.length ? null : $t('gallery.no_tags')"
          />
        </FormField>
        <FormField :label="$t('gallery.add_new_tag')">
          <div class="flex ai-ct gap-2">
            <BasicInput v-model="new_tag_input" class="fg-1" @on-key-down="addNewTag" />
            <IconButton icon="add" variant="primary" :label="$t('gallery.add_tag')" @click="addNewTag" />
          </div>
        </FormField>
      </div>
    </BasicModal>

    <BasicModal
      :open="dialog === 'edit_tags'"
      :title="$t('gallery.edit_tags')"
      :actions="tagEditorActions"
      @update:open="closeDialog"
    >
      <div class="flex-column gap-4">
        <FormField v-if="tags.length" :label="$t('gallery.select_tags')">
          <BasicSelect v-model="selected_tags" multiple searchable :options="tagOptions" />
        </FormField>
        <div v-else class="flex ai-ct gap-2 t-muted fs-200">
          <span>{{ $t("gallery.no_tags_yet") }}</span>
          <BasicButton variant="ghost" size="sm" @click="openDialog('tags')">
            {{ $t("gallery.go_to_manage_tags") }}
          </BasicButton>
        </div>
        <FormField :label="$t('gallery.quick_add_tag')">
          <div class="flex ai-ct gap-2">
            <BasicInput v-model="new_tag_input" class="fg-1" @on-key-down="quickAddTag" />
            <IconButton icon="add" variant="primary" :label="$t('gallery.add_tag')" @click="quickAddTag" />
          </div>
        </FormField>
      </div>
    </BasicModal>

    <BasicModal
      :open="dialog === 'upload'"
      :title="$t('images.add_photo')"
      :actions="uploadActions"
      @update:open="closeDialog"
    >
      <div class="flex-column gap-4">
        <div
          class="gallery-dropzone"
          :class="{ 'gallery-dropzone--dragover': isDraggingOver }"
          role="button"
          tabindex="0"
          :aria-label="$t('gallery.drop_files_here')"
          @click="$refs.file.click()"
          @keydown.enter="$refs.file.click()"
          @keydown.space.prevent="$refs.file.click()"
          @dragover.prevent="isDraggingOver = true"
          @dragleave="isDraggingOver = false"
          @drop.prevent="onDrop"
        >
          <FontAwesomeIcon :icon="$icons.upload" class="t-muted fs-500" />
          <span class="t-muted fs-200">{{ $t("gallery.drop_files_here") }}</span>
          <span class="t-muted fs-200">{{ $t("gallery.or_click_to_browse") }}</span>
        </div>
        <input
          id="file"
          ref="file"
          type="file"
          name="file"
          class="sr-only"
          accept="image/*"
          @change="set_File"
        />
        <template v-if="filePreview">
          <img :src="filePreview" alt="" class="gallery__preview" />
          <FormField :label="$t('gallery.alt_text')">
            <BasicInput v-model="meta.alt" />
          </FormField>
          <FormField :label="$t('gallery.select_tags')">
            <BasicSelect v-model="selected_tags" multiple searchable :options="tagOptions" />
          </FormField>
        </template>
      </div>
    </BasicModal>

    <ConfirmDialog
      :open="!!confirm"
      tone="danger"
      :title="confirm?.title"
      :message="confirm?.message"
      :confirm-label="$t('common.delete')"
      @confirm="runConfirm"
      @cancel="confirm = null"
    />
  </PageLayout>
</template>

<script>
import {
  _METHOD_content,
  DELETE_ImageTags,
  PUT_ImageTags,
} from "@/api/contentDB/api";
import { useNotifyStore } from "@/stores/notify";
import { slugBuilder } from "@/utils/normalizers/assets-normalizers";
import { thumbnailOf } from "@/utils/thumbnail";

const PAGE_SIZES = [18, 36, 54];

export default {
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  data() {
    return {
      current_view_page: 1,
      limit: 18,
      gallery: null,
      gallery_pagination: null,
      sort_by: "-created_at",
      // uploader
      file: null,
      filePreview: null,
      // tags ---
      tags: [],
      edit_tag: null,
      new_tag: null,
      new_tag_input: "",
      // slugs of the active filter chips; labels picked in the tag dialogs
      filter_tags: [],
      selected_tags: [],
      // ----
      meta: {
        alt: null,
        fileName: null,
      },
      // the open dialog: "tags" (manager) · "edit_tags" (one image) · "upload"; the pending delete confirmation
      dialog: null,
      confirm: null,
      isDraggingOver: false,
      uploading: false,
      tag_img_uid: "",
      edited_image_tags: null,
    };
  },
  computed: {
    fabActions() {
      return [
        {
          icon: "upload",
          label: this.$t("images.add_photo"),
          handler: () => this.openDialog("upload"),
        },
        {
          icon: "tag",
          label: this.$t("gallery.add_tag"),
          handler: () => this.openDialog("tags"),
          variant: "secondary",
        },
      ];
    },
    currentImages() {
      return this.gallery?.[this.current_view_page] || [];
    },
    sortOptions() {
      return [
        { label: this.$t("common.newest_first"), value: "-created_at" },
        { label: this.$t("common.oldest_first"), value: "created_at" },
      ];
    },
    pageSizeOptions() {
      return PAGE_SIZES.map((size) => ({ label: String(size), value: size }));
    },
    tagOptions() {
      return this.tags.map(({ label }) => ({ label, value: label }));
    },
    tagManagerActions() {
      return [
        {
          key: "remove",
          role: "danger",
          label: this.$t("gallery.remove_tag"),
          disabled: !this.selected_tags.length,
          onClick: () => this.askDeleteTags(),
        },
      ];
    },
    tagEditorActions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: () => this.closeDialog() },
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: () => this.saveImageTags() },
      ];
    },
    uploadActions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: () => this.closeDialog() },
        {
          key: "upload",
          role: "primary",
          label: this.$t("gallery.upload"),
          disabled: !this.file || this.uploading,
          onClick: () => this.upload_File({}),
        },
      ];
    },
  },
  methods: {
    thumbnailOf,
    openDialog(name) {
      this.selected_tags = [];
      this.new_tag_input = "";
      if (name === "upload") this.resetUpload();
      this.dialog = name;
    },
    closeDialog() {
      this.dialog = null;
      this.revokePreview();
    },
    revokePreview() {
      if (this.filePreview) URL.revokeObjectURL(this.filePreview);
      this.filePreview = null;
    },
    resetUpload() {
      this.file = null;
      this.revokePreview();
      this.meta = { alt: null, fileName: null };
    },
    toggleFilterTag({ slug }) {
      const index = this.filter_tags.indexOf(slug);
      if (index === -1) this.filter_tags.push(slug);
      else this.filter_tags.splice(index, 1);
      this.filterByTags();
    },
    resetFilter() {
      this.filter_tags = [];
      this.filterByTags();
    },
    reload({ sort = this.sort_by, limit = this.limit }) {
      this.gallery = null;
      this.gallery_pagination = null;
      this.current_view_page = 1;
      this.sort_by = sort;
      this.limit = limit;
      this.set_page({ page: 1, limit, sort });
    },
    setSort(sort) {
      this.reload({ sort });
    },
    setLimit(limit) {
      this.reload({ limit });
    },
    askDeleteImage({ uid }) {
      this.confirm = {
        title: this.$t("gallery.delete_photo"),
        message: this.$t("gallery.confirm_delete"),
        run: () => this.DELETE_Image({ url: `/images/${uid}/`, method: "delete" }),
      };
    },
    askDeleteTags() {
      this.confirm = {
        title: this.$t("gallery.remove_tag"),
        message: this.$t("gallery.confirm_delete_tags"),
        run: () => this.deleteSelectedTags(),
      };
    },
    // A deleted tag leaves the filter, so the grid never stays filtered by a chip that is gone.
    dropFilterTags(labels) {
      const gone = this.tags.filter((tag) => labels.includes(tag.label)).map((tag) => tag.slug);
      const kept = this.filter_tags.filter((slug) => !gone.includes(slug));
      if (kept.length === this.filter_tags.length) return;
      this.filter_tags = kept;
      this.filterByTags();
    },
    runConfirm() {
      const { run } = this.confirm;
      this.confirm = null;
      run();
    },
    openTagEditor(image) {
      this.openDialog("edit_tags");
      this.tag_img_uid = image.uid;
      this.edited_image_tags = [...(image.tags || [])];
      this.selected_tags = this.edited_image_tags.map((tag) => tag.label);
    },
    // The picked labels as tag objects: known tags first, the image's own tags cover a label the list lacks.
    pickedTags() {
      const known = new Map([...this.edited_image_tags, ...this.tags].map((tag) => [tag.label, tag]));
      return this.selected_tags.map((label) => known.get(label)).filter(Boolean);
    },
    saveImageTags() {
      this.edited_image_tags = this.pickedTags();
      this.addTagToImg();
      this.closeDialog();
    },
    init() {
      this.set_page({ page: this.current_view_page, limit: this.limit });
      this.GET_Tags({ url: `/image-tags/`, method: "get" });
    },
    async GET_gallery({
      url = null,
      method = null,
      page = 1,
      limit = 12,
      sort = "created_at",
      tags = null,
    }) {
      try {
        const { data: response } = await _METHOD_content({
          url,
          method,
          params: { page, limit, sort, tags },
        });

        return response;
      } catch (error) {}
    },
    async set_page({
      page = 1,
      limit = 12,
      sort = "created_at",
      reset = false,
    }) {
      const _content = this.gallery && !reset ? { ...this.gallery } : {};
      let _content_pagination =
        this.gallery_pagination && !reset ? { ...this.gallery_pagination } : {};

      if (reset || !_content[page]) {
        try {
          const { data: response, pagination = null } = await this.GET_gallery({
            url: "/images/",
            method: "get",
            page,
            sort: this.sort_by,
            limit,
            tags: this.filter_tags,
          });

          _content[page] = response.map((img) => ({
            ...img,
            set: img.set?.length
              ? img.set
              : [{ source: img.image, width: img.width, height: img.height }],
          }));
          _content_pagination = pagination;
        } catch (error) {
          console.log("EREOR", error);
          this.notify.spawnNotification({
            msg: this.$t("notifications.error"),
            type: "negative",
          });
        }
      }
      this.current_view_page = page;
      this.gallery = _content;
      this.gallery_pagination = _content_pagination;
    },
    async DELETE_Image({ url = null, method = null }) {
      try {
        const { data: response } = await _METHOD_content({
          method,
          url,
        });

        this.gallery = null;
        this.gallery_pagination = null;
        this.current_view_page = 1;
        this.set_page({ page: 1, limit: this.limit, reset: true });

        this.notify.spawnNotification({
          msg: this.$t("notifications.photo_deleted"),
          type: "positive",
        });
      } catch (error) {
        this.notify.spawnNotification({
          msg: this.$t("notifications.error"),
          type: "negative",
        });
      }
    },
    onDrop(event) {
      this.isDraggingOver = false;
      const file = event.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      this.loadFile(file);
    },
    async set_File() {
      const file = this.$refs.file.files[0];
      if (!file) return;
      this.loadFile(file);
    },
    async loadFile(file) {
      this.revokePreview();
      this.filePreview = URL.createObjectURL(file);
      this.file = await this.create_Base64Image(file);
      this.meta.fileName = file.name;
    },
    create_Base64Image(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });
    },
    async upload_File({ method = "post", url = "/images/" }) {
      if (this.uploading) return;
      this.uploading = true;
      try {
        if (this.file === null) throw new Error(`Photo missing`);

        const { data: response } = await _METHOD_content({
          method,
          url,
          type: "images",
          meta: this.meta,
          image: this.file,
          tags: this.selected_tags.map((tag) => {
            return { label: tag, slug: tag };
          }),
        });
        this.notify.spawnNotification({
          msg: this.$t("notifications.photo_uploaded"),
          type: "positive",
        });
        this.gallery = null;
        this.gallery_pagination = null;
        this.current_view_page = 1;
        this.set_page({ page: 1, limit: this.limit });
        // Only a success closes the dialog: a failed upload keeps the picked file, alt and tags for a retry.
        this.closeDialog();
      } catch (err) {
        if (err.message === "Photo missing") {
          this.notify.spawnNotification({
            msg: this.$t("notifications.error"),
            type: "negative",
          });
          return;
        }
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });
      } finally {
        this.uploading = false;
      }
    },
    async filterByTags() {
      this.set_page({ page: 1, limit: this.limit, reset: true });
    },
    async quickAddTag() {
      if (!this.new_tag_input) return;
      const label = this.new_tag_input;
      const slug = this.slugBuilder(label);
      try {
        const { data: response } = await _METHOD_content({
          url: "/image-tags/",
          method: "post",
          payload: { slug, label },
        });
        const { data } = response;
        this.tags = [data, ...this.tags];
        this.selected_tags.push(data.label);
        if (!this.edited_image_tags) this.edited_image_tags = [];
        this.edited_image_tags.push(data);
        this.new_tag_input = "";
        this.notify.spawnNotification({
          msg: this.$t("notifications.tag_added"),
          type: "positive",
        });
      } catch {
        this.notify.spawnNotification({
          msg: this.$t("notifications.error"),
          type: "negative",
        });
      }
    },
    addNewTag() {
      if (!this.new_tag_input) {
        return;
      }
      this.new_tag = {
        slug: this.new_tag_input,
        label: this.new_tag_input,
      };
      this.POST_Tag({
        url: "/image-tags/",
        method: "post",
        payload: this.new_tag,
      });
    },
    async addTagToImg() {
      try {
        const tags_to_send = this.edited_image_tags.map(({ slug, label }) => ({
          slug,
          label,
        }));
        await PUT_ImageTags({ uid: this.tag_img_uid, tags: tags_to_send });
        this.notify.spawnNotification({
          msg: this.$t("notifications.success"),
          type: "positive",
        });
        this.set_page({
          page: this.current_view_page,
          limit: this.limit,
          reset: true,
        });
      } catch (err) {
        console.error("[addTagToImg]", err);
        this.notify.spawnNotification({
          msg: this.$t("notifications.error"),
          type: "negative",
        });
      }
    },
    async deleteSelectedTags() {
      try {
        const response = this.selected_tags.map((it) =>
          DELETE_ImageTags({ slug: it })
        );

        const data = await Promise.allSettled(response);
        const errors = data.filter((res) => res.status === "rejected");
        if (errors.length) {
          const err = new Error();
          err.notify = {
            msg: this.$t("notifications.error"),
            count: errors.length,
          };
          throw err;
        }
        this.notify.spawnNotification({
          msg: this.$t("notifications.tag_deleted"),
          type: "positive",
        });
        this.dropFilterTags(this.selected_tags);
        this.GET_Tags({ url: `/image-tags/`, method: "get" });
        this.selected_tags = [];
      } catch ({ notify }) {
        if (notify) {
          this.notify.spawnNotification({
            msg: this.$t("notifications.error"),
            type: "negative",
          });
        }
      }
    },
    async GET_Tags({ url = null, method = null, limit = 999 }) {
      try {
        const { data: response } = await _METHOD_content({
          url,
          method,
          params: { limit },
        });
        const { data } = response;
        this.tags = data;
      } catch (error) {}
    },
    async POST_Tag({ url = null, method = null, payload = null }) {
      try {
        const { data: response } = await _METHOD_content({
          url,
          method,
          payload,
        });

        const { data, meta } = response;
        this.notify.spawnNotification({
          msg: this.$t("notifications.tag_added"),
          type: "positive",
        });
        this.tags = [data, ...this.tags];
        this.edit_tag = null;
        this.new_tag = null;
        this.new_tag_input = "";
      } catch (error) {
        console.log(error);
        this.notify.spawnNotification({
          msg: this.$t("notifications.error"),
          type: "negative",
        });
      }
    },
    async DELETE_Tage({ url = null, method = null }, _slug) {
      try {
        const { data: response } = await _METHOD_content({
          url,
          method,
        });

        this.notify.spawnNotification({
          msg: this.$t("notifications.tag_deleted"),
          type: "positive",
        });
        // this.tags = [data, ...this.tags];
        // this.edit_tag = null;
        // this.new_tag = null;
        // this.tags = this.tags.filter(({ slug }) => {
        //   return slug !== _slug;
        // });
      } catch (error) {
        console.log(error);
        this.notify.spawnNotification({
          msg: this.$t("notifications.error"),
          type: "negative",
        });
      }
    },
    slugBuilder(label) {
      return slugBuilder(label);
    },
  },

  created() {
    this.init();
  },
  mounted() {},
  components: {},
};
</script>
<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// Controls row (Figma S9): label, tag chips, then sort and page size; a phone stacks the label, scrolls the chips
// sideways in one row and splits the row between the two selects.
.gallery__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.gallery__label {
  font-size: var(--fs-200);
  font-weight: 500;
  color: var(--text-muted);
}

.gallery__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.gallery__selects {
  display: flex;
  gap: var(--space-2);
}

.gallery__select {
  width: 180px;
}

@include max-tablet {
  .gallery__label,
  .gallery__chips,
  .gallery__selects {
    flex: 1 0 100%;
    min-width: 0;
  }

  // The chips' 36 px touch area stays inside the scroll box.
  .gallery__chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-block: var(--space-1);
  }

  .gallery__select {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}

// R4: the grid is a container, so it keeps its border. MediaTile owns the tile size (188 wide, 150 on a phone, a square image).
// Fixed tracks (plan 29): 4 columns on a wide screen, 2 below it (4 × 188 overflows beside the sidebar up to 1279 px;
// no Figma frame there); a phone narrower than 393 px shrinks the tiles instead of scrolling sideways.
.gallery__grid {
  display: grid;
  grid-template-columns: repeat(4, 188px);
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-raised);

  @include max-desktop {
    grid-template-columns: repeat(2, 188px);
  }

  @include max-tablet {
    grid-template-columns: repeat(2, minmax(0, 150px));
  }
}

.gallery__pagination {
  margin-top: var(--space-5);
}

.gallery__preview {
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: var(--radius-base);
}

.gallery-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-8) var(--space-4);
  border: 2px dashed var(--border-default);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--accent);
    background: var(--surface-raised);
    outline: none;
  }

  &--dragover {
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
}
</style>
