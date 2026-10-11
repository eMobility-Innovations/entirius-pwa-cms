<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader
        :title="email"
        :overline="$t('agm.email')"
        back="/agreements/consents"
      />
    </template>
    <template #toolbar>
      <BasicTabs
        v-model="mode"
        id-prefix="consent-person"
        :options="[
          { value: 'marketing', label: $t('agm.tab_marketing') },
          { value: 'legal', label: $t('agm.tab_legal') },
        ]"
      />
    </template>

      <Loader block v-show="loading" />

      <template v-if="!loading">
        <!-- Marketing tab -->
        <div
          v-if="mode === 'marketing'"
          id="consent-person-panel-marketing"
          role="tabpanel"
          aria-labelledby="consent-person-tab-marketing"
        >
          <section class="mb-12">
            <h2 class="fs-400 fw-600 mb-8">
              {{ $t("agm.current_consents") }}
            </h2>
            <div v-if="marketingStatuses.length" class="person-detail__grid">
              <BasicCard
                v-for="item in marketingStatuses"
                :key="item.slug"
                class="person-detail__card"
              >
                <p class="fs-200 fw-600 t-secondary mb-5">
                  {{ item.name || item.slug }}
                </p>
                <StatusBadge
                  :label="$t(`agm.${item.status}`)"
                  :tone="
                    item.status === 'granted'
                      ? 'positive'
                      : item.status === 'pending'
                      ? 'warning'
                      : 'negative'
                  "
                />
              </BasicCard>
            </div>
            <p v-else class="t-muted">{{ $t("agm.no_consents") }}</p>
          </section>

          <section>
            <h2 class="fs-400 fw-600 mb-8">
              {{ $t("agm.consent_history") }}
            </h2>
            <DataTable
              :columns="historyColumns"
              :rows="marketingHistory"
              row-key="id"
              :empty-text="$t('agm.no_consents')"
            >
              <template #cell-granted="{ value }">
                <StatusBadge
                  :label="value ? $t('agm.granted') : $t('agm.withdrawn')"
                  :tone="value ? 'positive' : 'negative'"
                />
              </template>
              <template #cell-source="{ value }">
                <span>{{ $t(`agm.source_${value.replace(/-/g, "_")}`) }}</span>
              </template>
              <template #cell-created_at="{ value }">
                {{ formatDate(value) }}
              </template>
            </DataTable>
          </section>
        </div>

        <!-- Legal tab -->
        <div
          v-if="mode === 'legal'"
          id="consent-person-panel-legal"
          role="tabpanel"
          aria-labelledby="consent-person-tab-legal"
        >
          <div class="filter-chip-row mb-10" role="group" :aria-label="$t('agm.category')">
            <FilterChip
              :label="$t('agm.filter_all')"
              :active="legalFilter === 'all'"
              @click="legalFilter = 'all'"
            />
            <FilterChip
              :label="$t('agm.filter_mandatory')"
              :active="legalFilter === 'mandatory'"
              @click="legalFilter = 'mandatory'"
            />
            <FilterChip
              :label="$t('agm.filter_informational')"
              :active="legalFilter === 'informational'"
              @click="legalFilter = 'informational'"
            />
          </div>

          <section>
            <h2 class="fs-400 fw-600 mb-8">
              {{ $t("agm.consent_history") }}
            </h2>
            <DataTable
              :columns="legalHistoryColumns"
              :rows="legalHistory"
              row-key="id"
              :empty-text="$t('agm.no_consents')"
            >
              <template #cell-granted="{ value }">
                <StatusBadge
                  :label="value ? $t('agm.granted') : $t('agm.withdrawn')"
                  :tone="value ? 'positive' : 'negative'"
                />
              </template>
              <template #cell-source="{ value }">
                <span>{{ $t(`agm.source_${value.replace(/-/g, "_")}`) }}</span>
              </template>
              <template #cell-created_at="{ value }">
                {{ formatDate(value) }}
              </template>
              <template #cell-actions="{ row }">
                <BasicButton
                  v-if="row.has_content_route"
                  variant="secondary"
                  @click="viewLegalText(row)"
                >
                  {{ $t('agm.view_legal_text') }}
                </BasicButton>
              </template>
            </DataTable>
          </section>
        </div>
      </template>

    <BasicModal
      v-model:open="consentTextModal.visible"
      :title="$t('agm.legal_text_at_consent')"
      size="lg"
    >
      <p v-if="consentTextModal.data && consentTextModal.data.agreement_name" class="fs-200 t-muted mb-5">
        {{ consentTextModal.data.agreement_name }} — v{{
          consentTextModal.data.version_number
        }}
        — {{ formatDate(consentTextModal.data.consent_date) }}
      </p>
      <Loader v-if="consentTextModal.loading" />
      <p
        v-else-if="!consentTextModal.data || !consentTextModal.data.text_html"
        class="t-muted"
      >
        {{ $t("agm.no_legal_text") }}
      </p>
      <div
        v-else
        class="legal-text-preview"
        v-html="sanitizeHtml(consentTextModal.data.text_html)"
      />
    </BasicModal>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { GET_PersonDetail, GET_ConsentText } from "@/api/agreements/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

export default {
  name: "ConsentPersonDetail",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      email: "",
      currentStatuses: [],
      history: [],
      loading: false,
      mode: "marketing",
      legalFilter: "all",
      consentTextModal: {
        visible: false,
        loading: false,
        data: null,
      },
    };
  },
  computed: {
    historyColumns() {
      return [
        {
          key: "agreement_slug",
          label: this.$t("agm.agreement"),
          sortable: false,
          width: "1fr",
          priority: 2,
        },
        {
          key: "agreement_name",
          label: this.$t("agm.name"),
          sortable: false,
          width: "1fr",
        },
        {
          key: "version_number",
          label: this.$t("agm.version_number"),
          sortable: false,
          width: "80px",
          priority: 2,
          numeric: true,
        },
        {
          key: "granted",
          label: this.$t("agm.granted"),
          sortable: false,
          width: "100px",
        },
        {
          key: "source",
          label: this.$t("agm.source"),
          sortable: false,
          width: "140px",
          priority: 2,
        },
        {
          key: "channel_idx",
          label: this.$t("agm.channel"),
          sortable: false,
          width: "120px",
          priority: 2,
        },
        {
          key: "created_at",
          label: this.$t("agm.date"),
          sortable: false,
          width: "150px",
          numeric: true,
          priority: 2,
        },
      ];
    },
    legalHistoryColumns() {
      return [
        ...this.historyColumns,
        { key: "actions", label: "", sortable: false, actions: true },
      ];
    },
    marketingStatuses() {
      return this.currentStatuses.filter((s) => s.category === "marketing");
    },
    marketingHistory() {
      return this.history.filter((h) => h.category === "marketing");
    },
    legalHistory() {
      const h = this.history.filter((h) => h.category !== "marketing");
      if (this.legalFilter === "all") return h;
      return h.filter((item) => item.category === this.legalFilter);
    },
  },
  mounted() {
    this.email = decodeURIComponent(this.$route.params.email || "");
    this.fetchPersonDetail();
  },
  methods: {
    sanitizeHtml,
    formatDate(dateStr) {
      if (!dateStr) return "---";
      return new Date(dateStr).toLocaleString();
    },
    async viewLegalText(record) {
      this.consentTextModal = { visible: true, loading: true, data: null };
      try {
        const { data } = await GET_ConsentText(this.email, record.id);
        this.consentTextModal.data = data;
      } catch (err) {
        if (err?.response?.status === 404 || err?.error === "NOT_FOUND") {
          this.consentTextModal.data = { text_html: "" };
        } else {
          this.notify.spawnNotification({
            type: "negative",
            msg: extractApiMessage(err, this.$t("notifications.error")),
          });
          this.consentTextModal.visible = false;
        }
      } finally {
        this.consentTextModal.loading = false;
      }
    },
    async fetchPersonDetail() {
      if (!this.email) return;
      this.loading = true;
      try {
        const { data } = await GET_PersonDetail(this.email);
        this.currentStatuses = Object.entries(data.current_status || {}).map(
          ([slug, info]) => ({
            slug,
            status: typeof info === "object" ? info.status : info,
            category: typeof info === "object" ? info.category : "marketing",
            name: typeof info === "object" ? info.name : slug,
          })
        );
        this.history = data.history || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.person-detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-8);
}

.legal-text-preview {
  padding: var(--space-4);
  background: var(--surface-raised);
  border-radius: var(--radius-base);
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
}
</style>
