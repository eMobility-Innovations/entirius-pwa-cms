<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('atlas.duplicates.title')" />
    </template>
      <p class="fs-300 t-body mb-10">
        {{ $t("atlas.duplicates.subtitle") }}
      </p>

      <Loader block v-show="loading" />

      <EmptyState
        v-if="!loading && groups.length === 0"
        :title="$t('atlas.duplicates.empty_title')"
        :message="$t('atlas.duplicates.empty_message')"
        icon="duplicate"
      />

      <BasicCard
        v-for="group in groups"
        :key="group.ean"
        class="duplicates-group mb-8"
      >
        <div class="flex ai-ct jc-sb mb-8 gap-5">
          <div>
            <p class="fs-200 t-muted fw-600">
              {{ $t("atlas.duplicates.col.ean") }}
            </p>
            <p class="fs-500 fw-600">{{ group.ean }}</p>
          </div>
          <StatusBadge
            :label="suggestionLabel(group.suggestion)"
            :tone="suggestionVariant(group.suggestion)"
            :data-testid="`duplicates-suggestion-${group.ean}`"
          />
        </div>
        <p class="fs-200 t-secondary mb-8">{{ group.suggestion_detail }}</p>

        <DataTable :columns="columns" :rows="group.realproducts" row-key="sku">
          <template #cell-sku="{ value }">
            <span class="fw-600">{{ value }}</span>
          </template>
          <template #cell-sources="{ row }">
            <div class="flex ai-ct flex-wrap gap-2">
              <StatusBadge
                v-for="s in row.sources"
                :key="s.idx"
                :label="s.is_primary ? `★ ${s.name || s.idx}` : (s.name || s.idx)"
                :tone="s.is_primary ? 'positive' : 'neutral'"
              />
            </div>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex ai-ct flex-wrap jc-fe gap-2">
              <BasicButton
                v-for="other in otherRps(group, row)"
                size="sm"
                variant="secondary"
                :key="other.sku"
                :data-testid="`duplicates-merge-${row.sku}-to-${other.sku}`"
                @click="openMergeModal(other.sku, row.sku)"
              >
                {{ $t('atlas.duplicates.action.merge_to', { sku: other.sku }) }}
              </BasicButton>
            </div>
          </template>
        </DataTable>
      </BasicCard>

    <MergeConfirmationModal
      v-if="mergeModal.visible"
      :winner-sku="mergeModal.winnerSku"
      :loser-sku="mergeModal.loserSku"
      @confirmed="onMergeConfirmed"
      @cancelled="closeMergeModal"
    />
  </PageLayout>
</template>

<script>
import { GET_Duplicates } from "@/api/atlas/api";
import MergeConfirmationModal from "@/views/Atlas/components/MergeConfirmationModal.vue";
import { useMuninStore } from "@/stores/munin";
import { useNotifyStore } from "@/stores/notify";

export default {
  name: "Duplicates",
  components: { MergeConfirmationModal },
  data() {
    return {
      groups: [],
      loading: false,
      mergeModal: {
        visible: false,
        winnerSku: "",
        loserSku: "",
      },
    };
  },
  computed: {
    // One column set for every EAN group, so SKU, suppliers and actions line up from group to group. The suppliers
    // (★ = primary) stay on a phone: they tell which way to merge.
    columns() {
      return [
        { key: "sku", label: this.$t("atlas.duplicates.col.sku"), width: "1fr", truncate: true },
        { key: "weight", label: this.$t("atlas.duplicates.col.weight"), width: "100px", numeric: true, priority: 2 },
        { key: "sources", label: this.$t("atlas.duplicates.col.suppliers"), width: "1fr" },
        { key: "actions", label: this.$t("atlas.duplicates.col.actions"), width: "280px", actions: true },
      ];
    },
    hasSuppliersPanel() {
      return useMuninStore().isPanelEnabled("atlas");
    },
  },
  mounted() {
    if (!this.hasSuppliersPanel) {
      this.$router.push("/");
      return;
    }
    this.fetch();
  },
  methods: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await GET_Duplicates({ tolerance_pct: 10 });
        this.groups = data?.results || [];
      } catch (err) {
        this.groups = [];
        console.error("Duplicates fetch failed", err);
      } finally {
        this.loading = false;
      }
    },
    suggestionLabel(suggestion) {
      return this.$t(`atlas.duplicates.suggestion.${suggestion}`);
    },
    suggestionVariant(suggestion) {
      return suggestion === "merge" ? "positive" : "warning";
    },
    otherRps(group, currentRp) {
      return group.realproducts.filter((rp) => rp.sku !== currentRp.sku);
    },
    openMergeModal(winnerSku, loserSku) {
      this.mergeModal = { visible: true, winnerSku, loserSku };
    },
    closeMergeModal() {
      this.mergeModal = { visible: false, winnerSku: "", loserSku: "" };
    },
    onMergeConfirmed(payload) {
      const notify = useNotifyStore();
      notify.spawnNotification({
        type: "positive",
        msg: this.$t("atlas.duplicates.merge_modal.success", {
          winner: payload.winner_sku,
          loser: payload.loser_sku,
          n: payload.links_redirected,
        }),
      });
      this.closeMergeModal();
      this.fetch();
    },
  },
};
</script>
