<template>
  <section class="run-proposals flex-column gap-5" aria-labelledby="run-proposals-title" data-testid="run-proposals">
    <div class="flex ai-ct jc-sb flex-wrap gap-3">
      <h2 id="run-proposals-title" class="run-proposals__heading m-0">
        {{ $t("enrichment.ai.to_review") }}
        <CountBadge v-if="count" :count="count" />
      </h2>
      <BatchCorrection v-if="count" :task-id="task.id" @queued="load" />
    </div>

    <EmptyState
      v-if="!loading && !rows.length"
      icon="enrich"
      size="md"
      :title="$t('enrichment.ai.filtered_empty')"
      data-testid="run-proposals-empty"
    />
    <ProductMode
      v-else
      :rows="rows"
      :loading="loading"
      :busy="busy"
      @accept="accept"
      @reject="reject"
      @updated="replace"
      @preview-product="(row) => (previewSku = row.subject_ref)"
    />
    <router-link
      v-if="count > rows.length"
      :to="{ name: 'EnrichmentReview', query: { task: String(task.id) } }"
      class="run-proposals__all t-accent fw-600"
      data-testid="run-proposals-all"
    >
      {{ $t("enrichment.runs.show_all", { count }) }}
    </router-link>

    <ProductPreviewDrawer
      :visible="!!previewSku"
      :sku="previewSku"
      :channel-idx="pimChannel.activeChannelIdx"
      @close="previewSku = null"
    />
    <DriftModal :visible="!!drifted" :proposal="drifted" :busy="busy" @confirm="confirmDrift" @reject="rejectDrift" @close="drifted = null" />
  </section>
</template>

<script>
import { ref } from "vue";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_Proposals } from "@/api/enrichment/api";
import BatchCorrection from "./BatchCorrection.vue";
import DriftModal from "./DriftModal.vue";
import ProductMode from "./ProductMode.vue";
import ProductPreviewDrawer from "./ProductPreviewDrawer.vue";
import { useProposalActions } from "./useProposalActions";

const MAX_CARDS = 50;

// What a finished run proposed, reviewed where the run is listed (Runs): its pending proposals as cards by product —
// Apply, Edit, Reject, a product's preview, "Correct all" for the whole run. More than MAX_CARDS: a link to the run
// in Proposals. A reviewed card leaves the list; `changed` tells the page its counts moved.
export default {
  name: "RunProposals",
  components: { BatchCorrection, DriftModal, ProductMode, ProductPreviewDrawer },
  props: {
    task: { type: Object, required: true },
  },
  emits: ["changed"],
  setup(_props, { emit }) {
    const rows = ref([]);
    const count = ref(0);
    const drop = (proposal) => {
      rows.value = rows.value.filter((row) => row.id !== proposal.id);
      count.value = Math.max(0, count.value - 1);
    };
    const actions = useProposalActions({ onApplied: drop, onRejected: drop, afterAction: () => emit("changed") });
    return { ...actions, rows, count, notify: useNotifyStore(), pimChannel: usePimChannelStore() };
  },
  data() {
    return { loading: false, previewSku: null };
  },
  watch: {
    "task.id": { immediate: true, handler: "load" },
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const { data } = await GET_Proposals({ task: this.task.id, status: "pending", page_size: MAX_CARDS });
        this.rows = data.results || [];
        this.count = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
    replace(proposal) {
      this.rows = this.rows.map((row) => (row.id === proposal.id ? proposal : row));
    },
  },
};
</script>

<style lang="scss" scoped>
.run-proposals__heading {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-secondary);
}
.run-proposals__all {
  align-self: flex-start;
}
</style>
