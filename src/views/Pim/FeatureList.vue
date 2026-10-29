<template>
  <PageLayout class="pim-list-layout fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pim.features')">
        <template #meta>
          <PimChannelSelect />
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="feature-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="feature-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <MobileFilterPanel
          :active-count="activeFilterCount"
          :trigger-label="$t('builder.filters')"
        >
          <BasicSelect
            :floating-label="$t('pim.feature_type')"
            :options="typeFilterOptions"
            :model-value="typeFilter ?? ''"
            @update:model-value="onFilterType"
          />
          <BasicSelect
            :floating-label="$t('pim.scope')"
            :options="scopeFilterOptions"
            :model-value="scopeFilter ?? ''"
            @update:model-value="onFilterScope"
          />
        </MobileFilterPanel>
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="features"
        :sortable="true"
        row-key="idx"
        :empty-text="$t('pim.no_features')"
        @sort="onSort"
        @row-click="onRowClick"
      >
        <template #cell-name="{ row }">{{ featureName(row) }}</template>
        <template #cell-feature_type="{ value }">
          <StatusBadge tone="neutral" :dot="false" :label="$t(featureTypeLabel(value))" />
        </template>
        <template #cell-scope="{ value }">
          {{ $t(scopeLabel(value)) }}
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
import { usePimChannelStore } from "@/stores/pimChannel";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { GET_Features } from "@/api/pim/api";
import {
  FEATURE_TYPES,
  FILTER_SCOPES,
  featureTypeLabel,
  scopeLabel,
} from "./helpers/pimEnums";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "FeatureList",
  components: { PimChannelSelect },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
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
    return { loader, notify, pimChannel, search, debouncedFetch };
  },
  data() {
    return {
      features: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      typeFilter: null,
      scopeFilter: null,
      ordering: null,
      loading: false,
    };
  },
  computed: {
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("pim.create_feature"),
          handler: () => this.onCreate(),
        },
      ];
    },
    activeFilterCount() {
      let count = 0;
      if (this.typeFilter !== null) count++;
      if (this.scopeFilter !== null) count++;
      return count;
    },
    columns() {
      return [
        { key: "idx", label: "IDX", sortable: true, width: "160px", priority: 2 },
        {
          key: "name",
          label: this.$t("pim.name"),
          sortable: false,
          width: "1fr",
          truncate: true,
          title: (row) => this.featureName(row),
        },
        {
          key: "feature_type",
          label: this.$t("pim.feature_type"),
          sortable: true,
          width: "180px",
          truncate: true,
        },
        {
          key: "scope",
          label: this.$t("pim.scope"),
          sortable: true,
          width: "120px",
          priority: 2,
        },
        {
          key: "attribute_count",
          label: this.$t("pim.options"),
          sortable: false,
          width: "80px",
          priority: 2,
          numeric: true,
        },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
    typeFilterOptions() {
      return [
        { label: this.$t("pim.all"), value: null },
        ...FEATURE_TYPES.map((ft) => ({
          label: this.$t(ft.labelKey),
          value: ft.value,
        })),
      ];
    },
    scopeFilterOptions() {
      return [
        { label: this.$t("pim.all"), value: null },
        ...FILTER_SCOPES.map((s) => ({
          label: this.$t(s.labelKey),
          value: s.value,
        })),
      ];
    },
  },
  watch: {
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchFeatures();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchFeatures();
  },
  methods: {
    featureTypeLabel,
    scopeLabel,
    featureName(row) {
      return row.name || row.name_t9n?.en || row.name_t9n?.pl || row.idx;
    },
    async fetchFeatures() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.typeFilter !== null) params.feature_type = this.typeFilter;
        if (this.scopeFilter !== null) params.scope = this.scopeFilter;
        if (this.ordering) params.ordering = this.ordering;

        const { data } = await GET_Features(
          params,
          this.pimChannel.activeChannelIdx
        );
        this.features = data.results || [];
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
      this.fetchFeatures();
    },
    onFilterType(val) {
      this.typeFilter = val;
      this.currentPage = 1;
      this.fetchFeatures();
    },
    onFilterScope(val) {
      this.scopeFilter = val;
      this.currentPage = 1;
      this.fetchFeatures();
    },
    onSort({ key, direction }) {
      if (!key) {
        this.ordering = null;
      } else {
        this.ordering = direction === "desc" ? `-${key}` : key;
      }
      this.fetchFeatures();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/pim/features/${row.idx}`);
    },
    onCreate() {
      this.$router.push("/pim/features/create");
    },
  },
};
</script>

<style lang="scss" scoped>
.feature-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}
.feature-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}

@media only screen and (max-width: 768px) {
  .pim-list-layout {
    overflow-x: visible !important;

    > div {
      overflow-x: visible !important;
    }
  }
}
</style>
