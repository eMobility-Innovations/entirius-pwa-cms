<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('access.applications.title')" :description="$t('access.applications.help')" />
    </template>
    <Loader block v-if="loading" />

    <DataTable
      v-else
      :columns="columns"
      :rows="applications"
      row-key="id"
      :row-attrs="(row) => ({ 'data-testid': `application-row-${row.id}` })"
      :empty-text="$t('access.applications.empty')"
      empty-size="md"
      @row-click="openApplication"
    >
      <template #cell-name="{ row }">
        <div class="flex ai-ct flex-wrap gap-2">
          <router-link :to="applicationLink(row)" class="application-name fw-600 t-accent" @click.stop>{{ row.name }}</router-link>
          <Tag v-if="row.legacy" :label="$t('access.tokens.legacy')" />
        </div>
      </template>
      <template #cell-is_active="{ row }">
        <StatusBadge
          :tone="row.is_active ? 'positive' : 'neutral'"
          :label="row.is_active ? $t('common.active') : $t('common.inactive')"
        />
      </template>
      <template #cell-token_count="{ row }">{{ row.token_count ?? "—" }}</template>
    </DataTable>

    <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { GET_AccessAllApplications, GET_AccessAllTokens } from "@/api/access/api";
import { extractApiMessage } from "@/composables/useFormErrors";

// Applications (django-access): the machine clients that hold API tokens, with their state, token count and whether
// they carry imported legacy keys. The application list answers neither (ApplicationResponse has no token_count or
// legacy), so each application's tokens are read after the list shows, SUMMARY_CONCURRENCY at a time — the page does
// not fire one request per application at once. A failed read leaves that row's count empty, never the list.
const SUMMARY_CONCURRENCY = 4;

async function tokenSummary(application) {
  try {
    const tokens = await GET_AccessAllTokens(application.id);
    return { token_count: tokens.length, legacy: tokens.some((token) => token.legacy) };
  } catch {
    return { token_count: null, legacy: false };
  }
}

// Fills each row's summary in place (the rows are the page's reactive ones), by a few workers sharing one queue; they
// stop taking rows once `stopped()` (the page was left).
async function fillSummaries(rows, stopped) {
  const queue = [...rows];
  const worker = async () => {
    for (let row = queue.shift(); row && !stopped(); row = queue.shift()) Object.assign(row, await tokenSummary(row));
  };
  await Promise.all(Array.from({ length: SUMMARY_CONCURRENCY }, worker));
}

export default {
  name: "AccessApplicationList",
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { applications: [], loading: false, left: false };
  },
  computed: {
    columns() {
      return [
        { key: "name", label: this.$t("access.applications.name"), width: "1fr" },
        { key: "is_active", label: this.$t("access.applications.state"), width: "max-content" },
        { key: "token_count", label: this.$t("access.applications.tokens"), width: "120px", numeric: true, priority: 2 },
      ];
    },
    fabActions() {
      return [
        { icon: "add", label: this.$t("access.applications.create"), handler: () => this.$router.push("/access/applications/new") },
      ];
    },
  },
  mounted() {
    this.fetchApplications();
  },
  beforeUnmount() {
    this.left = true;
  },
  methods: {
    applicationLink(row) {
      return `/access/applications/${row.id}`;
    },
    openApplication(row) {
      this.$router.push(this.applicationLink(row));
    },
    async fetchApplications() {
      this.loading = true;
      try {
        const applications = await GET_AccessAllApplications();
        this.applications = applications.map((application) => ({ ...application, token_count: null, legacy: false }));
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
      await fillSummaries(this.applications, () => this.left);
    },
  },
};
</script>

<style lang="scss" scoped>
// Application names are free text (a BDD run names them by a 32-hex id): a long word wraps instead of clipping.
.application-name {
  overflow-wrap: anywhere;
}
</style>
