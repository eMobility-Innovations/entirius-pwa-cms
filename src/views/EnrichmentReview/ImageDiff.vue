<template>
  <div class="image-diff flex ai-st gap-5">
    <!-- Before = current main from PIM (public /media URL). -->
    <figure
      class="image-diff__pane image-diff__pane--before"
      data-testid="image-diff-before"
    >
      <figcaption class="image-diff__cap t-negative">
        {{ $t("enrichment.image.before") }}
      </figcaption>
      <img
        v-if="beforeUrl"
        :src="beforeUrl"
        :alt="alt"
        class="image-diff__img"
        data-testid="image-diff-before-img"
        @click="openGallery(beforeUrl)"
      />
      <span v-else class="image-diff__none t-muted">{{
        $t("enrichment.image.none")
      }}</span>
    </figure>

    <!-- After = staged binary (admin-only), fetched as a blob through the authed client. -->
    <figure
      class="image-diff__pane image-diff__pane--after"
      data-testid="image-diff-after"
    >
      <figcaption class="image-diff__cap t-positive">
        {{ $t("enrichment.image.after") }}
      </figcaption>
      <img
        v-if="afterSrc"
        :src="afterSrc"
        :alt="alt"
        class="image-diff__img"
        data-testid="image-diff-after-img"
        @click="openGallery(afterSrc)"
      />
      <span v-else-if="afterError" class="image-diff__none t-negative">
        {{ $t("enrichment.image.failed") }}
      </span>
      <span v-else class="image-diff__none t-muted">…</span>
    </figure>

    <GalleryModal
      :visible="galleryOpen"
      :images="galleryImages"
      :product-name="alt"
      @close="galleryOpen = false"
    />
  </div>
</template>

<script>
// Before/after picture diff for enrichment media proposals (etap-08). Reuses the suppliers
// GalleryModal for fullscreen. The "after" image is the staged binary served by an admin-only
// endpoint, so it is fetched as a blob and turned into an objectURL (an <img src> can't send the
// Bearer token). The objectURL is revoked on unmount/refetch to avoid leaks.
import GalleryModal from "@/views/Atlas/Review/GalleryModal.vue";
import { GET_StagedFile } from "@/api/enrichment/api";

export default {
  name: "ImageDiff",
  components: { GalleryModal },
  props: {
    beforeUrl: { type: String, default: "" },
    proposalId: { type: [Number, String], default: null },
    alt: { type: String, default: "" },
  },
  data() {
    return {
      afterSrc: "",
      afterError: false,
      galleryOpen: false,
      galleryImages: [],
    };
  },
  watch: {
    proposalId: { immediate: true, handler: "loadAfter" },
  },
  beforeUnmount() {
    this.revokeAfter();
  },
  methods: {
    async loadAfter() {
      this.revokeAfter();
      this.afterSrc = "";
      this.afterError = false;
      if (this.proposalId == null) return;
      try {
        const res = await GET_StagedFile(this.proposalId);
        this.afterSrc = URL.createObjectURL(res.data);
      } catch {
        this.afterError = true;
      }
    },
    revokeAfter() {
      if (this.afterSrc) URL.revokeObjectURL(this.afterSrc);
    },
    openGallery(src) {
      if (!src) return;
      this.galleryImages = [src];
      this.galleryOpen = true;
    },
  },
};
</script>

<style lang="scss" scoped>
.image-diff__pane {
  margin: 0;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: var(--space-2);
  border-left: 3px solid var(--border-subtle);
}
.image-diff__pane--before {
  border-left-color: var(--negative);
}
.image-diff__pane--after {
  border-left-color: var(--positive);
}
.image-diff__cap {
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
}
.image-diff__img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  cursor: pointer;
}
.image-diff__none {
  font-size: var(--fs-200);
}
</style>
