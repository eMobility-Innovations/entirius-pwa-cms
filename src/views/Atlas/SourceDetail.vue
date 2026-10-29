<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="headerLabel" back="/atlas/list">
        <template v-if="tabActions.length" #actions>
          <ActionBar :actions="tabActions" />
        </template>
      </PageHeader>
    </template>
    <template v-if="supplier" #toolbar>
      <BasicTabs
        :model-value="visibleTab"
        :id-prefix="TAB_PREFIX"
        :options="tabOptions"
        data-testid="suppliers-detail-tabs"
        @update:model-value="activeTab = $event"
      />
    </template>

    <Loader block v-if="loading" />
    <EmptyState
      v-else-if="!supplier"
      icon="empty"
      :title="$t('atlas.detail_not_found')"
    />
    <div
      v-else
      :id="`${TAB_PREFIX}-panel-${visibleTab}`"
      role="tabpanel"
      :aria-labelledby="`${TAB_PREFIX}-tab-${visibleTab}`"
    >
      <component
        :is="TAB_COMPONENTS[visibleTab]"
        :supplier="supplier"
        @header-actions="tabActions = $event"
      />
    </div>
  </PageLayout>
</template>

<script>
import OverviewTab from "./tabs/OverviewTab.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import FeedsTab from "./tabs/FeedsTab.vue";
import MappingsTab from "./tabs/MappingsTab.vue";
import ProductsTab from "./tabs/ProductsTab.vue";
import LinkedTab from "./tabs/LinkedTab.vue";
import LogsTab from "./tabs/LogsTab.vue";
import { useNotifyStore } from "@/stores/notify";
// GET_Source, not the supplier facade — the list shows every kind, and a
// monitoring/enrichment source opened from it would 404 on /suppliers/{idx}/.
import { GET_Source } from "@/api/atlas/api";

const TABS = ["overview", "feeds", "mappings", "products", "linked", "logs"];
const TAB_PREFIX = "atlas-source";
const TAB_COMPONENTS = {
  overview: "OverviewTab",
  feeds: "FeedsTab",
  mappings: "MappingsTab",
  products: "ProductsTab",
  linked: "LinkedTab",
  logs: "LogsTab",
};

export default {
  name: "SourceDetail",
  components: {
    OverviewTab,
    FeedsTab,
    MappingsTab,
    ProductsTab,
    LinkedTab,
    LogsTab,
  },
  setup() {
    return { notify: useNotifyStore(), TAB_PREFIX, TAB_COMPONENTS };
  },
  data() {
    return {
      supplier: null,
      loading: false,
      // PageHeader actions of the open tab (OverviewTab's Save): the tab emits them, and [] when it unmounts.
      tabActions: [],
      activeTab:
        this.$route.query.tab && TABS.includes(this.$route.query.tab)
          ? this.$route.query.tab
          : "overview",
    };
  },
  computed: {
    supplierIdx() {
      return this.$route.params.idx;
    },
    headerLabel() {
      if (!this.supplier) return this.supplierIdx;
      return `${this.supplier.name} (${this.supplier.idx})`;
    },
    isMonitoringSupplier() {
      return this.supplier?.kind === "monitoring";
    },
    tabOptions() {
      // Mappings only run at push time — monitoring suppliers never push, so the tab is dead.
      const tabs = this.isMonitoringSupplier
        ? TABS.filter((key) => key !== "mappings")
        : TABS;
      return tabs.map((key) => ({
        value: key,
        label: this.$t(`atlas.tabs.${key}`),
        testid: `suppliers-tab-${key}`,
      }));
    },
    visibleTab() {
      // Guard deep-links to a tab hidden for this role (e.g. ?tab=mappings on monitoring).
      const available = this.tabOptions.map((t) => t.value);
      return available.includes(this.activeTab) ? this.activeTab : "overview";
    },
  },
  watch: {
    "$route.params.idx": {
      handler(newIdx) {
        if (newIdx) this.fetchSupplier();
      },
      immediate: false,
    },
    "$route.query.tab"(val) {
      if (val && TABS.includes(val) && val !== this.activeTab) {
        this.activeTab = val;
      }
    },
    activeTab(newTab) {
      if (this.$route.query.tab !== newTab) {
        this.$router.replace({
          path: this.$route.path,
          query: { ...this.$route.query, tab: newTab },
        });
      }
    },
  },
  mounted() {
    this.fetchSupplier();
  },
  methods: {
    async fetchSupplier() {
      this.loading = true;
      try {
        const { data } = await GET_Source(this.supplierIdx);
        this.supplier = data;
      } catch (err) {
        this.supplier = null;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
