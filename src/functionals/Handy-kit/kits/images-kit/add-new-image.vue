<template>
  <div>
    <div class="flex jc-sb ai-ct mb-md">
      <label for="file" ref="fileInput">
        <BasicButton size="sm" @click="$refs.fileInput.click()">
          {{ $t("images.add_photo") }}
        </BasicButton>
      </label>
      <p v-if="file" v-text="meta.fileName" />
      <input
        type="file"
        name="file"
        id="file"
        class="input-file"
        ref="file"
        @change="setFile"
      />
    </div>
    <img
      v-if="filePreview"
      :src="filePreview"
      alt=""
      class="input-file__preview mb-nm"
    />
    <FormField v-if="filePreview" :label="'Alt text'">
      <BasicInput
        class="size-sm"
        v-model="meta.alt"
      />
    </FormField>
    <BasicButton v-if="filePreview" variant="primary" class="w-full sticky-btn mt-md" @click="uploadFile">
      {{ $t("gallery.upload") }}
    </BasicButton>
  </div>
</template>

<script>
import { POST_Image, GET_ImageTags, POST_ImageTags } from "@/api/contentDB/api";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";

export default {
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      file: null,
      filePreview: null,
      tags: null,
      newTag: "",
      newFileTags: [],
      meta: {
        alt: null,
        fileName: null,
      },
    };
  },
  methods: {
    async setFile() {
      const file = this.$refs.file.files[0];

      this.filePreview = URL.createObjectURL(this.$refs.file.files[0]);
      this.file = await this.createBase64Image(file);
      this.meta.fileName = file.name;
    },
    createBase64Image(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });
    },
    async uploadFile() {
      try {
        this.loader.handyLoaderStart();
        if (this.file === null) throw new Error(`Photo missing`);
        const {
          data: { data, meta },
        } = await POST_Image({
          type: "images",
          tags: this.newFileTags,
          meta: this.meta,
          image: this.file,
        });
        this.notify.spawnNotification({
          msg: this.$t("notifications.success"),
          type: "positive",
        });
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
        this.loader.handyLoaderFinish();
      }
    },
    async getTags() {
      try {
        this.loader.handyLoaderStart();
        const {
          data: {
            data = [],
            meta: { status },
          },
        } = await GET_ImageTags({});
        this.tags = data;
      } catch (error) {
      } finally {
        this.loader.handyLoaderFinish();
      }
    },
    handleFileTag(tag) {
      this.newFileTags.some((fileTag) => fileTag.slug === tag.slug)
        ? this.deleteFileTag(tag)
        : this.addFileTag(tag);
    },
    addFileTag(tag) {
      this.newFileTags.push(tag);
    },
    deleteFileTag(tag) {
      this.newFileTags = this.newFileTags.filter(
        (fileTag) => fileTag.slug !== tag.slug
      );
    },
  },
  async created() {
    this.getTags();
  },
};
</script>

<style lang="scss">
.input-file {
  display: none;
  &__preview {
    border: 1px solid var(--border-default);
  }
}
</style>
