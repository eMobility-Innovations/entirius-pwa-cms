<template>
  <div>
    <Loader block v-show="loading" />

    <EmptyState
      v-if="!loading && !current"
      class="mt-10"
      :title="$t('atlas.review.empty_state_title')"
      :message="$t('atlas.review.empty_state_message')"
      icon="checkboxOn"
    />

    <div v-else-if="current">
      <p class="t-muted fs-200 text-center mb-5" data-testid="swipe-counter">
        {{ index + 1 }} / {{ queue.length }}
      </p>

      <div class="swipe-mode__layout">
        <ProductCard
          :product="current"
          @show-raw="rawVisible = true"
          @show-gallery="galleryVisible = true"
        />
        <!-- Desktop-only side panel. Mobile users see the modal via "Show raw data" button. -->
        <RawDataPanel :product="current" class="hide-mobile" />
      </div>
    </div>

    <!-- The decision bar pins to the bottom edge of the page scroll body (as the PageLayout footer does). R5 order:
         Skip (secondary) · Reject (danger, outlined) · Approve (primary) rightmost; equal widths on a phone. -->
    <div
      v-if="current"
      class="swipe-mode__actions flex ai-ct jc-fe gap-3"
      role="group"
      :aria-label="$t('common.actions')"
      data-testid="swipe-actions-bar"
    >
      <BasicButton
        v-if="!isMonitoringRow"
        variant="secondary"
        :disabled="busy"
        data-testid="swipe-skip-btn"
        @click="reviewProduct('skip')"
      >
        {{ $t('atlas.review.skip_button') }}
      </BasicButton>
      <BasicButton
        variant="danger"
        :disabled="busy"
        data-testid="swipe-reject-btn"
        @click="reviewProduct('reject')"
      >
        {{ $t('atlas.review.reject_button') }}
      </BasicButton>
      <BasicButton
        v-if="!isMonitoringRow && kind === 'procurement'"
        variant="primary"
        :disabled="busy"
        data-testid="swipe-approve-btn"
        @click="reviewProduct('approve')"
      >
        {{ $t('atlas.review.approve_button') }}
      </BasicButton>
    </div>

    <!-- Mobile-only fallback modal — desktop uses the side panel. -->
    <RawDataModal
      :visible="rawVisible"
      :product="current"
      @close="rawVisible = false"
    />

    <GalleryModal
      :visible="galleryVisible"
      :images="currentImages"
      :product-name="current?.name || ''"
      @close="galleryVisible = false"
    />
  </div>
</template>

<script>
import ProductCard from "./ProductCard.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import RawDataModal from "./RawDataModal.vue";
import RawDataPanel from "./RawDataPanel.vue";
import GalleryModal from "./GalleryModal.vue";
import { useNotifyStore } from "@/stores/notify";
import {
  GET_SupplierProducts,
  POST_ApproveProduct,
  POST_RejectProduct,
  POST_QueueProduct,
} from "@/api/atlas/api";

const ACTION_FN = {
  approve: POST_ApproveProduct,
  reject: POST_RejectProduct,
  skip: POST_QueueProduct,
};

export default {
  name: "SwipeMode",
  components: { ProductCard, RawDataModal, RawDataPanel, GalleryModal },
  props: {
    filters: { type: Object, required: true },
    kind: { type: String, default: "procurement" },
  },
  emits: ["reviewed"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      queue: [],
      index: 0,
      loading: false,
      busy: false,
      rawVisible: false,
      galleryVisible: false,
    };
  },
  computed: {
    current() {
      return this.queue[this.index] || null;
    },
    currentImages() {
      return Array.isArray(this.current?.image_urls)
        ? this.current.image_urls
        : [];
    },
    isMonitoringRow() {
      // Monitoring suppliers never push — approve is meaningless and backend-refused.
      return this.current?.kind === "monitoring";
    },
  },
  watch: {
    filters: {
      handler() {
        this.fetchQueue();
      },
      deep: true,
    },
  },
  mounted() {
    this.fetchQueue();
  },
  methods: {
    async fetchQueue() {
      this.loading = true;
      try {
        const params = { page_size: 50 };
        if (this.filters.supplier && this.filters.supplier !== "__all") {
          params.source = this.filters.supplier;
        }
        if (this.filters.status && this.filters.status !== "__all") {
          params.status = this.filters.status;
        }
        if (this.filters.search) params.search = this.filters.search;
        const { data } = await GET_SupplierProducts(params);
        this.queue = data.results || [];
        this.index = 0;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async reviewProduct(action) {
      if (!this.current || this.busy) return;
      this.busy = true;
      try {
        await ACTION_FN[action](this.current.id);
        this.$emit("reviewed", { action, product: this.current });
        this.index += 1;
        if (this.index >= this.queue.length) {
          this.fetchQueue();
        }
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

/* Desktop: side-by-side card + raw panel. Mobile: stacked, panel hidden (modal fallback). */
.swipe-mode__layout {
  display: grid;
  grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
  gap: var(--space-8);
  align-items: start;
  max-width: 1100px;
  margin: 0 auto;

  @include max-tablet {
    grid-template-columns: 1fr;
  }
}

.swipe-mode__actions {
  position: sticky;
  /* PageLayout's padding, as PageHeader's sticky head reads it (the fallback is its phone value). */
  bottom: calc(-1 * var(--page-layout-pad-y, var(--space-5)));
  z-index: 1;
  margin-top: var(--space-8);
  padding-block: var(--space-3);
  /* PageLayout's FAB lane: the FAB's corner stays clear of Approve. */
  padding-right: var(--fab-lane, 0px);
  background-color: var(--surface-page);

  /* FIX-02: Reject keeps its outline, so it reads as a button beside Skip and Approve. */
  :deep(.button-basic--danger) {
    border-color: var(--negative);

    &[disabled] {
      border-color: var(--border-default);
    }
  }

  @include max-tablet {
    :deep(.button-basic) {
      flex: 1 1 0;
      justify-content: center;
    }
  }
}

.text-center {
  text-align: center;
}
</style>
