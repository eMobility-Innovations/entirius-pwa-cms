<template>
  <div
    class="dedup-search-box"
    :class="{
      'dedup-search-box--inline': inline,
      'dedup-search-box--dragover': isDragging,
    }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="dedup-search-box__row">
      <BasicInput
        v-model="q"
        :maxlength="500"
        :placeholder="$t('lookup.box.placeholder')"
        class="dedup-search-box__input"
        data-testid="dedup-search-input"
        @onKeyDown="search"
        @paste="onPaste"
      />
      <ImagePickerThumb
        :preview-url="previewUrl"
        :alt-text="q"
        :drag-active="isDragging"
        @pick="setImage"
        @remove="removeImage"
      />
      <BasicButton
        variant="primary"
        :disabled="loading || !canSearch"
        data-testid="dedup-search-submit"
        @click="search"
      >
        {{ $t('lookup.box.search_button') }}
      </BasicButton>
    </div>

    <!-- Directly under the picker it describes, not stranded in the filter row. -->
    <span
      class="dedup-search-box__hint fs-200"
      :class="isDragging ? 't-accent' : 't-muted'"
      data-testid="dedup-search-drop-hint"
    >
      {{
        isDragging ? $t("lookup.box.drop_active") : $t("lookup.box.drop_hint")
      }}
    </span>

    <div class="dedup-search-box__scope">
      <FilterChip
        v-for="opt in scopeOptions"
        :key="opt.value"
        :label="$t(opt.labelKey)"
        :active="activeScope.includes(opt.value)"
        :data-testid="`dedup-search-scope-${opt.value}`"
        @click="toggleScope(opt.value)"
      />
    </div>

    <p
      v-if="displayError"
      class="dedup-search-box__error fs-200 t-negative"
    >
      {{ displayError }}
    </p>
  </div>
</template>

<script>
import { computed } from "vue";
import { POST_LookupSearch } from "@/api/lookup/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useImagePicker } from "@/composables/useImagePicker";
import { buildLookupPayload } from "@/utils/lookupPayload";
import ImagePickerThumb from "./ImagePickerThumb.vue";

const SCOPE_OPTIONS = [
  { value: "pim_product", labelKey: "lookup.box.scope_pim" },
  { value: "atlas_source_product", labelKey: "lookup.box.scope_atlas" },
];

export default {
  name: "DedupSearchBox",
  components: { ImagePickerThumb },
  props: {
    scope: {
      type: Array,
      default: () => ["pim_product", "atlas_source_product"],
    },
    inline: { type: Boolean, default: false },
    initialQuery: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    // Already-downscaled Blob restoring an earlier pick (Find after back-navigation).
    initialImage: { type: Object, default: null },
  },
  emits: ["results", "error"],
  setup(props) {
    return {
      ...useImagePicker(computed(() => props.imageUrl), props.initialImage),
      scopeOptions: SCOPE_OPTIONS,
    };
  },
  data() {
    return {
      q: this.initialQuery,
      activeScope: [...this.scope],
      loading: false,
      error: "",
      // Depth counter, not a boolean: dragging across the input, the chips or the
      // thumb fires dragleave on the element being left before dragenter on the one
      // being entered, so a boolean would flicker off over every child. ProductFiles
      // gets away with a boolean because its dropzone label has no real children.
      dragDepth: 0,
    };
  },
  computed: {
    isDragging() {
      return this.dragDepth > 0;
    },
    canSearch() {
      return !!this.q.trim() || !!this.previewUrl;
    },
    displayError() {
      return this.error || (this.imageError ? this.$t(this.imageError) : "");
    },
  },
  methods: {
    // Only a file drag concerns us — dragging selected text or a link over the box
    // must not light it up, and must not have its drop swallowed.
    dragCarriesFiles(event) {
      const types = event.dataTransfer?.types;
      return !!types && Array.from(types).includes("Files");
    },
    onDragEnter(event) {
      if (!this.dragCarriesFiles(event)) return;
      this.dragDepth += 1;
    },
    onDragOver(event) {
      if (!this.dragCarriesFiles(event)) return;
      // Without preventDefault the browser treats the box as an invalid target and
      // never fires drop at all — this is what made the old hint a lie.
      event.preventDefault();
      if (this.dragDepth === 0) this.dragDepth = 1;
    },
    onDragLeave(event) {
      if (!this.dragCarriesFiles(event)) return;
      this.dragDepth = Math.max(0, this.dragDepth - 1);
    },
    onDrop(event) {
      if (!this.dragCarriesFiles(event)) return;
      event.preventDefault();
      this.dragDepth = 0;
      const file = event.dataTransfer.files?.[0];
      if (file) this.setImage(file);
    },
    toggleScope(value) {
      const has = this.activeScope.includes(value);
      if (has && this.activeScope.length === 1) return; // keep at least one catalog
      this.activeScope = has
        ? this.activeScope.filter((v) => v !== value)
        : [...this.activeScope, value];
    },
    async search() {
      if (!this.canSearch || this.loading) return;
      this.loading = true;
      this.error = "";
      const payload = buildLookupPayload({
        scope: this.activeScope,
        q: this.q,
        imageBlob: this.imageBlob,
        imageUrl: this.imageUrl,
        imageRemoved: this.imageRemoved,
      });
      try {
        const { data } = await POST_LookupSearch(payload);
        this.$emit("results", {
          ...data,
          hits: data.hits || [],
          q: this.q,
          // Mirrors buildLookupPayload: whether the request carried a picture.
          hasImage: !!this.imageBlob || (!this.imageRemoved && !!this.imageUrl),
          // What the caller needs to restore this exact search later (Find keeps
          // the last one in the lookupFind store to survive back-navigation).
          scope: [...this.activeScope],
          imageBlob: this.imageBlob,
        });
      } catch (err) {
        this.error = extractApiMessage(err, this.$t("notifications.error"));
        this.$emit("error", this.error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.dedup-search-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  // Transparent by default so the box does not shift by 2px the moment a drag starts.
  border: 1px dashed transparent;
  border-radius: var(--radius-base);
  padding: var(--space-2);
  transition: border-color 0.12s ease, background 0.12s ease;

  // Same tokens as ProductFiles.vue / MediaGallery.vue / Gallery.vue dropzones.
  &--dragover {
    border-color: var(--accent);
    background: var(--surface-raised);
  }

  &__row,
  &__scope {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }
  // A phone gives the query its own full-width row; the photo picker and Search wrap under it.
  &__row {
    @include max-tablet {
      flex-wrap: wrap;
    }
  }
  &__input {
    flex: 1;

    @include max-tablet {
      flex-basis: 100%;
    }
  }
  &__hint,
  &__error {
    margin: 0;
  }
}
</style>
