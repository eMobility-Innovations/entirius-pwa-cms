<template>
  <div class="flex flex-column">
    <div class="flex ai-ct jc-sb mb-8">
      <h2 class="fs-400 fw-600">{{ $t("atlas.tabs.feeds") }}</h2>
      <p class="fs-200 t-muted m-0">
        {{ $t("atlas.feeds.readonly_hint") }}
      </p>
    </div>

    <Loader block v-show="loading" />

    <DataTable
      v-show="!loading"
      :columns="columns"
      :rows="feeds"
      row-key="idx"
      :empty-text="$t('atlas.feeds.empty')"
      @row-click="openDetail"
    >
      <template #cell-connector_kind="{ value }">
        <StatusBadge :label="value" tone="info" />
      </template>
      <template #cell-status_combined="{ row }">
        <div class="flex ai-ct gap-2 flex-wrap">
          <StatusBadge
            :label="row.is_active ? $t('common.active') : $t('common.inactive')"
            :tone="row.is_active ? 'positive' : 'negative'"
          />
          <StatusBadge
            v-if="row.last_sync_status"
            :label="row.last_sync_status"
            :tone="syncStatusVariant(row.last_sync_status)"
          />
        </div>
      </template>
      <template #cell-last_sync_at="{ value }">
        <span v-if="value">{{ formatDate(value) }}</span>
        <span v-else class="t-muted">{{ dash }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex ai-ct gap-2" @click.stop>
          <IconButton
            icon="play"
            size="sm"
            :label="$t('atlas.feeds.trigger_button')"
            :data-testid="`feeds-trigger-${row.idx}`"
            @click="triggerFeed(row)"
          />
        </div>
      </template>
    </DataTable>

    <FeedDetailDrawer
      :visible="detailVisible"
      :feed="detailFeed"
      :supplier-idx="supplier?.idx || ''"
      @close="closeDetail"
    />

    <ConfirmDialog
      :open="triggerVisible"
      @confirm="executeTrigger"
      @cancel="triggerVisible = false"
      :title="$t('atlas.feeds.trigger_title')"
    >
      <template #default>
        <p>
          {{
            $t("atlas.feeds.trigger_body", {
              idx: triggerTarget?.idx || "",
            })
          }}
        </p>
      </template>
    </ConfirmDialog>
  </div>
</template>

<script>
import FeedDetailDrawer from "../components/FeedDetailDrawer.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { GET_Feeds, POST_FeedTrigger } from "@/api/atlas/api";

const SYNC_STATUS_VARIANTS = {
  success: "positive",
  partial: "warning",
  failed: "negative",
  running: "info",
};

export default {
  name: "FeedsTab",
  components: { FeedDetailDrawer },
  props: {
    supplier: { type: Object, default: null },
  },
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      feeds: [],
      loading: false,
      detailVisible: false,
      detailFeed: null,
      triggerVisible: false,
      triggerTarget: null,
      dash: "—",
    };
  },
  computed: {
    columns() {
      return [
        { key: "idx", label: this.$t("atlas.col.idx"), width: "1fr" },
        {
          key: "connector_kind",
          label: this.$t("atlas.feeds.col.connector"),
          width: "140px",
        },
        {
          key: "last_sync_at",
          label: this.$t("atlas.feeds.col.last_sync"),
          width: "1.5fr",
        },
        {
          key: "status_combined",
          label: this.$t("atlas.col.status"),
          width: "180px",
        },
        { key: "actions", label: "", width: "60px" },
      ];
    },
  },
  watch: {
    "supplier.idx"() {
      this.fetchFeeds();
    },
  },
  mounted() {
    this.fetchFeeds();
  },
  methods: {
    syncStatusVariant(value) {
      return SYNC_STATUS_VARIANTS[value] || "neutral";
    },
    formatDate(iso) {
      if (!iso) return this.dash;
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },
    async fetchFeeds() {
      if (!this.supplier?.idx) return;
      this.loading = true;
      try {
        const { data } = await GET_Feeds(this.supplier.idx, { page_size: 100 });
        this.feeds = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    openDetail(row) {
      this.detailFeed = row;
      this.detailVisible = true;
    },
    closeDetail() {
      this.detailVisible = false;
      this.detailFeed = null;
    },
    triggerFeed(row) {
      this.triggerTarget = row;
      this.triggerVisible = true;
    },
    async executeTrigger() {
      if (!this.triggerTarget) return;
      try {
        const { data } = await POST_FeedTrigger(
          this.supplier.idx,
          this.triggerTarget.idx
        );
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.feeds.toast.triggered", {
            run_id: data.run_id || "—",
          }),
        });
        this.triggerVisible = false;
        this.triggerTarget = null;
        this.fetchFeeds();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
  },
};
</script>
