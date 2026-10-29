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
        <BasicButton
          variant="secondary"
          @click="expandAll"
        >
          {{ $t('pim.expand_all') }}
        </BasicButton>
        <BasicButton
          variant="secondary"
          @click="collapseAll"
        >
          {{ $t('pim.collapse_all') }}
        </BasicButton>
      </div>
    </template>

      <Loader block v-if="loading" />

      <CategoryTree
        v-else
        ref="categoryTree"
        :categories="categories"
        :search-query="search"
        :channel-idx="channelIdx"
        @select="onRowClick"
        @reorder="onReorder"
      />

      <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { GET_Categories, PATCH_CategoriesReorder } from "@/api/pim/api";
import CategoryTree from "./components/CategoryTree.vue";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "CategoryList",
  components: { CategoryTree, PimChannelSelect },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    return { loader, notify, pimChannel };
  },
  data() {
    return {
      categories: [],
      totalCount: 0,
      search: "",
      isActiveFilter: null,
      loading: false,
    };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("pim.add_root_category"),
          handler: () => this.$router.push("/pim/categories/create"),
        },
      ];
    },
    activeFilterOptions() {
      return [
        { label: this.$t("pim.all"), value: null },
        { label: this.$t("pim.active"), value: true },
        { label: this.$t("pim.inactive"), value: false },
      ];
    },
  },
  watch: {
    "pimChannel.activeChannelIdx"() {
      this.fetchAllCategories();
    },
    isActiveFilter() {
      this.fetchAllCategories();
    },
  },
  mounted() {
    this.fetchAllCategories();
  },
  methods: {
    async fetchAllCategories({ silent = false } = {}) {
      if (!silent) this.loading = true;
      try {
        let allCategories = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const params = { page, page_size: 100 };
          if (this.isActiveFilter !== null)
            params.is_active = this.isActiveFilter;
          const { data } = await GET_Categories(this.channelIdx, params);
          allCategories = allCategories.concat(data.results || []);
          hasMore = !!data.next;
          page++;
        }
        this.categories = allCategories;
        this.totalCount = allCategories.length;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        if (!silent) this.loading = false;
      }
    },
    onFilterActive(val) {
      this.isActiveFilter = val;
    },
    onRowClick(row) {
      this.$router.push(`/pim/categories/${row.idx}`);
    },
    expandAll() {
      this.$refs.categoryTree.expandAll();
    },
    collapseAll() {
      this.$refs.categoryTree.collapseAll();
    },
    async onReorder(items) {
      try {
        await PATCH_CategoriesReorder(this.channelIdx, { items });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.categories_reordered"),
        });
        await this.fetchAllCategories({ silent: true });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        await this.fetchAllCategories({ silent: true });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.category-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}
.category-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
</style>
