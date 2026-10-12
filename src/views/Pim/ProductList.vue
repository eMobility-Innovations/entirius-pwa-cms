<template>
  <PageLayout class="pim-list-layout fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pim.products')">
        <template #meta>
          <PimChannelSelect />
        </template>
      </PageHeader>
    </template>

    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-5">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="product-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <MobileFilterPanel :active-count="dropdownFilterCount" :trigger-label="$t('pim.filters')">
          <div class="product-list__filter-group">
            <FilterChip
              v-for="tab in filterTabs"
              :key="tab.key"
              :label="tab.label"
              :active="activeFilter === tab.key"
              @click="setFilter(tab.key)"
            />
          </div>
          <div class="product-list__filter-group">
            <BasicSelect
              :floating-label="$t('pim.visibility')"
              :options="visibilityOptions"
              :model-value="visibilityFilter"
              class="product-list__filter-dropdown"
              @update:model-value="onVisibilitySelect"
            />
            <BasicSelect
              :floating-label="$t('pim.product_class')"
              :options="productClassOptions"
              :model-value="productClassFilter"
              class="product-list__filter-dropdown"
              @update:model-value="onProductClassSelect"
            />
            <BasicSelect
              :floating-label="$t('pim.categories')"
              :options="categoryOptions"
              :model-value="categoryFilter"
              class="product-list__filter-dropdown"
              @update:model-value="onCategorySelect"
            />
            <BasicSelect
              v-for="feat in filterableFeatures"
              :key="feat.idx"
              :floating-label="feat.name"
              :options="featureFilterOptions(feat)"
              :model-value="attributeFilters[feat.idx] ?? ''"
              class="product-list__filter-dropdown"
              @update:model-value="(val) => onAttributeFilter(feat.idx, val)"
            />
          </div>
          <div v-if="hasQualityData" class="product-list__filter-group">
            <span class="t-muted fs-200">{{ $t("pim.quality_filter_label") }}</span>
            <FilterChip
              :label="$t('pim.quality_only_critical')"
              :title="$t('pim.quality_only_critical_hint')"
              :active="gapSeverityFilter === 'critical'"
              data-test="quality-only-critical"
              @click="toggleOnlyCritical"
            />
            <FilterChip
              :label="$t('pim.quality_only_source')"
              :title="$t('pim.quality_only_source_hint')"
              :active="onlySourceGaps"
              data-test="quality-only-source"
              @click="toggleOnlySource"
            />
          </div>
          <BasicButton
            v-if="dropdownFilterCount"
            variant="ghost"
            size="sm"
            @click="clearAllDropdownFilters"
          >
            {{ $t("pim.clear_filters") }}
          </BasicButton>
        </MobileFilterPanel>
        <IconButton
          v-if="hasQualityData"
          :icon="hideQualitySensor ? 'hide' : 'preview'"
          variant="outline"
          :pressed="!hideQualitySensor"
          :label="$t('pim.quality_show_sensor')"
          data-test="quality-toggle"
          @click="toggleQualitySensor"
        />
        <span v-if="totalCount > 0" class="fs-200 t-muted ml-auto"
          >{{ totalCount }} {{ $t("pim.products").toLowerCase() }}</span
        >
      </div>
    </template>

      <GapStatusAlert v-if="hasQualityData" compact />

      <BulkActionBar
        v-if="selectedProducts.length"
        :count="selectedProducts.length"
        selected-label-key="pim.products_selected"
        clear-label-key="pim.clear_selection"
        :actions="bulkActions"
        @action="handleBulkAction"
        @clear="clearSelection"
      />

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="products"
        :sortable="true"
        :selectable="true"
        :multi-select="true"
        row-key="sku"
        :empty-text="$t('pim.no_products')"
        @sort="onSort"
        @select="onSelect"
        @row-click="onRowClick"
      >
        <template #cell-thumbnail="{ row }">
          <div class="product-thumb">
            <img
              v-if="row.thumbnail_url"
              :src="mediaUrl(row.thumbnail_url)"
              :alt="row.name || row.sku"
              class="product-thumb__img"
            />
            <FontAwesomeIcon
              v-else
              :icon="$icons.image"
              class="product-thumb__placeholder t-muted"
            />
          </div>
        </template>
        <template #cell-name="{ row }">
          {{ row.name || row.sku }}
        </template>
        <template #cell-product_class_name="{ row }">
          <StatusBadge
            v-if="row.product_class_name"
            :tone="productClassTone(row.product_class_name)"
            :dot="false"
            :label="productClassLabel(row.product_class_name)"
          />
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-is_enabled="{ value }">
          <StatusBadge
            :label="value ? $t('pim.enabled') : $t('pim.disabled')"
            :tone="value ? 'positive' : 'negative'"
          />
        </template>
        <template #cell-supplier_status="{ row }">
          <BasicButton
            v-if="supplierStatusMap[row.sku]?.unseen_count > 0"
            variant="ghost"
            size="sm"
            :title="$t('pim.badge_updated_title')"
            @click="onSupplierBadgeClick(row.sku)"
          >
            <StatusBadge :label="$t('pim.badge_updated')" tone="warning" />
          </BasicButton>
        </template>
        <template #cell-quality="{ row }">
          <!-- The findings panel lives inside the row: its clicks must not select or open the row. -->
          <div data-test="quality-cell" @click.stop>
            <BasicMenu
              v-if="qualityState(row) === 'gaps' && (!qualityFilterActive || qualityFindings(row).length)"
              :label="$t('pim.quality_show_details')"
              data-test="quality-menu"
            >
              <template #trigger="{ open }">
                <BasicButton
                  variant="ghost"
                  size="sm"
                  :title="$t('pim.quality_show_details')"
                  data-test="quality-toggle-row"
                >
                  <StatusBadge
                    :label="String(qualityFilterActive ? qualityFindings(row).length : row.gap_count)"
                    :tone="qualityVariant(row)"
                  />
                  <FontAwesomeIcon
                    :icon="open ? $icons.collapse : $icons.expand"
                    class="fs-200 t-muted"
                  />
                </BasicButton>
              </template>
              <template #panel>
                <ul class="product-list__gaps p-2" data-test="quality-popover">
                  <li
                    v-for="(f, i) in (qualityMap[String(row.pk)] || [])"
                    :key="i"
                    class="product-list__gap"
                  >
                    <span class="t-body">{{ gapLabel(f) }}</span>
                    <Tag v-if="f.language" :label="f.language.toUpperCase()" />
                    <span v-if="f.inherited" class="product-list__gap-inherited t-muted">
                      {{ $t("pim.quality_fix_on", { channel: f.source_channel }) }}
                    </span>
                  </li>
                </ul>
              </template>
            </BasicMenu>
            <StatusBadge
              v-else-if="qualityState(row) === 'unevaluated'"
              :label="$t('pim.quality_unevaluated')"
              tone="neutral"
            />
            <span v-else class="t-muted fs-200">{{ $t("pim.quality_ok") }}</span>
          </div>
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

    <PimTranslateDialog
      v-model:open="showTranslateDialog"
      scope="product"
      :channel-idx="channelIdx"
      :entity-ids="translateEntityIds"
    />

    <SpawnDialog
      :visible="showSpawnDialog"
      :skus="spawnSkus"
      :filter-params="spawnFilterParams"
      @close="showSpawnDialog = false"
      @spawned="onSpawned"
    />

  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useMuninStore } from "@/stores/munin";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import {
  GET_Products,
  POST_BulkUpdateProducts,
  GET_Categories,
  GET_Features,
  GET_FeatureAttributes,
  GET_BulkProductGaps,
} from "@/api/pim/api";
import { GET_BulkHasChanges } from "@/api/atlas/api";
import { getLang } from "@/i18n";
import {
  gapBadgeVariant,
  gapRowState,
  hasQualityFields,
  resolveGapLabel,
  findingsParams,
} from "./quality";
import SpawnDialog from "./components/enrichment/SpawnDialog.vue";
import GapStatusAlert from "./components/GapStatusAlert.vue";
import PimTranslateDialog from "./components/PimTranslateDialog.vue";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import { extractApiMessage } from "@/composables/useFormErrors";

const HIDE_QUALITY_KEY = "pim_hide_quality_sensor";

function readHideQualitySensor() {
  try {
    return localStorage.getItem(HIDE_QUALITY_KEY) === "1";
  } catch {
    return false;
  }
}

export default {
  name: "ProductList",
  components: { SpawnDialog, GapStatusAlert, PimTranslateDialog, PimChannelSelect },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const munin = useMuninStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, pimChannel, munin, search, debouncedFetch };
  },
  data() {
    return {
      products: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      selectedProducts: [],
      loading: false,
      activeFilter: "all",
      visibilityFilter: null,
      productClassFilter: null,
      categoryFilter: null,
      categories: [],
      filterableFeatures: [],
      attributeFilters: {},
      showTranslateDialog: false,
      translateEntityIds: [],
      supplierStatusMap: {},
      qualityMap: {},
      hasQualityData: false,
      hideQualitySensor: readHideQualitySensor(),
      gapSeverityFilter: null,
      onlySourceGaps: false,
      showSpawnDialog: false,
      spawnSkus: [],
      spawnFilterParams: {},
    };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    translatorAvailable() {
      return this.munin.isModuleInstalled("pim_translator");
    },
    hasSuppliersPanel() {
      return this.munin.isPanelEnabled("atlas");
    },
    hasEnricherPanel() {
      return this.munin.isPanelEnabled("enricher");
    },
    showQualityColumn() {
      return this.hasQualityData && !this.hideQualitySensor;
    },
    qualityFilterActive() {
      // A findings-level filter is engaged → badge count must reflect the filtered
      // findings, not the unfiltered row rollup (gap_count).
      return !!(this.gapSeverityFilter || this.onlySourceGaps);
    },
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("pim.create_product"),
          handler: () => this.$router.push("/pim/products/create"),
        },
      ];
    },
    filterTabs() {
      return [
        { key: "all", label: this.$t("pim.filter_all") },
        { key: "enabled", label: this.$t("pim.filter_enabled") },
        { key: "disabled", label: this.$t("pim.filter_disabled") },
        { key: "no_media", label: this.$t("pim.filter_no_media") },
      ];
    },
    bulkActions() {
      const actions = [
        {
          key: "enable",
          labelKey: "pim.enable_all",
          variant: "primary",
        },
        {
          key: "disable",
          labelKey: "pim.disable_all",
          variant: "danger",
        },
        {
          key: "visibility",
          labelKey: "pim.change_visibility",
          options: [
            { label: this.$t("pim.vis_catalog_search"), value: 4 },
            { label: this.$t("pim.vis_not_visible"), value: 1 },
            { label: this.$t("pim.vis_catalog"), value: 2 },
            { label: this.$t("pim.vis_search"), value: 3 },
          ],
        },
      ];
      if (this.hasEnricherPanel) {
        actions.push({
          key: "send_to_enrichment",
          labelKey: "enrichment.spawn.send_selected",
          variant: "secondary",
        });
      }
      if (this.translatorAvailable) {
        actions.push({
          key: "translate",
          labelKey: "pim.translate",
          variant: "primary",
        });
      }
      return actions;
    },
    columns() {
      const cols = [
        { key: "thumbnail", label: "", sortable: false, width: "60px", priority: 2 },
        { key: "sku", label: "SKU", sortable: true, width: "180px", priority: 2 },
        {
          key: "name",
          label: this.$t("pim.name"),
          sortable: false,
          width: "2fr",
          truncate: true,
          title: (row) => row.name || row.sku,
        },
        {
          key: "product_class_name",
          label: this.$t("pim.product_class"),
          sortable: false,
          width: "120px",
          priority: 2,
        },
        {
          key: "visibility",
          label: this.$t("pim.visibility"),
          sortable: true,
          width: "1fr",
          priority: 2,
        },
        {
          key: "is_enabled",
          label: this.$t("pim.status"),
          sortable: true,
          width: "100px",
        },
      ];
      if (this.showQualityColumn) {
        cols.push({
          key: "quality",
          label: this.$t("pim.quality_column"),
          sortable: true,
          width: "130px",
          priority: 2,
        });
      }
      if (this.hasSuppliersPanel) {
        cols.push({
          key: "supplier_status",
          label: this.$t("pim.tab_supplier"),
          sortable: false,
          width: "110px",
          priority: 2,
        });
      }
      return cols;
    },
    visibilityOptions() {
      return [
        { value: null, label: this.$t("pim.all_visibilities") },
        { value: 1, label: this.$t("pim.vis_not_visible") },
        { value: 2, label: this.$t("pim.vis_catalog") },
        { value: 3, label: this.$t("pim.vis_search") },
        { value: 4, label: this.$t("pim.vis_catalog_search") },
      ];
    },
    productClassOptions() {
      return [
        { value: null, label: this.$t("pim.all_classes") },
        { value: 1, label: this.$t("pim.type_simple") },
        { value: 2, label: this.$t("pim.type_configurable") },
        { value: 3, label: this.$t("pim.type_bundle") },
      ];
    },
    categoryOptions() {
      return [
        { value: null, label: this.$t("pim.all_categories") },
        ...this.categories.map((c) => ({ value: c.idx, label: c.name })),
      ];
    },
    dropdownFilterCount() {
      let count = Object.keys(this.attributeFilters).length;
      if (this.activeFilter !== "all") count++;
      if (this.visibilityFilter) count++;
      if (this.productClassFilter) count++;
      if (this.categoryFilter) count++;
      if (this.gapSeverityFilter) count++;
      if (this.onlySourceGaps) count++;
      return count;
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
  },
  watch: {
    "pimChannel.activeChannelIdx"() {
      this.attributeFilters = {};
      this.fetchCategories();
      this.fetchFilterableFeatures();
      this.fetchProducts();
    },
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchProducts();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchCategories();
    this.fetchFilterableFeatures();
    this.fetchProducts();
  },
  methods: {
    async fetchProducts() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;

        if (this.activeFilter === "enabled") {
          params.is_enabled = true;
        } else if (this.activeFilter === "disabled") {
          params.is_enabled = false;
        } else if (this.activeFilter === "no_media") {
          params.has_media = false;
        }

        if (this.visibilityFilter) params.visibility = this.visibilityFilter;
        if (this.productClassFilter)
          params.product_class = this.productClassFilter;
        if (this.categoryFilter) params.category = this.categoryFilter;
        if (this.gapSeverityFilter) params.gap_severity = this.gapSeverityFilter;

        for (const [featureIdx, attrIdx] of Object.entries(
          this.attributeFilters
        )) {
          params[`attr_${featureIdx}`] = attrIdx;
        }

        const { data } = await GET_Products(this.channelIdx, params);
        this.products = data.results || [];
        this.totalCount = data.count || 0;
        this.hasQualityData = this.products.some(hasQualityFields);
        this.fetchSupplierStatuses();
        this.fetchQualityFindings();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async fetchCategories() {
      try {
        const { data } = await GET_Categories(this.channelIdx, {
          page_size: 100,
        });
        this.categories = data.results || [];
      } catch {
        this.categories = [];
      }
    },
    async fetchFilterableFeatures() {
      try {
        const { data } = await GET_Features(
          { is_filterable: true, page_size: 50 },
          this.channelIdx
        );
        const selectFeatures = (data.results || []).filter(
          (f) => f.feature_type === 7 || f.feature_type === 8
        );
        const features = [];
        for (const feat of selectFeatures) {
          try {
            const { data: attrData } = await GET_FeatureAttributes(
              feat.idx,
              this.channelIdx
            );
            features.push({
              idx: feat.idx,
              name: feat.name || feat.idx,
              attributes: (attrData.results || attrData || []).map((a) => ({
                idx: a.idx,
                name: a.name || a.idx,
              })),
            });
          } catch {
            // skip features whose attributes can't be loaded
          }
        }
        this.filterableFeatures = features;
      } catch {
        this.filterableFeatures = [];
      }
    },
    featureFilterOptions(feat) {
      return [
        { label: this.$t("pim.filter_all"), value: null },
        ...feat.attributes.map((a) => ({ label: a.name, value: a.idx })),
      ];
    },
    onVisibilitySelect(val) {
      this.visibilityFilter = val;
      this.currentPage = 1;
      this.fetchProducts();
    },
    onProductClassSelect(val) {
      this.productClassFilter = val;
      this.currentPage = 1;
      this.fetchProducts();
    },
    onCategorySelect(val) {
      this.categoryFilter = val;
      this.currentPage = 1;
      this.fetchProducts();
    },
    onAttributeFilter(featureIdx, val) {
      if (val) {
        this.attributeFilters = { ...this.attributeFilters, [featureIdx]: val };
      } else {
        const { [featureIdx]: _, ...rest } = this.attributeFilters;
        this.attributeFilters = rest;
      }
      this.currentPage = 1;
      this.fetchProducts();
    },
    clearAllDropdownFilters() {
      this.activeFilter = "all";
      this.visibilityFilter = null;
      this.productClassFilter = null;
      this.categoryFilter = null;
      this.attributeFilters = {};
      this.gapSeverityFilter = null;
      this.onlySourceGaps = false;
      this.currentPage = 1;
      this.fetchProducts();
    },
    setFilter(key) {
      this.activeFilter = key;
      this.currentPage = 1;
      this.fetchProducts();
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchProducts();
    },
    onSort({ key, direction }) {
      if (
        !key ||
        key === "thumbnail" ||
        key === "product_class_name" ||
        key === "name"
      ) {
        this.ordering = null;
      } else if (key === "quality") {
        // List sorts on the rollup column, not the synthetic "quality" key.
        this.ordering = direction === "desc" ? "-gap_worst_severity" : "gap_worst_severity";
      } else {
        this.ordering = direction === "desc" ? `-${key}` : key;
      }
      this.fetchProducts();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onSelect(selected) {
      this.selectedProducts = selected;
    },
    onRowClick(row) {
      this.$router.push(`/pim/products/${row.sku}`);
    },
    async fetchSupplierStatuses() {
      if (!this.hasSuppliersPanel || !this.products.length) {
        this.supplierStatusMap = {};
        return;
      }
      const skus = this.products.map((p) => p.sku).filter(Boolean);
      if (!skus.length) return;
      try {
        const { data } = await GET_BulkHasChanges(skus);
        this.supplierStatusMap = data?.skus || {};
      } catch {
        this.supplierStatusMap = {};
      }
    },
    onSupplierBadgeClick(sku) {
      this.$router.push(`/pim/products/${sku}#supplier`);
    },
    async fetchQualityFindings() {
      if (!this.hasQualityData || !this.products.length || this.hideQualitySensor) {
        this.qualityMap = {};
        return;
      }
      const pks = this.products.map((p) => p.pk).filter((pk) => pk != null);
      if (!pks.length) {
        this.qualityMap = {};
        return;
      }
      try {
        const { data } = await GET_BulkProductGaps(
          this.channelIdx,
          pks,
          findingsParams({
            severity: this.gapSeverityFilter,
            onlySource: this.onlySourceGaps,
          })
        );
        this.qualityMap = data?.results || {};
      } catch {
        // Soft-compat: old PIM has no findings endpoint (404) → no inline labels, no error.
        this.qualityMap = {};
      }
    },
    toggleQualitySensor() {
      this.hideQualitySensor = !this.hideQualitySensor;
      try {
        localStorage.setItem(HIDE_QUALITY_KEY, this.hideQualitySensor ? "1" : "0");
      } catch {
        // storage unavailable (private mode) — toggle still works for the session
      }
      if (!this.hideQualitySensor) this.fetchQualityFindings();
    },
    toggleOnlyCritical() {
      this.gapSeverityFilter = this.gapSeverityFilter === "critical" ? null : "critical";
      this.currentPage = 1;
      this.fetchProducts();
    },
    toggleOnlySource() {
      // Affects inline labels only (no list-level backend param) — re-hydrate findings.
      this.onlySourceGaps = !this.onlySourceGaps;
      this.fetchQualityFindings();
    },
    qualityState(row) {
      return gapRowState(row);
    },
    qualityVariant(row) {
      return gapBadgeVariant(row.gap_worst_severity);
    },
    qualityFindings(row) {
      return this.qualityMap[String(row.pk)] || [];
    },
    gapLabel(finding) {
      return resolveGapLabel(finding, getLang());
    },
    clearSelection() {
      this.selectedProducts = [];
    },
    openTranslateSelected() {
      this.translateEntityIds = this.selectedProducts.map((p) => p.id);
      this.showTranslateDialog = true;
    },
    handleBulkAction(actionKey, value) {
      if (actionKey === "translate") return this.openTranslateSelected();
      if (actionKey === "enable") return this.doBulkUpdate({ is_enabled: true });
      if (actionKey === "disable") return this.doBulkUpdate({ is_enabled: false });
      if (actionKey === "visibility") return this.doBulkUpdate({ visibility: value });
      if (actionKey === "send_to_enrichment") return this.openSpawnDialog();
    },
    // Filter snapshot mirrors fetchProducts() so the spawn dialog can offer a
    // "send all matching current filter" scope (scope_spec mode:filter).
    currentFilterParams() {
      const params = {};
      if (this.search) params.search = this.search;
      if (this.activeFilter === "enabled") params.is_enabled = true;
      else if (this.activeFilter === "disabled") params.is_enabled = false;
      else if (this.activeFilter === "no_media") params.has_media = false;
      if (this.visibilityFilter) params.visibility = this.visibilityFilter;
      if (this.productClassFilter) params.product_class = this.productClassFilter;
      if (this.categoryFilter) params.category = this.categoryFilter;
      for (const [featureIdx, attrIdx] of Object.entries(this.attributeFilters)) {
        params[`attr_${featureIdx}`] = attrIdx;
      }
      return params;
    },
    openSpawnDialog() {
      this.spawnSkus = this.selectedProducts.map((p) => p.sku);
      this.spawnFilterParams = this.currentFilterParams();
      this.showSpawnDialog = true;
    },
    onSpawned() {
      this.selectedProducts = [];
    },
    async doBulkUpdate(fields) {
      const skus = this.selectedProducts.map((p) => p.sku);
      this.loader.loaderStart();
      try {
        await POST_BulkUpdateProducts(this.channelIdx, { skus, ...fields });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.bulk_success", { count: skus.length }),
        });
        this.selectedProducts = [];
        await this.fetchProducts();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    mediaUrl(path) {
      if (!path) return "";
      if (path.startsWith("http")) return path;
      return (process.env.VUE_APP_API_URL || "") + path;
    },
    productClassLabel(name) {
      // etap-12 #24: ProductBase rows previously fell through to "Custom" via missing key.
      const map = {
        productbase: this.$t("pim.type_base"),
        productsimple: this.$t("pim.type_simple"),
        productconfigurable: this.$t("pim.type_configurable"),
        productbundle: this.$t("pim.type_bundle"),
      };
      return map[name?.toLowerCase()] || this.$t("pim.type_custom");
    },
    productClassTone(name) {
      const map = {
        productbase: "neutral",
        productsimple: "accent",
        productconfigurable: "accent",
        productbundle: "warning",
      };
      return map[name?.toLowerCase()] || "neutral";
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.pim-list-layout {
  display: flex;
  flex-direction: column;
}
.product-list__search {
  flex: 0 1 300px;
  min-width: 150px;
}

// Filter groups sit apart (B-59): chips, selects and the quality filters read as three groups.
.product-list__filter-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-right: var(--space-4);
}

// A select shows its label above the box only once it has one to show: the boxes share a baseline, not a centre.
.product-list__filter-group:has(.product-list__filter-dropdown) {
  align-items: flex-end;
}

.product-list__filter-dropdown {
  min-width: 140px;
  max-width: 200px;

  @include max-tablet {
    max-width: none;
  }
}

.product-list__gaps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.product-list__gap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-200);
}

.product-list__gap-inherited {
  font-style: italic;
}

.product-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-base);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-raised);

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__placeholder {
    font-size: var(--fs-300);
  }
}
</style>
