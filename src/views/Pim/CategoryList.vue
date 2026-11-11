<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pim.category_tree')">
        <template #meta>
          <PimChannelSelect />
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="category-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="category-list__search"
        />
        <BasicSelect
          :floating-label="$t('pim.status')"
          :options="activeFilterOptions"
          :model-value="isActiveFilter ?? ''"
          @update:model-value="onFilterActive"
        />
        <BasicButton variant="secondary" @click="tree.collapseAll()">
          {{ $t('pim.collapse_all') }}
        </BasicButton>
      </div>
    </template>

    <Loader block v-if="rootsLoading" />

    <template v-else-if="tree.isSearchMode.value">
      <div class="category-list__results" data-testid="category-results">
        <CategoryTreeNode
          v-for="item in tree.search.items"
          :key="item.idx"
          :node="item"
          flat
          @select="onRowClick"
          @show-in-tree="onShowInTree"
        />
        <Loader block v-if="tree.search.loading" />
        <div v-else-if="tree.search.error" class="category-tree__more">
          <span class="t-negative fs-200">{{ $t('pim.category_level_error') }}</span>
          <BasicButton variant="secondary" size="sm" @click="tree.searchMore()">
            {{ $t('pim.category_retry') }}
          </BasicButton>
        </div>
        <div v-else-if="tree.search.nextPage" class="category-tree__more">
          <BasicButton variant="secondary" size="sm" @click="tree.searchMore()">
            {{ $t('pim.category_show_more', { loaded: tree.search.items.length, count: tree.search.count }) }}
          </BasicButton>
        </div>
        <EmptyState v-else-if="!tree.search.items.length" :title="$t('pim.no_categories')" icon="search" />
      </div>
    </template>

    <template v-else>
      <p v-if="tree.reordering.value || tree.revealing.value" class="category-list__busy fs-200 t-muted" role="status">
        {{ $t(tree.revealing.value ? 'pim.category_reveal_loading' : 'pim.category_reorder_loading') }}
      </p>
      <EmptyState v-if="!tree.rows.value.length" :title="$t('pim.no_categories')" icon="categories" />
      <CategoryTree
        v-else
        :rows="tree.rows.value"
        :highlight-idx="tree.highlightIdx.value"
        :busy="tree.reordering.value"
        :can-drop="tree.canDrop"
        @toggle="tree.toggle"
        @select="onRowClick"
        @add-child="onAddChild"
        @load-more="tree.loadMore"
        @reorder="onReorder"
      />
    </template>

    <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useRouter } from "vue-router";
import { t } from "@/i18n";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { usePageReadonly } from "@/composables/useReadonly";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { extractApiMessage } from "@/composables/useFormErrors";
import CategoryTree from "./components/CategoryTree.vue";
import CategoryTreeNode from "./components/CategoryTreeNode.vue";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import { useCategoryTree } from "./composables/useCategoryTree";

defineOptions({ name: "CategoryList" });

const HIGHLIGHT_MS = 5000;
const SETTLE_MS = 200;
const router = useRouter();
const notify = useNotifyStore();
const pimChannel = usePimChannelStore();
const { search, debouncedFetch } = useSearchDebounce();
const isActiveFilter = ref(null);
const readonly = usePageReadonly();

const channelIdx = computed(() => pimChannel.activeChannelIdx);
const focusKey = () => `cms_pim_category_focus_${channelIdx.value}`;

const tree = useCategoryTree({
  getChannel: () => channelIdx.value,
  onError: (err) =>
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    }),
});

const rootsLoading = computed(() => {
  const root = tree.levels[tree.ROOT];
  return !root || (root.loading && !root.items.length);
});

const fabActions = computed(() => [
  {
    icon: "add",
    label: t("pim.add_root_category"),
    handler: () => router.push("/pim/categories/create"),
  },
]);

const activeFilterOptions = computed(() => [
  { label: t("pim.all"), value: null },
  { label: t("pim.active"), value: true },
  { label: t("pim.inactive"), value: false },
]);

function applyFilter() {
  tree.applyFilter(search.value, isActiveFilter.value);
}

watch(search, () => debouncedFetch(applyFilter));

function onFilterActive(val) {
  isActiveFilter.value = val === "" ? null : val;
  applyFilter();
}

function storeFocus(idx) {
  try {
    localStorage.setItem(focusKey(), idx);
  } catch {
    /* storage blocked: ignore */
  }
}

function takeFocus() {
  try {
    const idx = localStorage.getItem(focusKey());
    localStorage.removeItem(focusKey());
    return idx;
  } catch {
    return null;
  }
}

function onRowClick(row) {
  storeFocus(row.idx);
  router.push(`/pim/categories/${row.idx}`);
}

function onAddChild(row) {
  router.push({ path: "/pim/categories/create", query: { parent: row.idx } });
}

async function onShowInTree(row) {
  search.value = "";
  isActiveFilter.value = null;
  tree.applyFilter("", null);
  const result = await tree.revealInTree(row.idx);
  if (result === "not_found") {
    notify.spawnNotification({
      type: "warning",
      msg: t("pim.category_reveal_not_found", { name: row.name || row.idx }),
    });
  }
}

async function onReorder({ draggedIdx, targetIdx, position }) {
  if (readonly.value) return;
  const ok = await tree.move(draggedIdx, targetIdx, position);
  if (!ok) return;
  notify.spawnNotification({
    type: "positive",
    msg: t("pim.categories_reordered"),
  });
}

let highlightTimer = null;
watch(tree.highlightIdx, async (idx) => {
  clearTimeout(highlightTimer);
  if (!idx) return;
  await nextTick();
  const scrollTo = () =>
    document
      .querySelector(`[data-idx="${CSS.escape(idx)}"]`)
      ?.scrollIntoView({ block: "center" });
  scrollTo();
  // Rows above may still settle (a restored level arrives); the target stays centred.
  setTimeout(scrollTo, SETTLE_MS);
  highlightTimer = setTimeout(() => {
    tree.highlightIdx.value = null;
  }, HIGHLIGHT_MS);
});

async function loadTree() {
  search.value = "";
  isActiveFilter.value = null;
  await tree.load();
  const idx = takeFocus();
  if (idx && tree.rows.value.some((r) => r.item?.idx === idx)) {
    tree.highlightIdx.value = idx;
  }
}

watch(channelIdx, loadTree);
onMounted(loadTree);
</script>

<style lang="scss" scoped>
.category-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}
.category-list__busy {
  margin: 0 0 var(--space-3);
}
.category-tree__more {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
}
.category-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
</style>
