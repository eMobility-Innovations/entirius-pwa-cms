<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('agm.people_list')">
        <template v-if="mode === 'marketing_lists'" #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

      <div class="mb-10">
        <BasicTabs
          v-model="mode"
          id-prefix="consent-people"
          :options="[
            { value: 'people', label: $t('agm.tab_people') },
            { value: 'marketing_lists', label: $t('agm.tab_marketing_lists') },
          ]"
        />
      </div>

      <!-- People tab -->
      <div
        v-if="mode === 'people'"
        id="consent-people-panel-people"
        role="tabpanel"
        aria-labelledby="consent-people-tab-people"
      >
        <div class="flex ai-ct gap-8 mb-10">
          <ReadonlyOff>
            <BasicInput
              v-model="search"
              :placeholder="$t('agm.search_by_email')"
              icon="search"
              class="consent-people__search"
              @input="debouncedFetch(searchAndFetch)"
            />
          </ReadonlyOff>
        </div>

        <Loader block v-show="loading" />

        <DataTable
          empty-size="md"
          v-show="!loading"
          :columns="columns"
          :rows="people"
          row-key="email"
          :empty-text="$t('agm.no_people')"
          @row-click="onRowClick"
        >
          <template #cell-last_activity="{ value }">
            <span>{{ formatDate(value) }}</span>
          </template>
        </DataTable>

      </div>

      <!-- Marketing Lists tab -->
      <div
        v-if="mode === 'marketing_lists'"
        id="consent-people-panel-marketing_lists"
        role="tabpanel"
        aria-labelledby="consent-people-tab-marketing_lists"
      >
        <Loader block v-show="subscribersLoading" />

        <template v-if="!subscribersLoading">
          <p v-if="!subscriberGroups.length" class="t-muted">
            {{ $t("agm.no_subscribers") }}
          </p>

          <div
            v-for="group in subscriberGroups"
            :key="group.slug"
            class="mb-12"
          >
            <div class="flex ai-ct gap-5 mb-8">
              <h2 class="fs-400 fw-600">{{ group.name }}</h2>
              <span class="fs-200 t-muted">
                {{ group.items.length }} {{ $t("agm.subscribers_count") }}
              </span>
            </div>
            <DataTable
              :columns="subscriberColumns"
              :rows="group.items"
              row-key="email"
              :empty-text="$t('agm.no_subscribers')"
            >
              <template #cell-granted_at="{ value }">
                <span>{{ formatDate(value) }}</span>
              </template>
            </DataTable>
          </div>
        </template>
      </div>

    <template #footer>
      <Pagination
        v-if="mode === 'people' && totalCount > pageSize"
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
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import {
  GET_People,
  GET_MarketingSubscribers,
  GET_MarketingSubscribersExport,
} from "@/api/agreements/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { ReadonlyOff } from "@/composables/useReadonly";

export default {
  name: "ConsentPeople",
  components: { ReadonlyOff },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, search, debouncedFetch };
  },
  data() {
    return {
      mode: "people",
      people: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      loading: false,
      subscribers: [],
      subscribersLoading: false,
    };
  },
  computed: {
    headerActions() {
      return [{ key: "csv", role: "secondary", label: this.$t("agm.download_csv"), onClick: this.downloadCSV }];
    },
    columns() {
      return [
        {
          key: "email",
          label: this.$t("agm.email"),
          sortable: false,
          width: "2fr",
        },
        {
          key: "consent_count",
          label: this.$t("agm.consent_count"),
          sortable: false,
          width: "120px",
          numeric: true,
        },
        {
          key: "last_activity",
          label: this.$t("agm.last_activity"),
          sortable: false,
          width: "180px",
          priority: 2,
        },
      ];
    },
    subscriberColumns() {
      return [
        {
          key: "email",
          label: this.$t("agm.email"),
          sortable: false,
          width: "2fr",
        },
        {
          key: "granted_at",
          label: this.$t("agm.date"),
          sortable: false,
          width: "180px",
          priority: 2,
        },
        {
          key: "channel_idx",
          label: this.$t("agm.channel"),
          sortable: false,
          width: "140px",
        },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
    subscriberGroups() {
      const groups = {};
      for (const sub of this.subscribers) {
        const key = sub.agreement_slug;
        if (!groups[key]) {
          groups[key] = {
            slug: key,
            name: sub.agreement_name || key,
            items: [],
          };
        }
        groups[key].items.push(sub);
      }
      return Object.values(groups);
    },
  },
  watch: {
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchPeople();
    },
    mode(val) {
      if (val === "marketing_lists" && !this.subscribers.length) {
        this.fetchSubscribers();
      }
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchPeople();
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return "---";
      return new Date(dateStr).toLocaleString();
    },
    async fetchPeople() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;

        const { data } = await GET_People(params);
        this.people = data.results || [];
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
    async fetchSubscribers() {
      this.subscribersLoading = true;
      try {
        const { data } = await GET_MarketingSubscribers();
        this.subscribers = data.results || data || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.subscribersLoading = false;
      }
    },
    async downloadCSV() {
      try {
        const response = await GET_MarketingSubscribersExport();
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "marketing-subscribers.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchPeople();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(
        `/agreements/consents/${encodeURIComponent(row.email)}`
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.consent-people__search {
  flex: 1;
  max-width: 400px;
}
</style>
