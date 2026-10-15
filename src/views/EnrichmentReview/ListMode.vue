<template>
  <div class="list-mode">
    <!-- Bulk acts on the whole filtered set (server-side) — the API takes a filter, not row ids.
         Accept/reject target the pending set; undo (etap-09) targets the applied set. Honest to the
         backend contract. -->
    <div
      v-if="bulk && totalCount > 0 && (actionableFilter || undoableFilter)"
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

    <div v-if="rows.length" class="flex jc-fe mb-3">
      <BasicButton variant="ghost" size="sm" data-testid="enrichment-more-columns" @click="moreColumns = !moreColumns">
        {{ moreColumns ? $t("enrichment.review.fewer_columns") : $t("enrichment.review.more_columns") }}
      </BasicButton>
    </div>

    <DataTable
      empty-size="md"
      v-show="!loading"
      :columns="columns"
      :rows="rows"
      row-key="id"
      :empty-text="$t('enrichment.review.empty')"
      @row-click="(row) => $emit('row-open', row)"
    >
      <template #empty>
        <slot name="empty">
          <EmptyState icon="enrich" :title="$t('enrichment.review.empty')" :message="$t('enrichment.review.empty_message')" />
        </slot>
      </template>
      <template #cell-product="{ row }">
        <div class="list-mode__product flex-column">
          <!-- PIM subject: open the product preview drawer (stop the row → detail click). -->
          <BasicButton
            v-if="isPimRow(row)"
            variant="ghost"
            size="sm"
            class="list-mode__sku"
            :data-testid="`enrichment-subject-${row.id}`"
            @click.stop="$emit('preview-product', row)"
          >
            {{ row.subject_ref }}
          </BasicButton>
          <a
            v-else-if="row.subject_url"
            :href="safeHref(row.subject_url)"
            target="_blank"
            rel="noopener noreferrer"
            class="list-mode__link t-accent"
            :data-testid="`enrichment-subject-${row.id}`"
            @click.stop
            >{{ row.subject_ref }}</a
          >
          <span v-else class="fw-600">{{ row.subject_ref }}</span>
          <span v-if="row.subject_label && row.subject_label !== row.subject_ref" class="list-mode__name fs-200 t-secondary">
            {{ row.subject_label }}
          </span>
        </div>
      </template>
      <template #cell-field="{ row }">
        <span class="flex ai-ct gap-2">
          <span class="list-mode__field">{{ proposalField(row) }}</span>
          <Tag v-if="row.target_locator?.language" :label="row.target_locator.language.toUpperCase()" />
        </span>
      </template>
      <template #cell-change="{ row }">
        <ChangeSummary :proposal="row" :rules="rulesOf(row)" />
      </template>
      <template #cell-status="{ value }">
        <StatusBadge :label="$t(`enrichment.status.${value}`)" :tone="statusVariant(value)" />
      </template>
      <template #cell-confidence="{ value }">
        <span class="fs-200">{{ formatConfidence(value) }}</span>
      </template>
      <template #cell-source="{ row }">
        <span class="fs-200 t-secondary">{{ workerOf(row.source) || row.source || "—" }}</span>
      </template>
      <template #cell-age="{ row }">
        <span class="fs-200 t-muted" :title="formatDate(row.created_at)">{{ formatRelative(row.created_at) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex ai-ct gap-2" @click.stop>
          <template v-if="isActionable(row)">
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
              mutates
              :disabled="busy"
              :data-testid="`enrichment-accept-${row.id}`"
              @click="$emit('accept', row)"
            >
              {{ $t('enrichment.review.apply') }}
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
          </template>
          <IconButton
            icon="next"
            size="sm"
            :label="$t('enrichment.review.open')"
            :data-testid="`enrichment-open-${row.id}`"
            @click="$emit('row-open', row)"
          />
        </div>
      </template>
    </DataTable>


  </div>
</template>

<script>
import { formatDate, formatRelative } from "@/utils/format";
import { safeHref } from "@/utils/safeHref";
import ChangeSummary from "./ChangeSummary.vue";
import { textRules, workerOf } from "./reviewLogic";
import { useFieldLabels } from "./useFieldLabels";

// Technical columns, usually empty or only for diagnosis: behind "More columns".
const TECHNICAL = ["target_module", "target_kind", "source", "batch_id"];

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
  components: { ChangeSummary },
  setup() {
    return useFieldLabels();
  },
  data() {
    return { moreColumns: false };
  },
  props: {
    rows: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    totalCount: { type: Number, default: 0 },
    // Off when the list is filtered by something the bulk API cannot take (a task): bulk would reach beyond it.
    bulk: { type: Boolean, default: true },
  },
  emits: [
    "accept",
    "reject",
    "bulk-accept",
    "bulk-reject",
    "bulk-undo",
    "reconfirm",
    "row-open",
    "preview-product",
  ],
  computed: {
    // One line per proposal: product, field + language, the change in brief, status, age, quick actions. Confidence
    // shows only when some row has one; module, kind, source and batch only on "More columns".
    columns() {
      const t = (key) => this.$t(`enrichment.review.col.${key}`);
      const all = [
        { key: "product", label: t("product"), width: "minmax(140px, 1fr)" },
        { key: "field", label: t("field"), width: "minmax(150px, auto)", priority: 2 },
        { key: "change", label: t("change"), width: "minmax(280px, 3fr)", priority: 2 },
        { key: "status", label: t("status"), width: "110px" },
        { key: "confidence", label: t("confidence"), width: "90px", priority: 2 },
        { key: "target_module", label: t("module"), width: "90px", priority: 3 },
        { key: "target_kind", label: t("kind"), width: "120px", priority: 3 },
        { key: "source", label: t("source"), width: "160px", priority: 3 },
        { key: "batch_id", label: t("batch"), width: "120px", priority: 3 },
        { key: "age", label: t("age"), width: "100px", priority: 2 },
        { key: "actions", label: "", actions: true },
      ];
      return all.filter((col) => this.showColumn(col.key));
    },
    hasConfidence() {
      return this.rows.some((r) => r.confidence != null && r.confidence !== "");
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
    formatRelative,
    workerOf,
    showColumn(key) {
      if (TECHNICAL.includes(key)) return this.moreColumns;
      if (key === "confidence") return this.moreColumns || this.hasConfidence;
      return true;
    },
    rulesOf(row) {
      const idx = row.target_locator?.feature_idx;
      return textRules(idx, this.feature(idx));
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
.list-mode__product {
  min-width: 0;
}
.list-mode__sku {
  align-self: flex-start;
}
.list-mode__name,
.list-mode__field {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.list-mode__link {
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
</style>
