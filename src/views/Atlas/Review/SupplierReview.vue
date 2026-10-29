<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('atlas.review.title')" />
    </template>
    <template #toolbar>
      <div class="flex ai-ct gap-5 flex-wrap">
        <SegmentedControl
          v-model="activeMode"
          :options="modeOptions"
          :aria-label="$t('atlas.review.mode_label')"
          data-testid="review-mode-switch"
        />
        <BasicInput
          v-model="filters.search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="review-search"
          data-testid="review-search-input"
          @input="onSearchChange"
        />
        <BasicSelect
          :floating-label="$t('atlas.review.list.col.supplier')"
          :options="supplierFilterOptions"
          :model-value="filters.supplier"
          class="review-supplier-filter"
          data-testid="review-supplier-filter"
          @update:model-value="onSupplierChange"
        />
      </div>
      <div
        v-if="activeMode !== 'events' && activeMode !== 'updated'"
        class="filter-chip-row mt-5"
        role="group"
        :aria-label="$t('atlas.filter.status')"
      >
        <FilterChip
          v-for="opt in statusOptions"
          :key="opt.value"
          :label="opt.label"
          :active="filters.status === opt.value"
          :data-testid="`review-status-${opt.value}`"
          @click="onStatusChange(opt.value)"
        />
      </div>
    </template>

    <SwipeMode
      v-if="activeMode === 'swipe'"
      :filters="filters"
      :kind="kind"
      @reviewed="onReviewed"
    />
    <ListMode v-else-if="activeMode === 'list'" :filters="filters" :kind="kind" />
    <EventsMode v-else-if="activeMode === 'events'" :filters="filters" />
    <UpdatedMode v-else :filters="filters" :kind="kind" />
  </PageLayout>
</template>

<script>
import { defineAsyncComponent } from "vue";
import SwipeMode from "./SwipeMode.vue";
import ListMode from "./ListMode.vue";
import EventsMode from "./EventsMode.vue";
import { GET_Suppliers } from "@/api/atlas/api";

const UpdatedMode = defineAsyncComponent(() => import("./UpdatedMode.vue"));

export default {
  name: "SupplierReview",
  components: { SwipeMode, ListMode, EventsMode, UpdatedMode },
  props: {
    kind: { type: String, default: "procurement" },
  },
  data() {
    return {
      activeMode: this.$route.query.mode || "swipe",
      suppliers: [],
      filters: {
        supplier: this.$route.query.supplier || "__all",
        status: "queued",
        search: "",
      },
      searchTimer: null,
    };
  },
  computed: {
    modeOptions() {
      return [
        { value: "swipe", label: this.$t("atlas.review.modes.swipe"), testid: "review-mode-swipe" },
        { value: "list", label: this.$t("atlas.review.modes.list"), testid: "review-mode-list" },
        { value: "events", label: this.$t("atlas.review.modes.events"), testid: "review-mode-events" },
        { value: "updated", label: this.$t("atlas.review.modes.updated"), testid: "review-mode-updated" },
      ];
    },
    statusOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        { value: "new", label: this.$t("atlas.review.status.new") },
        { value: "queued", label: this.$t("atlas.review.status.queued") },
        { value: "approved", label: this.$t("atlas.review.status.approved") },
        { value: "rejected", label: this.$t("atlas.review.status.rejected") },
        { value: "pushed", label: this.$t("atlas.review.status.pushed") },
      ];
    },
    supplierFilterOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        ...this.suppliers.map((s) => ({ value: s.idx, label: s.name || s.idx })),
      ];
    },
  },
  watch: {
    activeMode(val) {
      this.$router.replace({
        path: this.$route.path,
        query: { ...this.$route.query, mode: val },
      });
    },
  },
  mounted() {
    this.fetchSuppliers();
  },
  methods: {
    async fetchSuppliers() {
      try {
        const { data } = await GET_Suppliers({ page_size: 100 });
        this.suppliers = data.results || [];
      } catch (err) {
        // soft-fail; supplier filter will show only "__all"
        this.suppliers = [];
      }
    },
    onSupplierChange(val) {
      this.filters = { ...this.filters, supplier: val };
    },
    onStatusChange(val) {
      this.filters = { ...this.filters, status: val };
    },
    onSearchChange() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.filters = { ...this.filters };
      }, 300);
    },
    onReviewed() {
      // Bubble-up hook (e.g. global counter); SwipeMode advances internally.
    },
  },
};
</script>

<style lang="scss" scoped>
.review-search {
  min-width: 180px;
  max-width: 280px;
}
.review-supplier-filter {
  min-width: 180px;
}
</style>
