<template>
  <div class="image-picker-thumb">
    <BasicButton
      class="image-picker-thumb__button jc-ct"
      :class="{ 'image-picker-thumb__button--dragover': dragActive }"
      :label="$t('lookup.box.drop_hint')"
      data-testid="dedup-search-dropzone"
      @click="$refs.fileInput.click()"
    >
      <img v-if="previewUrl" :src="previewUrl" :alt="altText" />
      <FontAwesomeIcon v-else :icon="$icons.upload" />
    </BasicButton>
    <IconButton
      v-if="previewUrl"
      class="image-picker-thumb__remove"
      icon="remove"
      :label="$t('lookup.box.remove_image')"
      variant="danger"
      size="sm"
      data-testid="dedup-search-remove-image"
      @click="$emit('remove')"
    />
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="image-picker-thumb__file-input"
      data-testid="dedup-search-file-input"
      @change="onChange"
    />
  </div>
</template>

<script>
export default {
  name: "ImagePickerThumb",
  props: {
    previewUrl: { type: String, default: "" },
    altText: { type: String, default: "" },
    // Highlight driven by the parent: the whole search box is the drop target
    // (DedupSearchBox owns the dragenter/leave bookkeeping), this thumb only
    // mirrors that state so the eye lands on where the photo will end up.
    dragActive: { type: Boolean, default: false },
  },
  emits: ["pick", "remove"],
  methods: {
    onChange(event) {
      const file = event.target.files?.[0];
      if (file) this.$emit("pick", file);
      event.target.value = "";
    },
  },
};
</script>

<style lang="scss" scoped>
.image-picker-thumb {
  position: relative;
  flex-shrink: 0;

  // BasicButton's variant rule (`button.button-basic.button-basic--secondary`, 0,3,1) outranks a plain scoped class:
  // the thumb's own colours need the root and the boot class in front.
  & button.button-basic.image-picker-thumb__button {
    width: 42px;
    height: 42px;
    padding: 0;
    border: 1px dashed var(--border-default);
    background: var(--surface-base);
    color: var(--text-muted);

    img {
      width: 40px;
      height: 40px;
      object-fit: cover;
    }
  }
  // Same tokens as ProductFiles.vue __dropzone--dragover, so a drag reads the
  // same here as it does on the PIM file and gallery upload areas.
  & button.button-basic.image-picker-thumb__button--dragover {
    border-color: var(--accent);
    background: var(--surface-raised);
    color: var(--text-accent);
  }
  // IconButton puts the class on its button, below the tooltip wrapper: out of reach of a scoped selector.
  :deep(.image-picker-thumb__remove) {
    position: absolute;
    top: -6px;
    right: -6px;
    border-radius: var(--radius-full);
    background: var(--surface-base);
  }
  &__file-input {
    display: none;
  }
}
</style>
