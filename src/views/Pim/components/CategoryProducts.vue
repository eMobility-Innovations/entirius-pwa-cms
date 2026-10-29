<template>
  <div class="category-products">
    <BasicCard :title="$t('pim.pinned_products')" gap class="mb-8">
      <template #actions>
        <CountBadge :count="positioned.length" />
      </template>
      <draggable
        v-model="positioned"
        :disabled="readonly"
        :group="{ name: 'category-products' }"
        item-key="sku"
        :class="[
          'product-grid product-grid--pinned',
          { 'product-grid--empty': !positioned.length },
        ]"
        :data-empty-hint="$t('pim.drag_to_pin')"
        ghost-class="sortable-product--ghost"
        @end="onDragEnd"
      >
        <template #item="{ element, index }">
          <div class="sortable-product sortable-product--pinned">
              <font-awesome-icon :icon="$icons.drag" class="t-muted" aria-hidden="true" />
              <span class="sortable-product__position bg-accent-subtle t-strong">#{{ index + 1 }}</span>
              <div
                v-if="element.thumbnail_url"
                class="sortable-product__thumb"
                :style="{ backgroundImage: `url(${element.thumbnail_url})` }"
              />
              <div v-else class="sortable-product__thumb sortable-product__thumb--empty">
                <font-awesome-icon :icon="$icons.image" class="t-muted" aria-hidden="true" />
              </div>
              <div class="sortable-product__info">
                <span class="sortable-product__sku fs-200 t-muted">{{ element.sku }}</span>
                <span class="sortable-product__name fs-300 t-body">{{ element.name || "---" }}</span>
              </div>
            </div>
        </template>
      </draggable>
    </BasicCard>

    <BasicCard :title="$t('pim.all_products')" gap>
      <template #actions>
        <CountBadge :count="unpositionedCount" />
      </template>
      <ReadonlyOff>
        <BasicInput
          v-model="searchQuery"
          :placeholder="$t('common.start_typing')"
          :aria-label="$t('pim.search_products')"
          icon="search"
          class="search-input"
        />
      </ReadonlyOff>
      <draggable
        v-model="unpositioned"
        :disabled="readonly"
        :group="{ name: 'category-products' }"
        item-key="sku"
        class="product-grid"
        ghost-class="sortable-product--ghost"
        @end="onDragEnd"
      >
        <template #item="{ element }">
          <div class="sortable-product">
              <font-awesome-icon :icon="$icons.drag" class="t-muted" aria-hidden="true" />
              <div
                v-if="element.thumbnail_url"
                class="sortable-product__thumb"
                :style="{ backgroundImage: `url(${element.thumbnail_url})` }"
              />
              <div v-else class="sortable-product__thumb sortable-product__thumb--empty">
                <font-awesome-icon :icon="$icons.image" class="t-muted" aria-hidden="true" />
              </div>
              <div class="sortable-product__info">
                <span class="sortable-product__sku fs-200 t-muted">{{ element.sku }}</span>
                <span class="sortable-product__name fs-300 t-body">{{ element.name || "---" }}</span>
              </div>
            </div>
        </template>
      </draggable>
      <EmptyState v-if="!unpositioned.length && !loading" size="sm" :title="$t('common.no_data')" />

      <Pagination :page="currentPage" :pages="totalPages" @update:page="goToPage" />
    </BasicCard>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { t } from "@/i18n";
import draggable from "vuedraggable";
import { ReadonlyOff, useReadonly } from "@/composables/useReadonly";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import {
  GET_CategoryProducts,
  PATCH_CategoryProductsReorder,
} from "@/api/pim/api";
import { extractApiMessage } from "@/composables/useFormErrors";

const props = defineProps({
  channelIdx: { type: String, required: true },
  categoryIdx: { type: String, required: true },
});

const loader = useLoaderStore();
const notify = useNotifyStore();
const readonly = useReadonly();

const positioned = ref([]);
const unpositioned = ref([]);
const unpositionedCount = ref(0);
const currentPage = ref(1);
const pageSize = 24;
const loading = ref(false);
const searchQuery = ref("");

let searchTimeout = null;

const totalPages = computed(() =>
  Math.max(1, Math.ceil(unpositionedCount.value / pageSize))
);

async function fetchProducts() {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      page_size: pageSize,
    };
    if (searchQuery.value) {
      params.search = searchQuery.value;
    }
    const { data } = await GET_CategoryProducts(
      props.channelIdx,
      props.categoryIdx,
      params
    );
    positioned.value = data.positioned;
    unpositioned.value = data.unpositioned;
    unpositionedCount.value = data.unpositioned_count;
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    loading.value = false;
  }
}

async function savePositions() {
  loader.loaderStart();
  try {
    const items = positioned.value.map((p, idx) => ({
      sku: p.sku,
      position: idx + 1,
    }));
    // Also include items that were moved to unpositioned (position=0)
    for (const p of unpositioned.value) {
      if (p.position > 0) {
        items.push({ sku: p.sku, position: 0 });
      }
    }

    if (items.length > 0) {
      await PATCH_CategoryProductsReorder(props.channelIdx, props.categoryIdx, {
        items,
      });
      notify.spawnNotification({
        type: "positive",
        msg: t("pim.product_positions_saved"),
      });
    }
    await fetchProducts();
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.save_error")),
    });
  } finally {
    loader.loaderFinish();
  }
}

function onDragEnd() {
  savePositions();
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  fetchProducts();
}

watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    fetchProducts();
  }, 300);
});

watch(
  () => [props.channelIdx, props.categoryIdx],
  () => fetchProducts()
);

onMounted(() => fetchProducts());
</script>

<style lang="scss" scoped>
.search-input {
  width: 250px;
  max-width: 100%;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-5);
  min-height: 48px;

  &--pinned {
    min-height: 60px;
  }

  &--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
    border: 2px dashed var(--border-subtle);
    border-radius: var(--radius-base);
    transition: border-color 0.2s, background 0.2s;

    &::after {
      content: attr(data-empty-hint);
      color: var(--text-muted);
      font-size: var(--fs-300);
    }
  }
}

// One product in the sortable grids: a drag handle, not a card (the grid sits in a BasicCard).
.sortable-product {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-base);
  cursor: grab;
  user-select: none;

  &--pinned {
    border-left: 3px solid var(--accent);
  }

  &__position {
    flex-shrink: 0;
    font-size: var(--fs-200);
    font-weight: 600;
    padding: 2px var(--space-1);
    border-radius: var(--radius-base);
  }

  &__thumb {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-base);
    background-size: cover;
    background-position: center;
    background-color: var(--surface-raised);

    &--empty {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  &__sku {
    font-family: var(--font-mono);
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

<!-- Unscoped: SortableJS ghost is appended to <body> -->
<style>
.sortable-product--ghost {
  opacity: 0.4;
  border: 2px dashed var(--accent) !important;
  background: var(--accent-subtle) !important;
}
</style>
