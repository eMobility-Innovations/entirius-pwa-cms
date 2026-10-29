<template>
  <div class="vouchers-list">
    <ReadonlyOff>
      <div class="vouchers-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('promo.voucher_search_placeholder')"
          :aria-label="$t('promo.voucher_search_placeholder')"
          icon="search"
          class="vouchers-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />

        <div class="vouchers-list__lookup">
          <BasicInput
            v-model="lookupCode"
            :placeholder="$t('promo.voucher_lookup_placeholder')"
            :aria-label="$t('promo.voucher_lookup_placeholder')"
            @keyup.enter="doLookup"
          />
          <BasicButton :mutates="false"
            variant="secondary"
            :disabled="!lookupCode"
            @click="doLookup"
          >
            {{ $t('promo.voucher_lookup_btn') }}
          </BasicButton>
        </div>

        <MobileFilterPanel
          :active-count="activeFilterCount"
          :trigger-label="$t('builder.filters')"
        >
          <p class="fs-200 t-secondary">{{ $t("promo.voucher_status") }}</p>
          <FilterChip
            v-for="opt in statusOptions"
            :key="opt.key"
            :label="opt.label"
            :active="statusFilter === opt.key"
            @click="setStatusFilter(opt.key)"
          />
          <BasicSelect
            :floating-label="$t('promo.voucher_col_campaign')"
            :options="campaignOptions"
            :model-value="campaignFilter"
            class="vouchers-list__campaign-filter"
            @update:model-value="onCampaignFilter"
          />
        </MobileFilterPanel>
      </div>
    </ReadonlyOff>

    <Loader block v-show="loading" />

    <DataTable
      empty-size="md"
      v-show="!loading"
      :columns="columns"
      :rows="vouchers"
      row-key="id"
      :empty-text="$t('promo.voucher_none')"
      @row-click="onRowClick"
    >
      <template #cell-recipient_email="{ row }">
        <span v-if="row.recipient_email">{{ row.recipient_email }}</span>
        <span v-else class="t-muted">—</span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge
          :label="statusLabel(row.status)"
          :tone="statusVariant(row.status)"
        />
      </template>
      <template #cell-balance="{ row }">
        <span class="fw-600">{{ row.balance }}</span>
        <span class="t-muted">
          / {{ row.face_value }} {{ row.currency }}</span
        >
      </template>
      <template #cell-expires_at="{ row }">
        <span class="t-secondary">{{ formatDate(row.expires_at) }}</span>
      </template>
      <template #cell-voucher_campaign_id="{ row }">
        <Tag :label="campaignName(row.voucher_campaign_id)" />
      </template>
    </DataTable>

    <Pagination
      v-if="totalCount > pageSize"
      :page="paginationState.page"
      :pages="paginationState.pages"
      @update:page="onPageChange"
    />
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import {
  GET_VoucherMeta,
  GET_Vouchers,
  GET_Campaigns,
  POST_VoucherLookup,
} from "@/api/voucher/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";
import { enumLabel } from "./promo-enum-hints";
import { ReadonlyOff } from "@/composables/useReadonly";

const STATUS_VARIANT = {
  active: "positive",
  pending_approval: "warning",
  locked: "warning",
  blocked: "warning",
  redeemed: "neutral",
  expired: "negative",
  canceled: "negative",
};

export default {
  name: "VouchersList",
  components: { ReadonlyOff },
  setup() {
    const notify = useNotifyStore();
    const checkoutChannel = useCheckoutChannelStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { notify, checkoutChannel, search, debouncedFetch };
  },
  data() {
    return {
      vouchers: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      loading: false,
      statusFilter: "all",
      campaignFilter: null,
      statuses: [],
      campaigns: [],
      lookupCode: "",
    };
  },
  computed: {
    channel() {
      return (
        this.checkoutChannel.activeChannelIdx ||
        process.env.VUE_APP_CHANNEL ||
        "default-local"
      );
    },
    statusOptions() {
      const opts = [{ key: "all", label: this.$t("promo.filter_all") }];
      for (const s of this.statuses)
        opts.push({ key: s.value, label: this.statusLabel(s.value) });
      return opts;
    },
    campaignOptions() {
      const opts = [
        { label: this.$t("promo.voucher_all_campaigns"), value: null },
      ];
      for (const c of this.campaigns)
        opts.push({ label: c.name, value: String(c.id) });
      return opts;
    },
    activeFilterCount() {
      let count = 0;
      if (this.statusFilter !== "all") count++;
      if (this.campaignFilter) count++;
      return count;
    },
    columns() {
      return [
        { key: "id", label: this.$t("promo.voucher_col_id"), width: "70px" },
        {
          key: "recipient_email",
          label: this.$t("promo.voucher_col_recipient"),
          width: "1fr",
        },
        { key: "status", label: this.$t("promo.col_status"), width: "150px" },
        {
          key: "balance",
          label: this.$t("promo.voucher_col_balance"),
          width: "180px",
        },
        {
          key: "expires_at",
          label: this.$t("promo.voucher_col_expires"),
          width: "120px",
        },
        {
          key: "voucher_campaign_id",
          label: this.$t("promo.voucher_col_campaign"),
          width: "160px",
          truncate: true,
        },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
  },
  watch: {
    "checkoutChannel.activeChannelIdx"() {
      this.currentPage = 1;
      this.fetchMeta();
      this.fetchCampaigns();
      this.fetchVouchers();
    },
  },
  mounted() {
    this.fetchMeta();
    this.fetchCampaigns();
    this.fetchVouchers();
  },
  methods: {
    statusVariant(status) {
      return STATUS_VARIANT[status] || "neutral";
    },
    statusLabel(status) {
      const found = this.statuses.find((s) => s.value === status);
      return enumLabel("voucher_status", status, found && this.shortStatus(found.label));
    },
    shortStatus(label) {
      return label ? label.split("—")[0].trim() : label;
    },
    campaignName(id) {
      const found = this.campaigns.find((c) => c.id === id);
      // A nameless or unknown campaign still gets a label (Tag needs a string): its id.
      return found?.name || `#${id}`;
    },
    formatDate(value) {
      return value ? value.split("T")[0] : "—";
    },
    async fetchMeta() {
      try {
        const { data } = await GET_VoucherMeta(this.channel);
        this.statuses = data.statuses || [];
      } catch {
        // Non-critical — status badges fall back to raw values
      }
    },
    async fetchCampaigns() {
      try {
        const { data } = await GET_Campaigns(this.channel, { page_size: 100 });
        this.campaigns = data.results || [];
      } catch {
        // Non-critical — campaign filter/labels degrade to ids
      }
    },
    async fetchVouchers() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.statusFilter !== "all") params.status = this.statusFilter;
        if (this.campaignFilter) params.campaign = this.campaignFilter;
        const { data } = await GET_Vouchers(this.channel, params);
        this.vouchers = data.results || [];
        this.totalCount = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchVouchers();
    },
    setStatusFilter(key) {
      this.statusFilter = key;
      this.currentPage = 1;
      this.fetchVouchers();
    },
    onCampaignFilter(val) {
      this.campaignFilter = val;
      this.currentPage = 1;
      this.fetchVouchers();
    },
    onPageChange(page) {
      this.currentPage = page;
      this.fetchVouchers();
    },
    onRowClick(row) {
      this.$router.push(`/promo/voucher/${row.id}`);
    },
    async doLookup() {
      if (!this.lookupCode) return;
      try {
        const { data } = await POST_VoucherLookup(
          this.channel,
          this.lookupCode.trim()
        );
        this.$router.push(`/promo/voucher/${data.id}`);
      } catch (err) {
        const msg =
          isNotFound(err)
            ? this.$t("promo.voucher_not_found")
            : extractApiMessage(err, this.$t("notifications.error"));
        this.notify.spawnNotification({ type: "negative", msg });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.vouchers-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  margin-bottom: var(--space-10);
  flex-wrap: wrap;
}

.vouchers-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 360px;
}

.vouchers-list__lookup {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.vouchers-list__campaign-filter {
  min-width: 150px;
  max-width: 220px;
  flex-shrink: 0;
}
</style>
