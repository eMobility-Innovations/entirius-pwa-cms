<template>
  <!-- Flat inside the preview drawer: the drawer is the frame and holds the dialog's heading, the name is plain text. -->
  <BasicCard class="product-preview" :flat="flat" :title="product && !loading && !flat ? productName : ''">
    <template v-if="product && !loading" #actions>
      <BasicButton
        variant="secondary"
        data-testid="enrichment-preview-go-pim"
        @click="goToPim"
      >
        {{ $t("enrichment.preview.go_to_pim") }}
      </BasicButton>
    </template>

    <Loader v-show="loading" />

    <template v-if="!loading && product">
      <p v-if="flat" class="product-preview__name fs-400 fw-600 t-strong">{{ productName }}</p>
      <div class="product-preview__hero">
        <img
          v-if="heroUrl"
          :src="heroUrl"
          :alt="product.name || sku"
          class="product-preview__img"
        />
        <div v-else class="product-preview__img product-preview__img--ph">
          <FontAwesomeIcon :icon="$icons.image" />
        </div>
      </div>

      <dl class="product-preview__meta">
        <div class="product-preview__row">
          <dt>{{ $t("enrichment.preview.sku") }}</dt>
          <dd>{{ sku }}</dd>
        </div>
        <div v-if="product.ean" class="product-preview__row">
          <dt>{{ $t("enrichment.preview.ean") }}</dt>
          <dd>{{ product.ean }}</dd>
        </div>
        <div v-if="product.product_class_name" class="product-preview__row">
          <dt>{{ $t("enrichment.preview.class") }}</dt>
          <dd>{{ productType }}</dd>
        </div>
        <div class="product-preview__row">
          <dt>{{ $t("enrichment.preview.status") }}</dt>
          <dd>
            <StatusBadge
              :label="
                product.is_enabled
                  ? $t('enrichment.preview.enabled')
                  : $t('enrichment.preview.disabled')
              "
              :tone="product.is_enabled ? 'positive' : 'neutral'"
            />
          </dd>
        </div>
        <div v-if="product.visibility_name" class="product-preview__row">
          <dt>{{ $t("enrichment.preview.visibility") }}</dt>
          <dd>{{ product.visibility_name }}</dd>
        </div>
        <div v-if="product.feature_set_idx" class="product-preview__row">
          <dt>{{ $t("enrichment.preview.feature_set") }}</dt>
          <dd>{{ product.feature_set_idx }}</dd>
        </div>
        <div v-if="product.gap_count != null" class="product-preview__row">
          <dt>{{ $t("enrichment.preview.gaps") }}</dt>
          <dd>
            <StatusBadge
              :label="String(product.gap_count)"
              :tone="product.gap_count > 0 ? 'warning' : 'positive'"
            />
          </dd>
        </div>
      </dl>
    </template>

    <EmptyState
      v-if="!loading && !product"
      icon="warning"
      :title="$t('enrichment.preview.not_found')"
      :message="sku || ''"
    />
  </BasicCard>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";
import { GET_Product, GET_ProductPictures } from "@/api/pim/api";

const PRODUCT_TYPES = ["base", "simple", "configurable", "bundle"];

export default {
  name: "ProductPreviewCard",
  props: {
    sku: { type: String, default: null },
    channelIdx: { type: String, default: "" },
    flat: { type: Boolean, default: false },
  },
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      product: null,
      mainPicture: "",
      loading: false,
    };
  },
  computed: {
    productName() {
      return this.product?.name || this.sku;
    },
    // "ProductSimple" reads as the PIM's own type name ("Simple"); a class it does not know is "Custom".
    productType() {
      const type = this.product.product_class_name.toLowerCase().replace(/^product/, "");
      return this.$t(`pim.type_${PRODUCT_TYPES.includes(type) ? type : "custom"}`);
    },
    // The product detail has no picture field (og_image is the SEO sharing URL, often empty): the picture is the
    // main one of the product's pictures, og_image only when it has none.
    heroUrl() {
      const path = this.mainPicture || this.product?.og_image;
      if (!path) return "";
      if (path.startsWith("http")) return path;
      return (process.env.VUE_APP_API_URL || "") + path;
    },
  },
  watch: {
    sku: { immediate: true, handler: "fetchProduct" },
  },
  methods: {
    async fetchProduct() {
      if (!this.sku || !this.channelIdx) {
        this.product = null;
        return;
      }
      this.loading = true;
      this.product = null;
      this.mainPicture = "";
      try {
        const [{ data }, mainPicture] = await Promise.all([
          GET_Product(this.channelIdx, this.sku),
          this.fetchMainPicture(),
        ]);
        this.product = data;
        this.mainPicture = mainPicture;
      } catch (err) {
        if (!(isNotFound(err))) {
          this.notify.spawnNotification({
            type: "negative",
            msg: extractApiMessage(err, this.$t("notifications.error")),
          });
        }
        this.product = null;
      } finally {
        this.loading = false;
      }
    },
    // The "main"-role picture, else the first one. A failed request only leaves the placeholder: the details stay.
    async fetchMainPicture() {
      try {
        const { data } = await GET_ProductPictures(this.channelIdx, this.sku);
        const pictures = data.results || data || [];
        const main = pictures.find(({ picture_role }) => picture_role?.toLowerCase() === "main") || pictures[0];
        return main?.picture?.image_url || "";
      } catch {
        return "";
      }
    },
    goToPim() {
      this.$router.push({ name: "PimProductDetail", params: { sku: this.sku } });
    },
  },
};
</script>

<style lang="scss" scoped>
.product-preview__hero {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-8);
}
.product-preview__img {
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: var(--radius-base);
}
.product-preview__img--ph {
  width: 100%;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: var(--fs-700);
}
.product-preview__meta {
  margin: 0;
}
.product-preview__row {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: var(--space-5);
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-subtle);
  dt {
    font-size: var(--fs-200);
    color: var(--text-muted);
  }
  dd {
    margin: 0;
    word-break: break-word;
  }
}
</style>
