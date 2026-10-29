<template>
  <div class="staged-image" :class="{ 'staged-image--loading': !src && !failed }" data-testid="staged-image">
    <img v-if="src" :src="src" :alt="alt" class="staged-image__img" />
    <p v-else-if="failed" class="staged-image__failed m-0 fs-250" role="status">{{ $t("enrichment.studio.cover.image_failed") }}</p>
    <span v-else class="visually-hidden" role="status">{{ $t("enrichment.studio.cover.image_loading") }}</span>
  </div>
</template>

<script>
import { GET_StagedFile } from "@/api/enrichment/api";

// A proposal's staged image (admin-only, so fetched as a blob and shown through an object URL; revoked on change and
// unmount) in a 16:9 frame: a pulsing frame while it loads, a short note when it cannot be read. `variant` picks one
// image of a cover step. The loaded URL goes up as `loaded` (the enlarged view reuses it); `missing` when it is gone.
export default {
  name: "StagedImage",
  props: {
    proposalId: { type: [Number, String], required: true },
    variant: { type: Number, default: null },
    alt: { type: String, default: "" },
  },
  emits: ["loaded", "missing"],
  data() {
    return { src: "", failed: false };
  },
  computed: {
    source() {
      return `${this.proposalId}:${this.variant ?? ""}`;
    },
  },
  watch: {
    source: { immediate: true, handler: "load" },
  },
  beforeUnmount() {
    this.revoke();
  },
  methods: {
    async load() {
      const source = this.source;
      this.revoke();
      this.src = "";
      this.failed = false;
      try {
        const { data } = await GET_StagedFile(this.proposalId, this.variant);
        if (source !== this.source) return;
        this.src = URL.createObjectURL(data);
        this.$emit("loaded", this.src);
      } catch {
        if (source !== this.source) return;
        this.failed = true;
        this.$emit("missing");
      }
    },
    revoke() {
      if (this.src) URL.revokeObjectURL(this.src);
    },
  },
};
</script>

<style lang="scss" scoped>
.staged-image {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-base);
  background: var(--surface-raised);
}
.staged-image--loading {
  animation: staged-image-pulse 1.6s ease-in-out infinite;
}
@keyframes staged-image-pulse {
  50% {
    opacity: 0.5;
  }
}
@media (prefers-reduced-motion: reduce) {
  .staged-image--loading {
    animation: none;
  }
}
.staged-image__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.staged-image__failed {
  padding: var(--space-3);
  color: var(--text-secondary);
  text-align: center;
}
</style>
