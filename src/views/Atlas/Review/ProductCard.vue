<template>
  <BasicCard class="review-product">
    <div class="review-product__hero flex ai-ct jc-ct bg-raised rounded" data-testid="product-card-hero">
      <img
        v-if="heroImage"
        :src="heroImage"
        :alt="product?.name || ''"
        class="review-product__image"
      />
      <FontAwesomeIcon v-else :icon="$icons.image" class="review-product__placeholder t-muted" />
    </div>
    <h2 class="fs-500 fw-600 mt-5" data-testid="product-card-name">
      {{ product?.name }}
    </h2>
    <div v-if="product?.ean" class="flex ai-ct gap-5 mt-2 flex-wrap">
      <span class="t-muted fs-200">EAN: {{ product.ean }}</span>
    </div>
    <div class="flex ai-ct gap-8 mt-5 flex-wrap">
      <span class="fs-400 fw-600 t-body">
        {{ formatCost(product?.cost, product?.currency) }}
      </span>
      <StatusBadge
        :label="$t('atlas.stock_count', { count: product?.stock ?? 0 })"
        :tone="(product?.stock ?? 0) > 0 ? 'positive' : 'negative'"
      />
    </div>
    <div class="flex ai-ct gap-5 mt-8 flex-wrap">
      <BasicButton
        v-if="extraImagesCount > 0"
        size="sm"
        data-testid="product-card-gallery-btn"
        @click="$emit('show-gallery')"
      >
        {{ $t("atlas.review.show_gallery") }} ({{ imagesCount }})
      </BasicButton>
      <a
        v-if="product?.url"
        :href="safeHref(product.url)"
        target="_blank"
        rel="noopener noreferrer"
        class="review-product__link inline-flex ai-ct gap-1 fs-200 t-accent"
        data-testid="product-card-supplier-url"
      >
        <FontAwesomeIcon :icon="$icons.link" />
        {{ $t("atlas.review.view_at_supplier") }}
      </a>
      <!-- Desktop shows the raw data in a side panel; a phone opens it in a dialog. -->
      <BasicButton
        size="sm"
        class="show-mobile"
        data-testid="product-card-raw-data-btn"
        @click="$emit('show-raw')"
      >
        {{ $t("atlas.review.show_raw_data") }}
      </BasicButton>
    </div>
  </BasicCard>
</template>

<script>
import { formatCost } from "@/utils/format";
import { safeHref } from "@/utils/safeHref";

export default {
  name: "ProductCard",
  props: {
    product: { type: Object, default: null },
  },
  emits: ["show-raw", "show-gallery"],
  methods: { formatCost, safeHref },
  computed: {
    images() {
      return Array.isArray(this.product?.image_urls) ? this.product.image_urls : [];
    },
    heroImage() {
      return this.images[0] || null;
    },
    imagesCount() {
      return this.images.length;
    },
    extraImagesCount() {
      return Math.max(0, this.images.length - 1);
    },
  },
};
</script>

<style lang="scss" scoped>
.review-product {
  max-width: 520px;
  margin: 0 auto;
}
.review-product__hero {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
}
.review-product__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.review-product__placeholder {
  font-size: var(--fs-700);
}
.review-product__link {
  text-decoration: none;
}
.review-product__link:hover {
  text-decoration: underline;
}
</style>
