<template>
  <div class="list-mode">
    <!-- Bulk acts on the whole filtered set (server-side) — the API takes a filter, not row ids. Apply/reject
         target the pending set, undo the applied set: the bar shows only when the list holds one of them, so its
         count is what the action reaches. The page asks to confirm before any of them runs. -->
    <div v-if="rows.length" class="flex ai-ct flex-wrap gap-3 mb-3">
      <BasicButton variant="ghost" size="sm" data-testid="enrichment-more-columns" @click="moreColumns = !moreColumns">
        {{ moreColumns ? $t("enrichment.review.fewer_columns") : $t("enrichment.review.more_columns") }}
      </BasicButton>
      <div
        v-if="bulk && (actionableFilter || undoableFilter)"
        class="flex ai-ct gap-2 ml-auto flex-wrap"
        data-testid="enrichment-bulk-bar"
      >
        <BasicButton
          v-if="actionableFilter"
          variant="danger"
          :disabled="busy"
          data-testid="enrichment-bulk-reject"
          @click="$emit('bulk-reject', '')"
        >
          {{ $t("enrichment.review.bulk.reject_all", { count: totalCount }) }}
        </BasicButton>
        <BasicButton
          v-if="actionableFilter"
          variant="primary"
          :disabled="busy"
          data-testid="enrichment-bulk-accept"
          @click="$emit('bulk-accept')"
        >
          {{ $t("enrichment.review.bulk.accept_all", { count: totalCount }) }}
        </BasicButton>
        <BasicButton
          v-if="undoableFilter"
          variant="secondary"
          :disabled="busy"
          :title="$t('enrichment.review.undo_hint')"
          data-testid="enrichment-undo"
          @click="$emit('bulk-undo')"
        >
          {{ $t("enrichment.review.bulk.undo_all", { count: totalCount }) }}
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
      @row-click="(row) => $emit('row-open', row)"
    >
      <template #empty>
        <slot name="empty">
          <EmptyState icon="enrich" :title="$t('enrichment.review.empty')" :message="$t('enrichment.review.empty_message')" />
        </slot>
      </template>
      <template #cell-product="{ row }">
        <div class="list-mode__product flex-column">
          <!-- A Studio step's proposal: its article, linked to the run (never the raw "run:<id>"). -->
          <router-link
            v-if="runUidOf(row)"
            :to="{ name: 'EnrichmentStudioRun', params: { uid: runUidOf(row) } }"
            class="list-mode__link list-mode__name t-accent"
            :title="row.subject_label || $t('enrichment.review.studio_article')"
            :data-testid="`enrichment-subject-${row.id}`"
            @click.stop
            >{{ row.subject_label || $t("enrichment.review.studio_article") }}</router-link
          >
          <!-- PIM subject: open the product preview drawer (stop the row → detail click). -->
          <BasicButton
            v-else-if="isPimRow(row)"
            variant="ghost"
            size="sm"
            class="list-mode__sku"
            :title="named(row) ? row.subject_label : row.subject_ref"
            :data-testid="`enrichment-subject-${row.id}`"
            @click.stop="$emit('preview-product', row)"
          >
            {{ named(row) ? row.subject_label : row.subject_ref }}
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
          <!-- A named product reads by its name; its SKU (what search also finds) goes under it. -->
          <span v-if="isPimRow(row) && named(row)" class="list-mode__name fs-200 t-secondary" :data-testid="`enrichment-sku-${row.id}`">
            {{ row.subject_ref }}
          </span>
          <span v-else-if="!runUidOf(row) && named(row)" class="list-mode__name fs-200 t-secondary" :title="row.subject_label">
            {{ row.subject_label }}
          </span>
          <!-- A phone hides the field column: the field and language, and the run, go under the subject. -->
          <span class="list-mode__phone-field fs-200 t-secondary">
            {{ proposalField(row) }}<template v-if="row.target_locator?.language">
              · {{ row.target_locator.language.toUpperCase() }}</template
            >
          </span>
          <span v-if="runLine(row)" class="list-mode__phone-field fs-200 t-muted">{{ runLine(row) }}</span>
        </div>
      </template>
      <template #cell-field="{ row }">
        <span class="flex-column">
          <span class="flex ai-ct gap-2">
            <span class="list-mode__field">{{ proposalField(row) }}</span>
            <Tag v-if="row.target_locator?.language" :label="row.target_locator.language.toUpperCase()" />
          </span>
          <!-- Which run proposed it: two texts of one field from two runs read apart. -->
          <span v-if="runLine(row)" class="list-mode__field fs-200 t-muted" :data-testid="`enrichment-run-${row.id}`">
            {{ runLine(row) }}
          </span>
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
        <span class="list-mode__age fs-200 t-muted" :title="formatDate(row.created_at)">{{ formatRelative(row.created_at) }}</span>
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
          <span class="list-mode__open">
            <IconButton
              icon="next"
              size="sm"
              :label="$t('enrichment.review.open')"
              :data-testid="`enrichment-open-${row.id}`"
              @click="$emit('row-open', row)"
            />
          </span>
        </div>
      </template>
    </DataTable>


  </div>
</template>

<script>
import { formatDate, formatRelative } from "@/utils/format";
import { safeHref } from "@/utils/safeHref";
import ChangeSummary from "./ChangeSummary.vue";
import { runUidOf, textRules, workerOf } from "./reviewLogic";
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
    // The status chip in force ("__all" = every status): it decides the status column and the bulk actions.
    statusFilter: { type: String, default: "__all" },
    // The runs behind the rows (useRunLabels().labels): { [taskId]: { name, at } }.
    runs: { type: Object, default: () => ({}) },
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
    // One line per proposal: product, field + language (the run under it), the change in brief, status, age, quick
    // actions. Confidence shows only when some row has one; module, kind, source and batch only on "More columns".
    columns() {
      const t = (key) => this.$t(`enrichment.review.col.${key}`);
      const all = [
        { key: "product", label: t("product"), width: "minmax(110px, 2fr)" },
        { key: "field", label: t("field"), width: "max-content", priority: 2 },
        { key: "change", label: t("change"), width: "minmax(160px, 2fr)", priority: 2 },
        { key: "status", label: t("status"), width: "max-content" },
        { key: "confidence", label: t("confidence"), width: "90px", priority: 2 },
        { key: "target_module", label: t("module"), width: "90px", priority: 3 },
        { key: "target_kind", label: t("kind"), width: "120px", priority: 3 },
        { key: "source", label: t("source"), width: "160px", priority: 3 },
        { key: "batch_id", label: t("batch"), width: "120px", priority: 3 },
        { key: "age", label: t("age"), width: "max-content", priority: 2 },
        { key: "actions", label: "", actions: true },
      ];
      return all.filter((col) => this.showColumn(col.key));
    },
    hasConfidence() {
      return this.rows.some((r) => r.confidence != null && r.confidence !== "");
    },
    // Bulk apply/reject on the pending queue; undo (etap-09) on the applied set: the count is what they reach.
    actionableFilter() {
      return this.statusFilter === "pending";
    },
    undoableFilter() {
      return this.statusFilter === "applied";
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
    runUidOf,
    showColumn(key) {
      if (TECHNICAL.includes(key)) return this.moreColumns;
      if (key === "confidence") return this.moreColumns || this.hasConfidence;
      if (key === "status") return this.statusFilter === "__all";
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
    named(row) {
      return !!row.subject_label && row.subject_label !== row.subject_ref;
    },
    // "Opis produktu · 2 hours ago": what ran and when.
    runLine(row) {
      const run = this.runs[row.task_id];
      return run ? `${run.name} · ${formatRelative(run.at)}` : "";
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";
.list-mode__product {
  min-width: 0;
}
// A long product name keeps to its column: two lines, then an ellipsis (the full name is the button's title). The
// button would size to its one-line text and run over the next column.
.list-mode__sku {
  align-self: flex-start;
  max-width: 100%;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;

  :deep(.btn-text) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
}
.list-mode__name,
.list-mode__field {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.list-mode__age {
  white-space: nowrap;
}
.list-mode__phone-field {
  display: none;
}
@include max-tablet {
  .list-mode__phone-field {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  // The row opens the detail on a tap; next to Apply and Reject the chevron would push Reject off a phone.
  .list-mode__open:not(:only-child) {
    display: none;
  }
}
.list-mode__link {
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
</style>
