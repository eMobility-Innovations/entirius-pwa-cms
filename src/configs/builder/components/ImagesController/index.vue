<template>
  <div class="images-controller t-body bg-base">
    <p class="mb-2" v-if="label">{{ label }}</p>
    <div class="flex gap-2">
      <BasicButton
        variant="secondary"
        class="rounded"
        @click="
          () => {
            init();
          }
        "
      >
        {{ $t('routes.set_new') }}
      </BasicButton>
      <BasicSelect
        :floating-label="`${$t('controllers.set_items')} (${Object.keys(value ?? {}).length})`"
        v-model="picked_image"
        class="fg-1"
        :disabled="!Boolean(value)"
        :options="
          Object.entries(value ?? {}).map((entry) => {
            const [key, v] = entry;
            return {
              label: `${v.meta.fileName} (${key}) | ${v.width}px/${v.height}px`,
              value: entry,
            };
          })
        "
      />
      <IconButton
        v-if="picked_image"
        icon="delete"
        variant="danger"
        :label="$t('common.delete')"
        @click="
          remove_picture({ key: 'source', value: picked_image });
          picked_image = null;
        "
      />
    </div>

    <div
      v-if="mode === 'gallery'"
      class="gallery-modal t-body flex flex-column ov-h rounded ov-h"
    >
      <nav
        class="grid grid-col-2 grid-col-2-m bg-raised t-secondary fs-300 pl-10 pr-10 pt-5 pb-5"
      >
        <p class="fs-400 fw-600 uppercase">{{ $t("images.library") }}</p>
        <p class="js-fe" @click="mode = null">
          <FontAwesomeIcon :icon="$icons.close" class="pointer" />
        </p>
      </nav>
      <div class="pl-10 pr-10 pt-8 pb-8 fg-1 relative bg-base flex flex-column ov-h">
        <div class="flex ai-ct jc-sb pb-2 shadow-down">
          <Pagination
            v-if="pagination"
            :nav_size="32"
            :page="pagination.page"
            :pages="pagination.pages"
            @update:page="
              ($event) => {
                selected_asset = null;
                GET_Images({ limit, page: $event });
              }
            "
          />
          <div class="flex gap-1">
            <BasicSelect
              :floating-label="$t('common.sort_by')"
              :options="[
                { label: $t('common.oldest_first'), value: 'created_at' },
                { label: $t('common.newest_first'), value: '-created_at' },
              ]"
              :model-value="sort_by"
              @update:model-value="
                ($event) => {
                  sort_by = $event;
                  GET_Images({ limit, page });
                }
              "
            />
            <BasicSelect
              :floating-label="$t('gallery.page_size')"
              :options="[
                { label: 10, value: 10 },
                { label: 20, value: 20 },
                { label: 30, value: 30 },
              ]"
              :model-value="limit"
              @update:model-value="
                ($event) => {
                  gallery = null;
                  selected_asset = null;
                  limit = $event;
                  GET_Images({ limit: $event });
                }
              "
            />
          </div>
        </div>
        <div class="flex wrap ai-ct gap-1 pv-2">
          <p class="fs-200 t-muted">{{ $t("gallery.filter_by_tag") }}</p>
          <p
            v-for="(t, idx) in tags"
            :key="`t-${idx}`"
            class="ic-tag-chip pointer"
            :class="[isTagSelected(t) ? 'ic-tag-chip--active' : '']"
            @click="
              () => {
                const index = selected_tags.indexOf(t.slug);
                if (index === -1) {
                  selected_tags.push(t.slug);
                } else {
                  selected_tags.splice(index, 1);
                }
                filterByTags();
              }
            "
          >
            {{ t.label }}
          </p>
          <button
            v-if="selected_tags.length"
            class="ic-tag-chip pointer flex ai-ct jc-ct"
            @click="
              () => {
                selected_tags = [];
                filterByTags();
              }
            "
          >
            <FontAwesomeIcon :icon="$icons.close" />
          </button>
        </div>
        <div class="grid grid-col-5 gap-2 relative pv-2 fg-1 ovy-auto" style="min-height: 0">
          <div
            v-for="(g, i) in gallery"
            @click="selected_asset = i"
            class="ic-gallery-card bg-base relative grid-square pointer rounded"
            :class="{ 'ic-gallery-card--selected': selected_asset === i }"
          >
            <BasicTooltip
              :text="g.meta && g.meta.fileName ? g.meta.fileName : 'No title'"
              class="absolute absolute-ct w-100 h-100"
            >
              <div class="absolute absolute-ct w-100 h-100 ov-h">
                <img
                  v-if="g._thumbSrc && !g._thumbFailed"
                  :src="g._thumbSrc"
                  :alt="g.meta && g.meta.fileName ? g.meta.fileName : ''"
                  class="absolute absolute-ct w-100"
                  style="object-fit: cover; height: 100%"
                  @error="g._thumbFailed = true"
                />
                <div
                  v-if="!g._thumbSrc || g._thumbFailed"
                  class="ic-gallery-fallback"
                >
                  <FontAwesomeIcon :icon="$icons.image" class="ic-gallery-fallback__icon" />
                  <span class="ic-gallery-fallback__name">{{
                    g.meta && g.meta.fileName
                      ? g.meta.fileName
                      : "No preview"
                  }}</span>
                </div>
              </div>
            </BasicTooltip>
            <div v-if="selected_asset === i" class="ic-gallery-check">
              <FontAwesomeIcon :icon="$icons.success" />
            </div>
          </div>
        </div>
        <div class="flex jc-sb ai-ct">
          <BasicButton
            variant="secondary"
            class="rounded fs-200 jc-ct"
            @click="mode = 'new-picture'"
          >
            {{ $t('images.add_photo') }}
          </BasicButton>
          <div class="flex ai-ct gap-2">
            <div class="flex gap-1">
              <button
                class="ic-device-chip pointer"
                :class="{ 'ic-device-chip--active': set_mobile }"
                @click="set_mobile = !set_mobile"
              >
                <FontAwesomeIcon
                  v-if="set_mobile"
                  :icon="$icons.success"
                  class="ic-device-chip__icon"
                />
                {{ $t("images.mobile") }}
              </button>
              <button
                class="ic-device-chip pointer"
                :class="{ 'ic-device-chip--active': set_desktop }"
                @click="set_desktop = !set_desktop"
              >
                <FontAwesomeIcon
                  v-if="set_desktop"
                  :icon="$icons.success"
                  class="ic-device-chip__icon"
                />
                {{ $t("images.desktop") }}
              </button>
            </div>
            <BasicButton
              variant="primary"
              class="rounded fs-200 shadow-down jc-ct"
              :disabled="!canAccept"
              @click="handleAccept"
            >
              {{ $t('common.accept') }}
            </BasicButton>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="mode === 'new-picture'"
      class="gallery-modal t-body flex flex-column ov-h rounded"
    >
      <nav
        class="flex bg-raised t-secondary fs-300 pl-10 pr-10 pt-5 pb-5"
      >
        <p class="mr-2 pointer" @click="mode = 'gallery'">
          <FontAwesomeIcon :icon="$icons.back" />
        </p>
        <p class="fw-600 uppercase">{{ $t("images.new_photo") }}</p>
      </nav>
      <div class="pl-10 pr-10 bg-base fg-1 ovy-auto pt-10 pb-10">
        <div
          class="ic-dropzone"
          :class="{ 'ic-dropzone--dragover': isDraggingOver }"
          @click="$refs.file.click()"
          @dragover.prevent="isDraggingOver = true"
          @dragleave="isDraggingOver = false"
          @drop.prevent="onDrop"
        >
          <FontAwesomeIcon :icon="$icons.upload" class="t-muted fs-500" />
          <span class="t-muted fs-200">{{ $t('gallery.drop_files_here') }}</span>
          <span class="t-muted fs-200">{{ $t('gallery.or_click_to_browse') }}</span>
        </div>
        <input
          type="file"
          ref="file"
          class="sr-only"
          accept="image/*"
          @change="set_File"
        />

        <div v-if="filePreview" class="mt-8">
          <BasicCard>
          <div class="grid grid-col-2 gap-10">
            <img :src="filePreview" alt="" style="max-width: 100%; border-radius: var(--radius-base)" />
            <div class="flex-column gap-5 ai-fs">
              <FormField :label="'alt'">
                <BasicInput
                  class="bg-base rounded t-secondary lh-base-elem"
                  v-model="meta.alt"
                />
              </FormField>
              <p class="fs-200 t-secondary mt-2">
                {{ $t("images.choose_tags") }}
              </p>
              <div class="flex wrap gap-1">
                <p
                  v-for="tag in tags"
                  :key="tag.slug"
                  class="ic-tag-chip pointer"
                  :class="[isTagSelected(tag) ? 'ic-tag-chip--active' : '']"
                  @click="
                    () => {
                      const index = selected_tags.indexOf(tag.label);
                      if (index === -1) {
                        selected_tags.push(tag.label);
                      } else {
                        selected_tags.splice(index, 1);
                      }
                    }
                  "
                >
                  {{ tag.label }}
                </p>
              </div>
              <BasicButton
                @click="upload_File({})"
                variant="primary"
                class="rounded jc-ct"
              >
                {{ $t('gallery.upload') }}
              </BasicButton>
            </div>
          </div>
          </BasicCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { _METHOD_content } from "@/api/contentDB/api";
import { useNotifyStore } from "@/stores/notify";
export default {
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  props: {
    label: {
      type: [Boolean, String],
      default: null,
    },
    value: {
      type: [Boolean, Object],
      default: null,
    },
  },
  data() {
    return {
      loading: false,
      mode: null,

      //
      gallery: null,
      pagination: null,
      page: 1,
      limit: 20,
      sort_by: "-created_at",
      //
      selected_asset: null,
      picked_image: null,
      set_mobile: true,
      set_desktop: true,

      // new picture
      file: null,
      filePreview: null,
      isDraggingOver: false,
      tags: [],
      newTag: "",
      newFileTags: [],
      selected_tags: [],
      meta: {
        alt: null,
        fileName: null,
      },
    };
  },
  computed: {
    canAccept() {
      return (
        this.selected_asset !== null && (this.set_mobile || this.set_desktop)
      );
    },
  },
  methods: {
    async init() {
      //if (!this.value) {
      this.mode = "gallery";
      await this.GET_Images({});
      this.GET_Tags({ url: `/image-tags/`, method: "get" });

      //}
    },
    isTagSelected(currentTag) {
      return this.selected_tags.includes(currentTag.label);
    },
    async GET_Images({
      method = "get",
      url = "/images/",
      page = 1,
      limit = 10,
      tags = null,
    }) {
      try {
        this.loading = true;
        const { data: response } = await _METHOD_content({
          method,
          url,
          params: {
            page,
            limit: this.limit,
            sort: this.sort_by,
            tags,
          },
        });

        const { data = [], pagination = {} } = response;

        this.gallery = data.map((img) => {
          const set = img.set?.length
            ? img.set
            : [{ source: img.image, width: img.width, height: img.height }];
          return {
            ...img,
            set,
            _thumbSrc: set[0]?.source || img.image || null,
            _thumbFailed: false,
          };
        });

        this.pagination = pagination;
      } catch (error) {
        console.log("error", error);
      } finally {
        this.loading = false;
      }
    },
    handleAccept() {
      if (!this.canAccept) return;
      const asset = this.gallery.at(this.selected_asset);
      const _value = this.value ? { ...this.value } : {};
      if (this.set_mobile) _value["mobile"] = asset;
      if (this.set_desktop) _value["desktop"] = asset;
      this.$emit("onChange", _value);
      this.selected_asset = null;
      this.set_mobile = true;
      this.set_desktop = true;
      this.mode = null;
    },
    set_image({ type = null, asset = null }) {
      if (![type, asset].every(Boolean)) return;
      const _value = this.value ? { ...this.value } : {};
      _value[type] = asset;
      this.$emit("onChange", _value);
      this.selected_asset = null;
      this.set_mobile = true;
      this.set_desktop = true;
      this.mode = null;
    },
    remove_picture({ value = null }) {
      const _setted_value = this.value ? { ...this.value } : {};

      const [key, _values] = value;
      delete _setted_value[key];

      this.$emit(
        "onChange",
        Object.keys(_setted_value).length ? _setted_value : null
      );
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
      try {
        if (this.file === null) throw new Error(`Photo missing`);
        const {
          data: { data, meta },
        } = await _METHOD_content({
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
          msg: this.$t("notifications.success"),
          type: "positive",
        });
        this.init();
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
          msg: this.$t("notifications.save_error"),
          type: "negative",
        });
      } finally {
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
    async filterByTags() {
      this.GET_Images({
        page: 1,
        limit: this.limit,
        reset: true,
        tags: this.selected_tags,
      });
    },
  },
  // created() {
  //   this.init();
  // },
};
</script>

<style lang="scss" scoped>
.gallery-modal {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
}

.ic-gallery-card {
  border: 2px solid var(--border-default);
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--border-strong);
  }

  // The selection ring is its own layer, not an outline: a focus outline never replaces it and it follows the radius.
  &--selected {
    border-color: var(--accent);
  }

  &--selected::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 1px solid var(--focus-ring);
    border-radius: inherit;
    pointer-events: none;
  }
}

.ic-gallery-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-500);
  color: var(--text-accent);
  background: var(--surface-base);
  border-radius: var(--radius-full);
  z-index: 1;
  pointer-events: none;
}

.ic-device-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 30px;
  padding: 0 var(--space-2);
  font-size: var(--fs-200);
  font-weight: 500;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  transition: all 0.15s ease;
  text-decoration: line-through;

  &--active {
    border-color: var(--accent);
    color: var(--text-body);
    text-decoration: none;
  }

  &__icon {
    font-size: var(--fs-300);
    color: var(--text-accent);
  }
}

.ic-dropzone {
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

  &:hover {
    border-color: var(--accent);
    background: var(--surface-raised);
  }

  &--dragover {
    border-color: var(--accent);
    background: var(--accent-subtle);
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
  border: 0;
}

.ic-gallery-fallback {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  background: var(--surface-raised);

  &__icon {
    font-size: var(--fs-500);
    color: var(--text-muted);
  }

  &__name {
    font-size: var(--fs-200);
    color: var(--text-muted);
    text-align: center;
    padding: 0 var(--space-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
}

.ic-tag-chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 var(--space-2);
  font-size: var(--fs-200);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--surface-base);
  color: var(--text-body);
  transition: background-color 0.15s ease, border-color 0.15s ease;
  user-select: none;

  &:hover {
    background: var(--surface-raised);
  }

  &--active {
    background: var(--accent-fill);
    border-color: var(--accent);
    color: var(--text-strong);

    &:hover {
      background: var(--accent-fill);
    }
  }
}
</style>
