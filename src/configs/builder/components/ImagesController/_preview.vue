<template>
  <div class="image-controller-preview">
    <!-- <p>{{ value }}</p> -->

    <div class="flex gap-1 relative">
      <div class="flex gap-1">
        <div
          v-for="(v, k, i) in value"
          class="relative p-8 rounded b-default ov-h pointer shadow-down"
        >
          <img
            :src="resolveImageUrl(v.image)"
            class="block absolute absolute-ct"
            @mouseover="
              () => {
                image_scale = i;
                scale_src = resolveImageUrl(v.image);
              }
            "
            @error="(e) => (e.target.style.display = 'none')"
          />
          <span
            class="fs-200 absolute image-badge ph-1 bg-accent-fill t-on-accent-fill rounded"
          >
            {{ `${k}` }}
          </span>
        </div>
        <div
          v-if="scale_src"
          class="absolute scaled-image-preview rounded b-default bg-base shadow-down"
          @mouseleave="
            () => {
              image_scale = null;
              scale_src = null;
            }
          "
        >
          <img
            :src="scale_src"
            alt=""
            class="block absolute absolute-ct"
            @error="(e) => (e.target.style.display = 'none')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      image_scale: null,
      scale_src: null,
    };
  },
  methods: {
    resolveImageUrl(url) {
      if (!url) return "";
      if (url.startsWith("http")) return url;
      return (process.env.VUE_APP_API_URL || "") + url;
    },
  },
};
</script>

<style>
.image-controller-preview {
  .image-badge {
    bottom: 2px;

    right: 0;
    z-index: 1;
    font-size: var(--fs-100);
  }
  .scaled-image-preview {
    left: 0;
    top: 0;
    width: 15rem;
    height: 15rem;
    z-index: 2;
  }
}
</style>
