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
    <EmptyState v-else-if="!shown.length" icon="empty" :title="$t('enrichment.memory.empty')" size="md" data-testid="memory-empty" />
    <div v-else class="flex-column gap-4" data-testid="memory-entries">
      <MemoryEntry
        v-for="entry in shown"
        :key="entry.id"
        :entry="entry"
        :busy="busy"
        @promote="promote"
        @status="setStatus"
        @delete="(e) => (deleting = e)"
      />
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
import MemoryEntry from "./MemoryEntry.vue";
import { EXPIRY, KINDS, STATUSES, byExpiry, memoryParams, promoteTarget, suggestionsFirst } from "./memoryLogic";

const PAGE_SIZE = 25;

// What the studio remembered (contract A4 § 3): SEO briefs, operator answers and the suggestions waiting for the
// operator — those come first, with "Add to profile" (a new profile version) or "Dismiss". Filters: subject, kind,
// state, expired.
export default {
  name: "MemoryList",
  components: { MemoryEntry },
  setup() {
    const { search, debouncedFetch } = useSearchDebounce();
    return { notify: useNotifyStore(), profileStore: useEnrichmentProfileStore(), search, debouncedFetch };
  },
  data() {
    return { entries: [], count: 0, page: 1, kind: "", status: "active", expiry: "current", loading: false, busy: false, deleting: null };
  },
  computed: {
    shown() {
      return suggestionsFirst(byExpiry(this.entries, this.expiry));
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
        const { data } = await GET_Memory(params);
        this.entries = data.results || [];
        this.count = data.count || 0;
      } catch (err) {
        this.toastError(err);
      } finally {
        this.loading = false;
      }
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
