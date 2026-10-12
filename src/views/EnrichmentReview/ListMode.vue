<template>
  <div class="list-mode">
    <!-- Bulk acts on the whole filtered set (server-side) — the API takes a filter, not row ids.
         Accept/reject target the pending set; undo (etap-09) targets the applied set. Honest to the
         backend contract. -->
    <div
      v-if="totalCount > 0 && (actionableFilter || undoableFilter)"
      class="list-mode__bulk flex ai-ct gap-5 mb-8 p-5 bg-accent-subtle rounded flex-wrap"
      data-testid="enrichment-bulk-bar"
    >
      <span class="fs-200 t-accent fw-600">
        {{ $t("enrichment.review.bulk.matching", { count: totalCount }) }}
      </span>
      <div class="flex ai-ct gap-2 ml-auto flex-wrap">
        <BasicButton
          v-if="actionableFilter"
          variant="primary"
          :disabled="busy"
          data-testid="enrichment-bulk-accept"
          @click="$emit('bulk-accept')"
        >
          {{ $t('enrichment.review.bulk.accept_all') }}
        </BasicButton>
        <BasicButton
          v-if="actionableFilter"
          variant="danger"
          :disabled="busy"
          data-testid="enrichment-bulk-reject"
          @click="$emit('bulk-reject', '')"
        >
          {{ $t('enrichment.review.bulk.reject_all') }}
        </BasicButton>
        <BasicButton
          v-if="undoableFilter"
          variant="secondary"
          :disabled="busy"
          :title="$t('enrichment.review.undo_hint')"
          data-testid="enrichment-undo"
          @click="$emit('bulk-undo')"
        >
          {{ $t('enrichment.review.undo') }}
        </BasicButton>
      </div>
    </div>

    <Loader block v-show="loading" />

    <DataTable
      empty-size="md"
      v-show="!loading"
      :columns="columns"
      :rows="rows"
      row-key="id"
      :empty-text="$t('enrichment.review.empty')"
      @row-click="(row) => $emit('row-focus', row)"
    >
      <template #cell-subject="{ row }">
        <!-- PIM subject: open the product preview drawer (stop the row → focus click). -->
        <BasicButton
          v-if="isPimRow(row)"
          variant="ghost"
          size="sm"
          :data-testid="`enrichment-subject-${row.id}`"
          @click="$emit('preview-product', row)"
        >
          {{ row.subject_label || row.subject_ref }}
        </BasicButton>
        <a
          v-else-if="row.subject_url"
          :href="safeHref(row.subject_url)"
          target="_blank"
          rel="noopener noreferrer"
          class="list-mode__link t-accent"
          :data-testid="`enrichment-subject-${row.id}`"
          @click.stop
          >{{ row.subject_label || row.subject_ref }}</a
        >
        <span v-else>{{ row.subject_label || row.subject_ref }}</span>
      </template>
      <template #cell-field="{ row }">
        <span class="fs-200 t-secondary">{{ fieldLabel(row) }}</span>
      </template>
      <template #cell-change="{ row }">
        <DiffRenderer
          :target-kind="row.target_kind"
          :proposed="row.proposed_value"
          :current="row.current_snapshot"
          :proposal-id="row.id"
          :subject-label="row.subject_label || row.subject_ref"
        />
      </template>
      <template #cell-status="{ value }">
        <StatusBadge
          :label="$t(`enrichment.status.${value}`)"
          :tone="statusVariant(value)"
        />
      </template>
      <template #cell-confidence="{ value }">
        <span class="fs-200">{{ formatConfidence(value) }}</span>
      </template>
      <template #cell-age="{ row }">
        <span class="fs-200 t-muted">{{ formatDate(row.created_at) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div v-if="isActionable(row)" class="flex ai-ct gap-2">
          <BasicButton
            v-if="row.status === 'drifted'"
            size="sm"
            variant="secondary"
            :disabled="busy"
            :data-testid="`enrichment-reconfirm-${row.id}`"
            @click="$emit('reconfirm', row)"
          >
            {{ $t('enrichment.review.reconfirm') }}
          </BasicButton>
          <BasicButton
            v-else
            size="sm"
            variant="secondary"
            :disabled="busy"
            :data-testid="`enrichment-accept-${row.id}`"
            @click="$emit('accept', row)"
          >
            {{ $t('common.accept') }}
          </BasicButton>
          <BasicButton
            size="sm"
            variant="danger"
            :disabled="busy"
            :data-testid="`enrichment-reject-${row.id}`"
            @click="$emit('reject', { proposal: row, reason: '' })"
          >
            {{ $t('common.reject') }}
          </BasicButton>
        </div>
        <span v-else class="fs-200 t-muted">—</span>
      </template>
    </DataTable>

    <EmptyState
      v-if="!loading && !rows.length"
      icon="enrich"
      :title="$t('enrichment.review.empty')"
      :message="$t('enrichment.review.empty_message')"
    />

  </div>
</template>

<script>
import { formatDate } from "@/utils/format";
import { safeHref } from "@/utils/safeHref";
import DiffRenderer from "./DiffRenderer.vue";

const STATUS_VARIANTS = {
  pending: "info",
  applied: "positive",
  rejected: "negative",
  superseded: "neutral",
  drifted: "warning",
  reverted: "neutral",
};

export default {
  name: "EnrichmentListMode",
  components: { DiffRenderer },
  props: {
    rows: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    totalCount: { type: Number, default: 0 },
  },
  emits: [
    "accept",
    "reject",
    "bulk-accept",
    "bulk-reject",
    "bulk-undo",
    "reconfirm",
    "row-focus",
    "preview-product",
  ],
  computed: {
    columns() {
      return [
        {
          key: "subject",
          label: this.$t("enrichment.review.col.subject"),
          width: "minmax(160px, 1fr)",
        },
        {
          key: "target_module",
          label: this.$t("enrichment.review.col.module"),
          width: "90px",
          priority: 2,
        },
        {
          key: "target_kind",
          label: this.$t("enrichment.review.col.kind"),
          width: "90px",
          priority: 2,
        },
        {
          key: "field",
          label: this.$t("enrichment.review.col.field"),
          width: "130px",
          priority: 2,
        },
        {
          key: "change",
          label: this.$t("enrichment.review.col.change"),
          width: "minmax(360px, 2fr)",
          priority: 2,
        },
        {
          key: "status",
          label: this.$t("enrichment.review.col.status"),
          width: "110px",
        },
        {
          key: "confidence",
          label: this.$t("enrichment.review.col.confidence"),
          width: "90px",
          priority: 2,
        },
        {
          key: "source",
          label: this.$t("enrichment.review.col.source"),
          width: "110px",
          priority: 2,
        },
        {
          key: "batch_id",
          label: this.$t("enrichment.review.col.batch"),
          width: "100px",
          priority: 2,
        },
        {
          key: "age",
          label: this.$t("enrichment.review.col.age"),
          width: "120px",
          priority: 2,
        },
        { key: "actions", label: "", actions: true },
      ];
    },
    // Bulk accept/reject only makes sense when the queue holds pending work.
    actionableFilter() {
      return this.rows.some((r) => r.status === "pending");
    },
    // Bulk undo (etap-09) only makes sense when the view holds applied proposals to revert.
    undoableFilter() {
      return this.rows.some((r) => r.status === "applied");
    },
  },
  methods: {
    formatDate,
    safeHref,
    statusVariant(value) {
      return STATUS_VARIANTS[value] || "neutral";
    },
    isActionable(row) {
      return row.status === "pending" || row.status === "drifted";
    },
    formatConfidence(value) {
      if (value == null || value === "") return "—";
      return `${Math.round(Number(value) * 100)}%`;
    },
    fieldLabel(row) {
      const loc = row.target_locator || {};
      const parts = [loc.feature_idx, loc.language].filter(Boolean);
      return parts.length ? parts.join(" · ") : "—";
    },
    // PIM-targeted proposals carry a product SKU in subject_ref — those get the
    // clickable product preview; other modules fall back to subject_url / plain text.
    isPimRow(row) {
      return (row.target_module || "").includes("pim") && !!row.subject_ref;
    },
  },
};
</script>

<style lang="scss" scoped>
.list-mode__link {
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
</style>
