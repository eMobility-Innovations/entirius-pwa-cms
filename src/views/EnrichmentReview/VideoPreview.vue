<template>
  <div class="video-preview flex-column gap-2" data-testid="video-preview">
    <template v-if="src">
      <video :src="src" controls preload="metadata" class="video-preview__video" data-testid="video-preview-player" />
      <BasicButton size="sm" class="video-preview__download" data-testid="video-preview-download" @click="download">
        {{ $t("enrichment.video.download") }}
      </BasicButton>
    </template>
    <span v-else-if="failed" class="fs-200 t-negative">{{ $t("enrichment.video.failed") }}</span>
    <span v-else class="fs-200 t-muted">{{ $t("enrichment.video.loading") }}</span>
  </div>
</template>

<script>
import { GET_StagedFile } from "@/api/enrichment/api";

// A video proposal (target_kind "video"): the staged file is admin-only, so it is fetched as a blob through the
// authenticated client and played from an objectURL (revoked on change and unmount), like ImageDiff's "after".
export default {
  name: "VideoPreview",
  props: {
    proposalId: { type: [Number, String], default: null },
  },
  data() {
    return { src: "", failed: false };
  },
  computed: {
    fileName() {
      return `proposal-${this.proposalId}.mp4`;
    },
  },
  watch: {
    proposalId: { immediate: true, handler: "load" },
  },
  beforeUnmount() {
    this.unmounted = true;
    this.revoke();
  },
  methods: {
    async load() {
      this.revoke();
      this.src = "";
      this.failed = false;
      const id = this.proposalId;
      if (id == null) return;
      try {
        const res = await GET_StagedFile(id);
        if (this.isStale(id)) return;
        this.src = URL.createObjectURL(res.data);
      } catch {
        if (!this.isStale(id)) this.failed = true;
      }
    },
    // A late response for an earlier proposal (or after unmount) is dropped, so no objectURL outlives its view.
    isStale(id) {
      return this.unmounted || id !== this.proposalId;
    },
    // The objectURL is ours (no server URL is bound to an href): a detached link saves it under a readable name.
    download() {
      const link = document.createElement("a");
      link.href = this.src;
      link.download = this.fileName;
      link.click();
    },
    revoke() {
      if (this.src) URL.revokeObjectURL(this.src);
    },
  },
};
</script>

<style lang="scss" scoped>
.video-preview {
  align-items: center;
}
// A product video is vertical (9:16): as large as the view allows, centred, never taller than the screen.
.video-preview__video {
  width: min(100%, 24rem, calc(70vh * 9 / 16));
  aspect-ratio: 9 / 16;
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  object-fit: contain;
}
</style>
