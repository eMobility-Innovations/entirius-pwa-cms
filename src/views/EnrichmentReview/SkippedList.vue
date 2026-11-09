<template>
  <section class="flex-column gap-5" data-testid="enrichment-skipped">
    <Loader v-if="loading" block />
    <div v-else-if="error" role="alert" class="flex ai-ct gap-3 t-negative">
      {{ $t("enrichment.review.skipped.error") }}
      <BasicButton @click="load">{{ $t("enrichment.review.skipped.retry") }}</BasicButton>
    </div>
    <template v-else>
      <DataTable :columns="columns" :rows="rows" row-key="sku" :empty-text="$t('enrichment.review.skipped.empty')">
        <template #cell-skipped_at="{ row }">{{ formatDate(row.skipped_at) }}</template>
        <template #cell-actions="{ row }">
          <BasicButton size="sm" mutates :disabled="!!busy" :data-testid="`enrichment-unskip-${row.sku}`" @click="unskip(row.sku)">
            {{ $t("enrichment.review.skipped.back_to_queue") }}
          </BasicButton>
          <BasicButton size="sm" variant="ghost" :disabled="!!busy" :data-testid="`enrichment-skipped-open-${row.sku}`" @click="$emit('open', row.sku)">
            {{ $t("enrichment.review.skipped.open_focus") }}
          </BasicButton>
        </template>
      </DataTable>
      <p v-if="actionError" role="alert" class="m-0 t-negative">{{ $t("enrichment.review.skipped.error") }}</p>
      <Pagination v-if="pages > 1" v-model:page="page" :pages="pages" />
    </template>
  </section>
</template>

<script>
import { GET_ReviewSkipped, POST_ReviewUnskip } from "@/api/integrator/review";
import { formatDate } from "@/utils/format";

const PAGE_SIZE = 25;

export default {
  name: "SkippedList",
  emits: ["open", "changed"],
  data() {
    return { rows: [], count: 0, page: 1, loading: false, error: false, actionError: false, busy: "" };
  },
  computed: {
    pages() { return Math.ceil(this.count / PAGE_SIZE); },
    columns() {
      return [
        ...["sku", "label", "note", "skipped_by", "skipped_at"].map((key, index) => ({
          key, label: this.$t(`enrichment.review.skipped.${["sku", "name", "note", "who", "when"][index]}`),
        })),
        { key: "actions", label: "", actions: true },
      ];
    },
  },
  watch: { page: "load" },
  mounted() { this.load(); },
  methods: {
    formatDate,
    async load() {
      this.loading = true;
      this.error = false;
      try {
        const { data } = await GET_ReviewSkipped({ page: this.page, page_size: PAGE_SIZE });
        this.rows = data.results;
        this.count = data.count;
      } catch {
        this.error = true;
      } finally {
        this.loading = false;
      }
    },
    async unskip(sku) {
      if (this.busy) return;
      this.busy = sku;
      this.actionError = false;
      try {
        await POST_ReviewUnskip(sku);
        this.$emit("changed");
        if (this.rows.length === 1 && this.page > 1) this.page -= 1;
        else await this.load();
      } catch {
        this.actionError = true;
      } finally {
        this.busy = "";
      }
    },
  },
};
</script>
