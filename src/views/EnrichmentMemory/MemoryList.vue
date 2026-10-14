<template>
  <PageLayout class="memory-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('enrichment.memory.title')" :description="$t('enrichment.memory.description')" />
    </template>
    <template #toolbar>
      <BasicInput v-model="search" icon="search" :placeholder="$t('enrichment.memory.subject_search')" data-testid="memory-subject" @input="debouncedFetch(refetch)" />
      <BasicSelect v-model="kind" :options="kindOptions" :floating-label="$t('enrichment.memory.kind_filter')" data-testid="memory-kind" />
      <BasicSelect v-model="status" :options="statusOptions" :floating-label="$t('enrichment.memory.status_filter')" data-testid="memory-status" />
      <BasicSelect v-model="expiry" :options="expiryOptions" :floating-label="$t('enrichment.memory.expiry_filter')" data-testid="memory-expiry" />
    </template>

    <Loader v-if="loading" block />
    <EmptyState v-else-if="!pinned.length && !shown.length" icon="empty" :title="emptyTitle" size="md" data-testid="memory-empty" />
    <div v-else class="flex-column gap-6">
      <section v-if="pinned.length" class="flex-column gap-4" data-testid="memory-pinned">
        <h2 class="memory-list__heading m-0">{{ $t("enrichment.memory.waiting") }}</h2>
        <MemoryEntry v-for="entry in pinned" :key="entry.id" :entry="entry" :busy="busy" v-on="entryEvents" />
      </section>
      <div v-if="shown.length" class="flex-column gap-4" data-testid="memory-entries">
        <MemoryEntry v-for="entry in shown" :key="entry.id" :entry="entry" :busy="busy" v-on="entryEvents" />
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
import MemoryEntry from "./MemoryEntry.vue";
import {
  EXPIRY, KINDS, STATUSES, byExpiry, isPendingSuggestion, memoryParams, newestFirst, pinnedKinds, promoteTarget,
} from "./memoryLogic";

const PAGE_SIZE = 25;
const PINNED_MAX = 100;

// What the studio remembered (contract A4 § 3): SEO briefs, operator answers and the suggestions waiting for the
// operator — those are fetched apart and pinned above the paged list, with "Add to profile" (a new profile version)
// or "Dismiss". Filters: subject, kind, state (server side), expiry (the API has no such filter: this page only).
export default {
  name: "MemoryList",
  components: { MemoryEntry },
  setup() {
    const { search, debouncedFetch } = useSearchDebounce();
    const { load: loadChannels } = useProfileChannels();
    return { notify: useNotifyStore(), profileStore: useEnrichmentProfileStore(), search, debouncedFetch, loadChannels };
  },
  data() {
    return { entries: [], suggestions: [], count: 0, page: 1, kind: "", status: "active", expiry: "all", loading: false, busy: false, deleting: null };
  },
  computed: {
    pinned() {
      return byExpiry(this.suggestions, this.expiry);
    },
    shown() {
      return byExpiry(this.entries.filter((entry) => !isPendingSuggestion(entry)), this.expiry);
    },
    emptyTitle() {
      return this.$t(this.count ? "enrichment.memory.empty_page" : "enrichment.memory.empty");
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
.memory-list__heading {
  font-size: var(--fs-400);
  font-weight: 600;
  color: var(--text-strong);
}
</style>
