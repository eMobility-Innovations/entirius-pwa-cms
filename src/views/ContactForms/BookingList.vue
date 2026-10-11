<template>
  <PageLayout class="cf-booking-list__wrapper fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('cf.bookings')" />
    </template>
    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-8 rg-3">
        <BasicInput
          v-model="search"
          :placeholder="$t('cf.search_placeholder')"
          icon="search"
          class="cf-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <MobileFilterPanel
          :active-count="activeFilterCount"
          :trigger-label="$t('builder.filters')"
        >
          <p class="cf-list__caption fs-200 t-secondary">{{ $t("cf.lead_status") }}</p>
          <div class="filter-chip-row" role="group" :aria-label="$t('cf.lead_status')">
            <FilterChip
              v-for="opt in leadStatusOptions"
              :key="opt.value"
              :label="opt.label"
              :active="leadStatusFilter === opt.value"
              @click="onLeadStatusFilter(opt.value)"
            />
          </div>
          <p class="cf-list__caption fs-200 t-secondary">{{ $t("cf.channel") }}</p>
          <BasicSelect
            :floating-label="$t('cf.channel')"
            :options="channelOptions"
            :model-value="channelFilter"
            class="cf-list__filter"
            @update:model-value="onChannelFilter"
          />
          <div class="flex ai-ct gap-3">
            <FormField :label="$t('cf.date_from')" layout="inline">
              <BasicDatePicker :model-value="dateFrom" @update:model-value="onDateFrom" />
            </FormField>
            <FormField :label="$t('cf.date_to')" layout="inline">
              <BasicDatePicker :model-value="dateTo" @update:model-value="onDateTo" />
            </FormField>
            <IconButton
              v-if="dateFrom || dateTo"
              icon="clear"
              variant="ghost"
              :label="$t('cf.clear_dates')"
              @click="clearDates"
            />
          </div>
        </MobileFilterPanel>
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="bookings"
        row-key="id"
        :empty-text="$t('cf.no_bookings')"
        @row-click="onRowClick"
      >
        <template #cell-meeting_start="{ value }">
          {{ formatDateTime(value) }}
        </template>
        <template #cell-meeting_end="{ value }">
          {{ formatDateTime(value) }}
        </template>
        <template #cell-name="{ row }">
          <span v-if="row.name">{{ row.name }}</span>
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-linked_lead="{ value }">
          <StatusBadge
            v-if="value"
            :label="leadStatusLabel($t, value.status)"
            :tone="leadStatusVariant(value.status)"
          />
          <span v-else class="t-muted">{{ $t("cf.no_linked_lead") }}</span>
        </template>
        <template #cell-meet_link="{ value }">
          <a
            v-if="value"
            :href="safeHref(value)"
            target="_blank"
            rel="noopener noreferrer"
            class="cf-list__meet-link"
            :title="$t('cf.open_meet')"
            @click.stop
          >
            <font-awesome-icon :icon="$icons.video" />
          </a>
          <span v-else class="t-muted">—</span>
        </template>
      </DataTable>

    <template v-if="totalCount > pageSize" #footer>
      <Pagination
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { GET_Bookings } from "@/api/contactForms/api";
import { safeHref } from "@/utils/safeHref";
import {
  LEAD_STATUSES,
  leadStatusLabel,
  leadStatusVariant,
} from "./helpers/leadStatus";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "BookingList",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, pimChannel, search, debouncedFetch };
  },
  data() {
    return {
      bookings: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      loading: false,
      channelFilter: "__all",
      leadStatusFilter: "__all",
      dateFrom: "",
      dateTo: "",
    };
  },
  computed: {
    channelOptions() {
      const opts = [{ label: this.$t("cf.all_channels"), value: "__all" }];
      for (const ch of this.pimChannel.channels) {
        opts.push({ label: `${ch.name || ch.idx} [${ch.idx}]`, value: ch.idx });
      }
      return opts;
    },
    leadStatusOptions() {
      const opts = [
        { label: this.$t("cf.statuses.all"), value: "__all" },
      ];
      for (const st of LEAD_STATUSES) {
        opts.push({ label: this.$t(`cf.statuses.${st}`), value: st });
      }
      return opts;
    },
    activeFilterCount() {
      let count = 0;
      if (this.leadStatusFilter !== "__all") count++;
      if (this.channelFilter !== "__all") count++;
      if (this.dateFrom || this.dateTo) count++;
      return count;
    },
    columns() {
      return [
        {
          key: "meeting_start",
          label: this.$t("cf.meeting_start"),
          width: "180px",
          priority: 2,
        },
        {
          key: "meeting_end",
          label: this.$t("cf.meeting_end"),
          width: "180px",
          priority: 2,
        },
        { key: "name", label: this.$t("cf.name"), width: "1fr" },
        { key: "email", label: this.$t("cf.email"), width: "1fr", priority: 2 },
        {
          key: "linked_lead",
          label: this.$t("cf.lead_status"),
          width: "140px",
        },
        { key: "meet_link", label: this.$t("cf.meet_link"), width: "80px", priority: 2 },
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
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchBookings();
    },
  },
  async mounted() {
    if (!this.pimChannel.channels.length) {
      await this.pimChannel.fetchChannels();
    }
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchBookings();
  },
  methods: {
    safeHref,
    leadStatusLabel,
    leadStatusVariant,
    formatDateTime(iso) {
      if (!iso) return "—";
      const d = new Date(iso);
      return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    onChannelFilter(value) {
      this.channelFilter = value;
      this.currentPage = 1;
      this.fetchBookings();
    },
    onDateFrom(value) {
      this.dateFrom = value;
      this.searchAndFetch();
    },
    onDateTo(value) {
      this.dateTo = value;
      this.searchAndFetch();
    },
    clearDates() {
      this.dateFrom = "";
      this.dateTo = "";
      this.searchAndFetch();
    },
    onLeadStatusFilter(value) {
      this.leadStatusFilter = value;
      this.currentPage = 1;
      this.fetchBookings();
    },
    async fetchBookings() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.channelFilter !== "__all") params.channel = this.channelFilter;
        if (this.leadStatusFilter !== "__all") {
          params.lead_status = this.leadStatusFilter;
        }
        if (this.dateFrom) params.date_from = this.dateFrom;
        if (this.dateTo) params.date_to = this.dateTo;

        const { data } = await GET_Bookings(params);
        this.bookings = data.results || [];
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
      this.fetchBookings();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/forms/bookings/${row.id}`);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.cf-list__search {
  flex: 1;
  max-width: 400px;
  min-width: 150px;

  // A phone gives the search its own row above the filters.
  @include max-tablet {
    flex-basis: 100%;
    max-width: none;
  }
}

.cf-list__filter {
  min-width: 180px;
  max-width: 240px;
  flex-shrink: 0;
}

// The captions name the groups in the phone panel; the desktop row has the chip group's name and the placeholder.
.mobile-filter-panel__desktop .cf-list__caption {
  display: none;
}

.cf-list__meet-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-base);
  color: var(--text-accent);
  text-decoration: none;
}

.cf-list__meet-link:hover {
  background: var(--surface-raised);
}
</style>
