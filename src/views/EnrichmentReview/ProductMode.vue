<template>
  <div class="product-mode flex-column gap-8">
    <Loader v-if="loading" block />

    <EmptyState
      v-else-if="!groups.length"
      icon="enrich"
      :title="$t('enrichment.review.empty')"
      :message="$t('enrichment.review.empty_message')"
    />

    <BasicCard
      v-for="group in loading ? [] : groups"
      :key="group.subjectRef"
      :title="group.label"
      gap
      data-testid="enrichment-product-group"
    >
      <template #actions>
        <BasicButton
          variant="ghost"
          size="sm"
          data-testid="enrichment-product-source"
          @click="toggleSource(group)"
        >
          {{ $t("enrichment.review.shop_data") }}
        </BasicButton>
        <BasicButton variant="ghost" size="sm" @click="$emit('preview-product', group.proposals[0])">
          {{ $t("enrichment.preview.title") }}
        </BasicButton>
        <BasicButton
          size="sm"
          mutates
          :disabled="busy"
          data-testid="enrichment-accept-product"
          @click="$emit('accept-product', group)"
        >
          {{ $t("enrichment.review.apply_product") }}
        </BasicButton>
      </template>
      <pre
        v-if="sources[group.subjectRef] != null"
        class="product-mode__source m-0 fs-200"
        data-testid="enrichment-product-source-text"
      >{{ sources[group.subjectRef] || "—" }}</pre>
      <div class="flex-column gap-5">
        <ProposalPanel
          v-for="proposal in group.proposals"
          :key="proposal.id"
          :proposal="proposal"
          :task="tasks[proposal.task_id] || null"
          :busy="busy"
          @accept="(p) => $emit('accept', p)"
          @reject="(payload) => $emit('reject', payload)"
          @updated="(p) => $emit('updated', p)"
        />
      </div>
    </BasicCard>
  </div>
</template>

<script>
import { GET_Task } from "@/api/enrichment/api";
import { loadSource } from "./productSource";
import ProposalPanel from "./ProposalPanel.vue";
import { groupBySubject } from "./reviewLogic";

// The product view of the review: the loaded proposals grouped by product (subject_ref), one card per field and
// language, stacked. The tasks behind them are loaded once each — a translation task names its source language.
export default {
  name: "EnrichmentProductMode",
  components: { ProposalPanel },
  props: {
    rows: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
  },
  emits: ["accept", "accept-product", "reject", "updated", "preview-product"],
  data() {
    return { tasks: {}, sources: {} };
  },
  computed: {
    groups() {
      return groupBySubject(this.rows);
    },
  },
  watch: {
    rows: { immediate: true, handler: "loadTasks" },
  },
  methods: {
    async loadTasks() {
      const ids = [...new Set(this.rows.map((r) => r.task_id))].filter((id) => id != null && !(id in this.tasks));
      await Promise.all(ids.map((id) => this.loadTask(id)));
    },
    // Loaded on demand: a page of products must not cost a product read each.
    async toggleSource(group) {
      const { subjectRef, proposals } = group;
      if (this.sources[subjectRef] != null) {
        this.sources[subjectRef] = null;
        return;
      }
      this.sources[subjectRef] = await loadSource(proposals[0]);
    },
    async loadTask(id) {
      try {
        const { data } = await GET_Task(id);
        this.tasks[id] = data;
      } catch {
        this.tasks[id] = null;
      }
    },
  },
};
</script>

<style scoped>
.product-mode__source {
  white-space: pre-wrap;
  max-height: 16rem;
  overflow: auto;
}
</style>
