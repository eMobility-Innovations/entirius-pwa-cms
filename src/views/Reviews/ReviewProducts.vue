<template>
  <div class="p-500 fs-300 t-basic-800 h-100 ov-h">
    <Teleport to="#reviews-toolbar-left" defer>
      <span class="fw-600 fs-400">{{ $t("reviews.products") }}</span>
    </Teleport>
    <div class="bg-basic-100 b-basic-300 br-50 h-100 ovy-auto p-500">
      <div class="flex ai-ct gap-200 mb-400">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="products__search"
          data-testid="reviews-products-search"
          @input="debouncedFetch(searchAndFetch)"
        />
      </div>
      <Loader v-show="loading" />
      <DataTable
        v-show="!loading"
        :columns="columns"
        :rows="rows"
        row-key="id"
        :empty-text="$t('reviews.no_products')"
      >
        <template #cell-parent_sku="{ value }">
          <span v-if="value" class="chip bg-support-100 t-support-400">{{
            value
          }}</span>
          <span v-else class="t-basic-400">—</span>
        </template>
        <template #cell-average_rate="{ value }">{{
          formatStars(value)
        }}</template>
      </DataTable>
      <EmptyState
        v-if="!loading && !rows.length"
        icon="boxes-stacked"
        :title="$t('reviews.no_products')"
      />
      <Pagination
        v-if="totalCount > pageSize"
        :pagination="paginationState"
        @onChangePage="onPageChange"
      />
    </div>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_ReviewProducts } from "@/api/reviews/api";
import { formatStars } from "./reviewStatus";

export default {
  name: "ReviewProducts",
  setup() {
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { notify, search, debouncedFetch };
  },
  data() {
    return {
      rows: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      loading: false,
    };
  },
  computed: {
    columns() {
      return [
        { key: "sku", label: this.$t("reviews.col.sku"), width: "160px" },
        {
          key: "name",
          label: this.$t("reviews.col.name"),
          width: "minmax(160px, 1fr)",
        },
        {
          key: "parent_sku",
          label: this.$t("reviews.col.parent"),
          width: "140px",
        },
        {
          key: "number_of_reviews",
          label: this.$t("reviews.col.reviews"),
          width: "100px",
        },
        {
          key: "average_rate",
          label: this.$t("reviews.col.avg"),
          width: "130px",
        },
        {
          key: "magento_id",
          label: this.$t("reviews.col.magento"),
          width: "110px",
        },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
  },
  watch: {
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchRows();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchRows();
  },
  methods: {
    formatStars,
    async fetchRows() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        const { data } = await GET_ReviewProducts(params);
        this.rows = data.results || [];
        this.totalCount = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchRows();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.products__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
</style>
