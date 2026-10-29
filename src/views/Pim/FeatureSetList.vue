<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pim.feature_sets')">
        <template #meta>
          <PimChannelSelect />
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="feature-set-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="feature-set-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="featureSets"
        :sortable="true"
        row-key="idx"
        :empty-text="$t('pim.no_feature_sets')"
        @sort="onSort"
        @row-click="onRowClick"
      >
        <template #cell-is_default="{ value }">
          <StatusBadge
            :tone="value ? 'positive' : 'neutral'"
            :dot="false"
            :label="value ? $t('pim.yes') : $t('pim.no')"
          />
        </template>
      </DataTable>

      <FloatingActions :actions="fabActions" />
    <template v-if="totalCount > pageSize" #footer>
      <Pagination
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>
  </PageLayout>
</template>

<script>
import { inject, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { GET_FeatureSetsGlobal, POST_FeatureSet } from "@/api/pim/api";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "FeatureSetList",
  components: { PimChannelSelect },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    const isGlobalScope = inject("isGlobalScope", null);
    onMounted(() => {
      nextTick(() => {
        if (isGlobalScope) isGlobalScope.value = true;
      });
    });
    onBeforeUnmount(() => {
      if (isGlobalScope) isGlobalScope.value = false;
    });
    return { loader, notify, search, debouncedFetch };
  },
  data() {
    return {
      featureSets: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      loading: false,
    };
  },
  computed: {
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("pim.create_feature_set"),
          handler: () => this.onCreate(),
        },
      ];
    },
    columns() {
      return [
        { key: "idx", label: "IDX", sortable: true, width: "1fr", priority: 2 },
        {
          key: "name",
          label: this.$t("pim.name"),
          sortable: true,
          width: "2fr",
        },
        {
          key: "desc",
          label: this.$t("pim.description"),
          sortable: false,
          width: "2fr",
          priority: 2,
        },
        {
          key: "is_default",
          label: this.$t("pim.is_default"),
          sortable: true,
          width: "100px",
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
      this.fetchFeatureSets();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchFeatureSets();
  },
  methods: {
    async fetchFeatureSets() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;

        const { data } = await GET_FeatureSetsGlobal(params);
        this.featureSets = data.results || [];
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
      this.fetchFeatureSets();
    },
    onSort({ key, direction }) {
      if (!key) {
        this.ordering = null;
      } else {
        this.ordering = direction === "desc" ? `-${key}` : key;
      }
      this.fetchFeatureSets();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/pim/feature-sets/${row.idx}`);
    },
    async onCreate() {
      const idx = `new-set-${Date.now()}`;
      this.loader.loaderStart();
      try {
        await POST_FeatureSet({ idx, name: "New Attribute Set" });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.feature_set_created"),
        });
        this.$router.push(`/pim/feature-sets/${idx}`);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.feature-set-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}
.feature-set-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
</style>
