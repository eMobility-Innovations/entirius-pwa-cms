<template>
  <PageLayout class="memory-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('nav.enrichment_settings')" :description="$t('enrichment.memory.description')" :crumbs="[]">
        <template #tabs>
          <RouteTabs :tabs="ENRICHMENT_SETTINGS_TABS" />
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-8 rg-6">
        <BasicInput v-model="search" icon="search" :placeholder="$t('enrichment.memory.subject_search')" class="memory-list__search" data-testid="memory-subject" @input="debouncedFetch(refetch)" />
        <BasicSelect v-model="kind" :options="kindOptions" :floating-label="$t('enrichment.memory.kind_filter')" class="memory-list__filter" data-testid="memory-kind" />
        <BasicSelect v-model="status" :options="statusOptions" :floating-label="$t('enrichment.memory.status_filter')" class="memory-list__filter" data-testid="memory-status" />
        <BasicSelect v-model="expiry" :options="expiryOptions" :floating-label="$t('enrichment.memory.expiry_filter')" class="memory-list__filter" data-testid="memory-expiry" />
      </div>
    </template>

    <div v-bind="tabPanel">
      <Loader v-if="loading" block />
      <EmptyState v-else-if="!pinned.length && !shown.length" icon="empty" :title="emptyTitle" size="md" data-testid="memory-empty">
        <BasicButton v-if="filtered" variant="secondary" data-testid="memory-clear-filters" @click="clearFilters">
          {{ $t("enrichment.memory.clear_filters") }}
        </BasicButton>
      </EmptyState>
      <div v-else class="flex-column gap-6">
        <section v-if="pinned.length" class="flex-column gap-4" data-testid="memory-pinned">
          <h2 class="memory-list__heading m-0">{{ $t("enrichment.memory.waiting") }}</h2>
          <MemoryEntry v-for="entry in pinned" :key="entry.id" :entry="entry" :busy="busy" v-on="entryEvents" />
        </section>
        <div v-if="shown.length" class="flex-column gap-4" data-testid="memory-entries">
          <MemoryEntry v-for="entry in shown" :key="entry.id" :entry="entry" :busy="busy" v-on="entryEvents" />
        </div>
      </div>
    </div>

    <template v-if="pages > 1" #footer>
      <Pagination v-model:page="page" :pages="pages" :disabled="loading" />
    </template>

    <ConfirmDialog
      :open="deleting !== null"
      tone="danger"
      :title="$t('enrichment.memory.delete_title')"
      :message="deleting?.title || ''"
      :confirm-label="$t('common.delete')"
      @update:open="(open) => !open && (deleting = null)"
      @confirm="remove"
    />
  </PageLayout>
</template>

<script>
import { DELETE_Memory, GET_Memory, PATCH_Memory, POST_PromoteMemory } from "@/api/enrichment/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { useNotifyStore } from "@/stores/notify";
import { useEnrichmentProfileStore } from "@/stores/enrichmentProfile";
import { useProfileChannels } from "@/views/EnrichmentProfile/useProfileChannels";
import RouteTabs from "@/components/Navigation/RouteTabs.vue";
import { ENRICHMENT_SETTINGS_TABS, routeTabPanel } from "@/components/Navigation/nav-routes";
import MemoryEntry from "./MemoryEntry.vue";
import {
  EXPIRY, KINDS, STATUSES, byExpiry, isPendingSuggestion, memoryParams, newestFirst, pinnedKinds, promoteTarget,
} from "./memoryLogic";

const PAGE_SIZE = 25;
const PINNED_MAX = 100;
const DEFAULT_STATUS = "active";
const DEFAULT_EXPIRY = "all";

// What the studio remembered (contract A4 § 3): SEO briefs, operator answers and the suggestions waiting for the
// operator — those are fetched apart and pinned above the paged list, with "Add to profile" (a new profile version)
// or "Dismiss". Filters: subject, kind, state (server side), expiry (the API has no such filter: this page only).
export default {
  name: "MemoryList",
  components: { MemoryEntry, RouteTabs },
  setup() {
    const { search, debouncedFetch } = useSearchDebounce();
    const { load: loadChannels } = useProfileChannels();
    return {
      notify: useNotifyStore(), profileStore: useEnrichmentProfileStore(), search, debouncedFetch, loadChannels,
      ENRICHMENT_SETTINGS_TABS, tabPanel: routeTabPanel(ENRICHMENT_SETTINGS_TABS, "EnrichmentMemory"),
    };
  },
  data() {
    return { entries: [], suggestions: [], count: 0, page: 1, kind: "", status: DEFAULT_STATUS, expiry: DEFAULT_EXPIRY, loading: false, busy: false, deleting: null };
  },
  computed: {
    pinned() {
      return byExpiry(this.suggestions, this.expiry);
    },
    shown() {
      return byExpiry(this.entries.filter((entry) => !isPendingSuggestion(entry)), this.expiry);
    },
    // A filter away from the defaults: an empty list is "nothing matches", never "nothing remembered".
    filtered() {
      return !!(this.search || this.kind) || this.status !== DEFAULT_STATUS || this.expiry !== DEFAULT_EXPIRY;
    },
    emptyTitle() {
      if (this.count) return this.$t("enrichment.memory.empty_page");
      return this.$t(this.filtered ? "enrichment.memory.empty_filtered" : "enrichment.memory.empty");
    },
    entryEvents() {
      return { promote: this.promote, status: this.setStatus, delete: (entry) => (this.deleting = entry) };
    },
    pages() {
      return Math.ceil(this.count / PAGE_SIZE);
    },
    kindOptions() {
      return this.options(KINDS, "kind", "enrichment.memory.all_kinds");
    },
    statusOptions() {
      return this.options(STATUSES, "status", "enrichment.memory.all_statuses");
    },
    expiryOptions() {
      return EXPIRY.map((value) => ({ value, label: this.$t(`enrichment.memory.expiry.${value}`) }));
    },
  },
  watch: {
    kind: "refetch",
    status: "refetch",
    page: "fetchEntries",
  },
  mounted() {
    this.loadChannels();
    this.fetchEntries();
  },
  methods: {
    options(values, group, allKey) {
      return [{ value: "", label: this.$t(allKey) }, ...values.map((value) => ({ value, label: this.$t(`enrichment.memory.${group}.${value}`) }))];
    },
    clearFilters() {
      Object.assign(this, { search: "", kind: "", status: DEFAULT_STATUS, expiry: DEFAULT_EXPIRY });
      this.refetch();
    },
    refetch() {
      if (this.page !== 1) this.page = 1;
      else this.fetchEntries();
    },
    async fetchEntries() {
      this.loading = true;
      try {
        const params = memoryParams({ kind: this.kind, status: this.status, subject: this.search, page: this.page, pageSize: PAGE_SIZE });
        const [{ data }, suggestions] = await Promise.all([GET_Memory(params), this.fetchSuggestions()]);
        this.entries = data.results || [];
        this.count = data.count || 0;
        this.suggestions = suggestions;
      } catch (err) {
        this.toastError(err);
      } finally {
        this.loading = false;
      }
    },
    async fetchSuggestions() {
      const answers = await Promise.all(
        pinnedKinds(this.kind, this.status).map((kind) =>
          GET_Memory(memoryParams({ kind, status: "active", subject: this.search, page: 1, pageSize: PINNED_MAX }))
        )
      );
      return newestFirst(answers.flatMap(({ data }) => data.results || []));
    },
    async act(work, toastKey) {
      this.busy = true;
      try {
        await work();
        this.notify.spawnNotification({ type: "positive", msg: this.$t(toastKey) });
        this.profileStore.refresh();
        await this.fetchEntries();
      } catch (err) {
        this.toastError(err);
      } finally {
        this.busy = false;
      }
    },
    promote(entry) {
      return this.act(() => POST_PromoteMemory(entry.id, { target: promoteTarget(entry) }), "enrichment.memory.promoted_toast");
    },
    setStatus(entry, status) {
      return this.act(() => PATCH_Memory(entry.id, { status }), `enrichment.memory.${status}_toast`);
    },
    remove() {
      const entry = this.deleting;
      this.deleting = null;
      return this.act(() => DELETE_Memory(entry.id), "enrichment.memory.deleted_toast");
    },
    toastError(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>

<style lang="scss" scoped>
.memory-list__search {
  flex: 1;
  max-width: 400px;
  min-width: 150px;
}

.memory-list__filter {
  min-width: 180px;
  max-width: 240px;
  flex-shrink: 0;
}

.memory-list__heading {
  font-size: var(--fs-400);
  font-weight: 600;
  color: var(--text-strong);
}
</style>
