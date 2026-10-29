<template>
  <section class="sp-timeline-section">
    <header class="sp-timeline-section__head">
      <h3 class="fs-300 fw-600 m-0">
        {{ $t("atlas.products.drawer.timeline_title") }}
      </h3>
      <span v-if="!loading && entries.length" class="fs-200 t-muted">
        {{ $t("atlas.products.drawer.timeline_count", { count: entries.length }) }}
      </span>
    </header>
    <Loader block v-if="loading" />
    <SupplierTimeline v-else :entries="entries" />
  </section>
</template>

<script>
import SupplierTimeline from "@/views/Pim/components/supplier/SupplierTimeline.vue";
import { GET_SkuChanges } from "@/api/atlas/api";

export default {
  name: "SupplierProductTimelineSection",
  components: { SupplierTimeline },
  props: {
    sku: { type: String, required: true },
  },
  data() {
    return {
      entries: [],
      loading: false,
    };
  },
  watch: {
    sku: {
      immediate: true,
      handler(val) {
        if (val) this.fetchEntries(val);
        else this.entries = [];
      },
    },
  },
  methods: {
    async fetchEntries(sku) {
      this.loading = true;
      try {
        const { data } = await GET_SkuChanges(sku, { page_size: 100 });
        this.entries = data?.changes || [];
      } catch (err) {
        this.entries = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.sp-timeline-section {
  margin-top: var(--space-8);
  padding-top: var(--space-8);
  border-top: 1px solid var(--border-subtle);
}
.sp-timeline-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  margin-bottom: var(--space-2);
}
</style>
