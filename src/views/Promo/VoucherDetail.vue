<template>
  <PageLayout class="voucher-detail fs-300 t-body">
    <template #header>
      <PageHeader :title="`${$t('promo.voucher_title')} #${pk}`" :back="navigateBack">
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

    <Loader block v-if="loading" />

    <template v-else-if="voucher">
      <BasicCard class="mb-10">
        <div class="flex ai-ct jc-sb mb-10">
          <StatusBadge
            :label="statusLabel(voucher.status)"
            :tone="statusVariant(voucher.status)"
          />
          <span class="fs-400 fw-600">
            {{ voucher.balance }}
            <span class="t-muted"
              >/ {{ voucher.face_value }} {{ voucher.currency }}</span
            >
          </span>
        </div>

        <div v-if="availableActions.length" class="voucher-detail__bok mb-10">
          <BasicButton mutates
            v-for="act in availableActions"
            :key="act.action"
            variant="secondary"
            @click="openAction(act)"
          >
            {{ $t('promo.act_' + act.key) }}
          </BasicButton>
        </div>

        <div
          v-if="revealedCode"
          class="voucher-detail__code bg-accent-subtle t-strong rounded p-8 mb-10"
        >
          <span class="fs-200">{{ $t("promo.voucher_code") }}:</span>
          <code class="fw-600">{{ revealedCode }}</code>
          <span v-if="hasPin" class="fs-200 t-muted"
            >({{ $t("promo.voucher_has_pin") }})</span
          >
        </div>

        <dl class="voucher-detail__grid">
          <div>
            <dt>{{ $t("promo.voucher_col_recipient") }}</dt>
            <dd>{{ voucher.recipient_email || "—" }}</dd>
          </div>
          <div>
            <dt>{{ $t("promo.voucher_col_expires") }}</dt>
            <dd>{{ formatDate(voucher.expires_at) }}</dd>
          </div>
          <div>
            <dt>{{ $t("promo.voucher_activated") }}</dt>
            <dd>{{ formatDate(voucher.activated_at) }}</dd>
          </div>
          <div>
            <dt>{{ $t("promo.voucher_col_campaign") }}</dt>
            <dd>#{{ voucher.voucher_campaign_id }}</dd>
          </div>
          <div>
            <dt>{{ $t("promo.voucher_failed_attempts") }}</dt>
            <dd>{{ voucher.failed_attempts_count }}</dd>
          </div>
          <div v-if="voucher.customer_id">
            <dt>{{ $t("promo.voucher_customer") }}</dt>
            <dd>#{{ voucher.customer_id }}</dd>
          </div>
          <div v-if="voucher.issue_reason">
            <dt>{{ $t("promo.voucher_issue_reason") }}</dt>
            <dd>{{ voucher.issue_reason }}</dd>
          </div>
          <div v-if="voucher.admin_notes">
            <dt>{{ $t("promo.voucher_admin_notes") }}</dt>
            <dd>{{ voucher.admin_notes }}</dd>
          </div>
        </dl>
      </BasicCard>

      <BasicCard>
        <ReadonlyOff>
          <SegmentedControl
            v-model="historyTab"
            :options="historyTabs"
            class="mb-10"
          />
        </ReadonlyOff>
        <DataTable
          v-if="historyTab === 'events'"
          :columns="eventColumns"
          :rows="events"
          row-key="id"
          :empty-text="$t('promo.voucher_no_events')"
        >
          <template #cell-event_type="{ row }">{{
            eventLabel(row.event_type)
          }}</template>
          <template #cell-actor="{ row }">
            {{
              row.actor_system
                ? $t("promo.voucher_system")
                : row.actor_label || `#${row.actor_user_id}`
            }}
          </template>
          <template #cell-created_at="{ row }">{{
            formatDateTime(row.created_at)
          }}</template>
        </DataTable>
        <DataTable
          v-else
          :columns="redemptionColumns"
          :rows="redemptions"
          row-key="id"
          :empty-text="$t('promo.voucher_no_redemptions')"
        >
          <template #cell-order_id="{ row }">
            <router-link
              v-if="ordersEnabled && row.order_pretty_id"
              class="t-accent"
              :to="orderRoute(row)"
              >{{ row.order_pretty_id }}</router-link
            >
            <span v-else>{{ row.order_pretty_id || row.order_id }}</span>
          </template>
          <template #cell-amount_applied="{ row }"
            >{{ row.amount_applied }} {{ row.currency }}</template
          >
          <template #cell-created_at="{ row }">{{
            formatDateTime(row.created_at)
          }}</template>
        </DataTable>
      </BasicCard>
    </template>

    <SideDrawer
      :visible="actionDrawer.open"
      :title="actionDrawer.label"
      @close="actionDrawer.open = false"
    >
      <div class="voucher-form">
        <FormField
          v-for="f in actionDrawer.fields"
          :key="f"
          :label="$t('promo.field_' + f)"
          :required="f !== 'recipient_email'"
        >
          <NumberInput
            v-if="f === 'extension_period_days'"
            v-model="actionForm[f]"
            :min="1"
            :max="3650"
          />
          <BasicInput
            v-else-if="f === 'new_balance'"
            v-model="actionForm[f]"
            type="number"
          />
          <BasicInput v-else v-model="actionForm[f]" />
        </FormField>
        <ActionBar :actions="actionDrawerActions" class="mt-10" />
      </div>
    </SideDrawer>
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useMuninStore } from "@/stores/munin";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";
import {
  GET_Voucher,
  GET_VoucherMeta,
  GET_VoucherEvents,
  GET_VoucherRedemptions,
  POST_VoucherReveal,
  POST_VoucherAction,
} from "@/api/voucher/api";
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

// Which BOK state-actions are offered per current status (backend validates too).
const STATUS_ACTIONS = {
  pending_approval: ["approve", "reject"],
  active: [
    "block",
    "extend",
    "adjust-balance",
    "resend-email",
    "reset-failed-attempts",
    "cancel",
  ],
  locked: [],
  blocked: ["unblock", "extend", "cancel"],
  expired: ["extend"],
  redeemed: [],
  canceled: [],
};

export default {
  name: "VoucherDetail",
  components: { ReadonlyOff },
  setup() {
    const notify = useNotifyStore();
    const munin = useMuninStore();
    const checkoutChannel = useCheckoutChannelStore();
    return { notify, munin, checkoutChannel };
  },
  data() {
    return {
      voucher: null,
      loading: false,
      revealedCode: "",
      hasPin: false,
      statuses: [],
      eventTypes: [],
      historyTab: "events",
      events: [],
      redemptions: [],
      redemptionsLoaded: false,
      stateActions: [],
      actionDrawer: { open: false, action: "", label: "", fields: [] },
      actionForm: {},
      actionSaving: false,
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
    pk() {
      return this.$route.params.pk;
    },
    headerActions() {
      return [{ key: "reveal", role: "secondary", label: this.$t("promo.voucher_reveal_btn"), onClick: this.reveal }];
    },
    actionDrawerActions() {
      return [
        { key: "save", role: "primary", label: this.$t("promo.btn_save"), onClick: this.submitAction,
          disabled: this.actionSaving },
      ];
    },
    historyTabs() {
      return [
        { value: "events", label: this.$t("promo.voucher_events") },
        { value: "redemptions", label: this.$t("promo.voucher_redemptions") },
      ];
    },
    eventColumns() {
      return [
        {
          key: "event_type",
          label: this.$t("promo.voucher_event"),
          width: "1fr",
        },
        { key: "actor", label: this.$t("promo.voucher_actor"), width: "200px" },
        {
          key: "created_at",
          label: this.$t("promo.voucher_when"),
          width: "180px",
        },
      ];
    },
    ordersEnabled() {
      return this.munin.isPanelEnabled("checkout");
    },
    availableActions() {
      if (!this.voucher) return [];
      return (STATUS_ACTIONS[this.voucher.status] || []).map((a) => {
        const meta = this.stateActions.find((s) => s.action === a);
        return {
          action: a,
          key: a.replace(/-/g, "_"),
          requiredFields: meta ? meta.required_fields : [],
        };
      });
    },
    redemptionColumns() {
      return [
        {
          key: "order_id",
          label: this.$t("promo.voucher_order"),
          width: "1fr",
        },
        {
          key: "amount_applied",
          label: this.$t("promo.voucher_amount"),
          width: "160px",
        },
        {
          key: "created_at",
          label: this.$t("promo.voucher_when"),
          width: "180px",
        },
      ];
    },
  },
  watch: {
    historyTab(tab) {
      if (tab === "redemptions" && !this.redemptionsLoaded)
        this.fetchRedemptions();
    },
  },
  mounted() {
    this.fetchMeta();
    this.fetchVoucher();
    this.fetchEvents();
  },
  methods: {
    statusVariant(status) {
      return STATUS_VARIANT[status] || "neutral";
    },
    statusLabel(status) {
      const found = this.statuses.find((s) => s.value === status);
      return enumLabel("voucher_status", status, found?.label.split("—")[0].trim());
    },
    eventLabel(type) {
      const found = this.eventTypes.find((e) => e.value === type);
      return found ? found.label : type;
    },
    formatDate(value) {
      return value ? value.split("T")[0] : "—";
    },
    formatDateTime(value) {
      return value ? value.replace("T", " ").slice(0, 19) : "—";
    },
    async fetchMeta() {
      try {
        const { data } = await GET_VoucherMeta(this.channel);
        this.statuses = data.statuses || [];
        this.eventTypes = data.event_types || [];
        this.stateActions = data.state_actions || [];
      } catch {
        // Non-critical — labels fall back to raw values
      }
    },
    async fetchVoucher() {
      this.loading = true;
      try {
        const { data } = await GET_Voucher(this.channel, this.pk);
        this.voucher = data;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractError(err),
        });
      } finally {
        this.loading = false;
      }
    },
    async fetchEvents() {
      try {
        const { data } = await GET_VoucherEvents(this.channel, this.pk, {
          page_size: 50,
        });
        this.events = data.results || [];
      } catch {
        // Non-critical
      }
    },
    async fetchRedemptions() {
      try {
        const { data } = await GET_VoucherRedemptions(this.channel, this.pk, {
          page_size: 50,
        });
        this.redemptions = data.results || [];
        this.redemptionsLoaded = true;
      } catch {
        // Non-critical
      }
    },
    async reveal() {
      try {
        const { data } = await POST_VoucherReveal(this.channel, this.pk);
        this.revealedCode = data.code;
        this.hasPin = data.has_pin;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractError(err),
        });
      }
    },
    orderRoute(row) {
      return { name: "OrderDetail", params: { uid: row.order_pretty_id }, query: { channel: this.channel } };
    },
    navigateBack() {
      this.$router.push({ path: "/promo/list", query: { tab: "vouchers" } });
    },
    openAction(act) {
      if (!act.requiredFields.length) {
        this.executeAction(act.action, {});
        return;
      }
      this.actionForm = {};
      for (const f of act.requiredFields) this.actionForm[f] = "";
      this.actionDrawer = {
        open: true,
        action: act.action,
        label: this.$t("promo.act_" + act.key),
        fields: act.requiredFields,
      };
    },
    submitAction() {
      const data = {};
      for (const f of this.actionDrawer.fields) {
        data[f] =
          f === "extension_period_days"
            ? parseInt(this.actionForm[f])
            : this.actionForm[f];
      }
      this.executeAction(this.actionDrawer.action, data);
    },
    async executeAction(action, data) {
      this.actionSaving = true;
      try {
        await POST_VoucherAction(this.channel, this.pk, action, data);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("promo.act_done"),
        });
        this.actionDrawer.open = false;
        this.fetchVoucher();
        this.fetchEvents();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractError(err),
        });
      } finally {
        this.actionSaving = false;
      }
    },
    extractError(err) {
      return extractApiMessage(err, this.$t("notifications.error"));
    },
  },
};
</script>

<style lang="scss" scoped>
.voucher-detail__bok {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
}

.voucher-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.voucher-detail__code {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.voucher-detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-8);
  margin: 0;

  dt {
    font-size: var(--fs-200);
    color: var(--text-muted);
    margin-bottom: 2px;
  }

  dd {
    margin: 0;
    font-weight: 600;
  }
}

/* Audit tables (events / redemptions): wrap long actor emails and event
   labels inside their own cell instead of overflowing into the next column. */
:deep(.data-table__cell) {
  overflow-wrap: anywhere;
}
</style>
