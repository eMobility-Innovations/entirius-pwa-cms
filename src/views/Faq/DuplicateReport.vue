<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('faq.duplicates')" :description="description">
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

    <Loader block v-if="loading" />

    <EmptyState v-else-if="loadFailed" icon="empty" :title="$t('notifications.error')" />

    <EmptyState v-else-if="!groups.length" icon="success" :title="$t('faq.no_duplicates')" />

    <div v-else class="flex-column gap-8">
      <BasicCard
        v-for="group in groups"
        :key="group.question"
        :title="group.question"
        data-testid="faq-duplicate-group"
      >
        <DataTable :columns="columns" :rows="group.occurrences" row-key="key" @row-click="openOccurrence">
          <template #cell-source="{ row }">
            <StatusBadge tone="accent" :dot="false" :label="sourceLabel(row)" />
          </template>
          <template #cell-routes="{ row }">{{ row.routes.join(", ") }}</template>
          <template #cell-isPublished="{ row }">
            <StatusBadge
              :tone="row.isPublished ? 'positive' : 'neutral'"
              :label="row.isPublished ? $t('faq.published') : $t('faq.draft_only')"
            />
          </template>
        </DataTable>
      </BasicCard>
    </div>
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useMuninStore } from "@/stores/munin";
import { useAccessStore } from "@/stores/access";
import { AREAS } from "@/configs/areas";
import { extractApiMessage } from "@/composables/useFormErrors";
import { findDuplicates } from "@/utils/faqDuplicates";
import { loadFaqOccurrences, loadContentOccurrences } from "./duplicateSources";

export default {
  name: "FaqDuplicateReport",
  setup() {
    const notify = useNotifyStore();
    const munin = useMuninStore();
    const access = useAccessStore();
    return { notify, munin, access };
  },
  data() {
    return { groups: [], loading: false, loadFailed: false, contentStatus: null };
  },
  computed: {
    // Pages are optional: without contentdb (or read on pages and on the schema, which lists the content types) the
    // report compares FAQ items only.
    includesPages() {
      return (
        this.munin.isModuleEnabled("contentdb") &&
        this.access.can(AREAS.CONTENT_PAGES) &&
        this.access.can(AREAS.CONTENT_SCHEMA)
      );
    },
    description() {
      if (this.contentStatus === "failed") return this.$t("faq.duplicates_description_content_failed");
      const full = this.includesPages && this.contentStatus !== "refused";
      return full ? this.$t("faq.duplicates_description") : this.$t("faq.duplicates_description_faq_only");
    },
    headerActions() {
      return [
        { key: "refresh", role: "utility", icon: "refresh", label: this.$t("faq.check_again"), onClick: this.load },
      ];
    },
    columns() {
      return [
        { key: "name", label: this.$t("faq.duplicates_place"), width: "1fr" },
        { key: "source", label: this.$t("faq.duplicates_source"), width: "max-content" },
        { key: "routes", label: this.$t("faq.duplicates_routes"), width: "160px", priority: 2 },
        { key: "language", label: this.$t("faq.duplicates_language"), width: "80px", priority: 2 },
        { key: "isPublished", label: this.$t("faq.status"), width: "max-content" },
      ];
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      if (this.loading) return;
      this.loading = true;
      this.loadFailed = false;
      this.contentStatus = null;
      try {
        const channel = process.env.VUE_APP_CHANNEL;
        const [faq, pages] = await Promise.all([
          loadFaqOccurrences(channel),
          this.includesPages ? this.loadPages(channel) : [],
        ]);
        this.groups = findDuplicates([...faq, ...pages]).map((group) => ({
          ...group,
          occurrences: group.occurrences.map((occurrence, key) => ({ ...occurrence, key })),
        }));
      } catch (err) {
        this.loadFailed = true;
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
    // The content half is optional: when it fails the FAQ items still get compared.
    async loadPages(channel) {
      try {
        return await loadContentOccurrences(channel);
      } catch (err) {
        this.contentStatus = err?.response?.status === 403 ? "refused" : "failed";
        return [];
      }
    },
    sourceLabel(row) {
      return row.source === "faq" ? this.$t("faq.duplicates_source_faq") : row.source;
    },
    openOccurrence(row) {
      this.$router.push(row.to);
    },
  },
};
</script>
