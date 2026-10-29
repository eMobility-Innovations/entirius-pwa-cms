<template>
  <BasicModal :open="visible" size="lg" @close="$emit('close')">
    <template #title>
      <h2>
        {{ $t("atlas.review.gallery_title") }}
        <span class="t-muted fw-400">({{ images.length }})</span>
      </h2>
    </template>

    <div class="flex-column gap-4" data-testid="gallery-modal">
      <div class="gallery-stage flex ai-ct jc-ct bg-raised rounded">
        <img
          v-if="activeImage"
          :src="activeImage"
          :alt="productName"
          class="gallery-stage__image"
        />
      </div>

      <div v-if="images.length > 1" class="flex ai-ct jc-ct gap-4">
        <IconButton
          icon="prev"
          variant="outline"
          :label="$t('atlas.review.gallery_prev')"
          data-testid="gallery-modal-prev"
          @click="prev"
        />
        <div class="gallery-picker">
          <ReadonlyOff>
            <BasicSelect
              v-model="activeIndex"
              :options="imageOptions"
              :aria-label="$t('atlas.review.gallery_jump')"
              data-testid="gallery-modal-counter"
            />
          </ReadonlyOff>
        </div>
        <IconButton
          icon="next"
          variant="outline"
          :label="$t('atlas.review.gallery_next')"
          data-testid="gallery-modal-next"
          @click="next"
        />
      </div>
    </div>
  </BasicModal>
</template>

<script>
import { ReadonlyOff } from "@/composables/useReadonly";
// Product images in a BasicModal (Esc, backdrop and focus from the boot); ←/→ and prev/next move between images
// while it is open, the "N / M" select jumps to image N.
export default {
  name: "GalleryModal",
  components: { ReadonlyOff },
  props: {
    visible: { type: Boolean, default: false },
    images: { type: Array, default: () => [] },
    productName: { type: String, default: "" },
  },
  emits: ["close"],
  data() {
    return { activeIndex: 0 };
  },
  computed: {
    activeImage() {
      return this.images[this.activeIndex] || null;
    },
    imageOptions() {
      return this.images.map((_, i) => ({ value: i, label: `${i + 1} / ${this.images.length}` }));
    },
  },
  watch: {
    visible(open) {
      if (open) {
        this.activeIndex = 0;
        document.addEventListener("keydown", this.onKey);
      } else {
        document.removeEventListener("keydown", this.onKey);
      }
    },
    images() {
      this.activeIndex = 0;
    },
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this.onKey);
  },
  methods: {
    prev() {
      if (this.images.length === 0) return;
      this.activeIndex = (this.activeIndex - 1 + this.images.length) % this.images.length;
    },
    next() {
      if (this.images.length === 0) return;
      this.activeIndex = (this.activeIndex + 1) % this.images.length;
    },
    onKey(e) {
      if (e.key === "ArrowLeft") this.prev();
      else if (e.key === "ArrowRight") this.next();
    },
  },
};
</script>

<style lang="scss" scoped>
.gallery-stage {
  min-height: 0;
  overflow: hidden;
}

.gallery-picker {
  width: 7rem;
}

.gallery-stage__image {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
}
</style>
