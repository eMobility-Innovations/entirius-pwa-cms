<template>
  <PageLayout class="order-detail fs-300 t-body">
    <template #header>
      <PageHeader :title="order.pretty_id || $t('checkout_orders.order_detail')" :back="goBack" />
    </template>

    <div v-if="loading" class="flex jc-ct p-12"><Loader /></div>

    <template v-else-if="order.order_id">
      <!-- Header: status + total + dates in one compact row -->
      <div class="order-detail__header mb-10">
        <div class="order-detail__header-left">
          <StatusBadge :label="statusLabel(order.status)" :tone="statusVariant(order.status)" />
          <span class="fw-600 fs-500">{{ body.total || "0.00" }} {{ body.currency_code || "" }}</span>
        </div>
        <div class="order-detail__header-right t-muted fs-200">
          <span>{{ formatDate(order.created) }}</span>
          <span v-if="order.billing_email" class="t-secondary">{{ order.billing_email }}</span>
        </div>
      </div>

      <!-- Order meta: inline key-value pairs, aligned with table below -->
      <div class="order-detail__meta mb-8">
        <div class="order-detail__meta-item">
          <span class="order-detail__meta-label">{{ $t('checkout_orders.order_id') }}</span>
          <span class="order-detail__meta-value">{{ order.pretty_id }}</span>
        </div>
        <div class="order-detail__meta-item">
          <span class="order-detail__meta-label">{{ $t('checkout_orders.customer') }}</span>
          <span class="order-detail__meta-value">{{ order.customer_uid || "Guest" }}</span>
        </div>
      </div>

      <!-- Items table -->
      <div v-if="items.length" class="mb-10">
        <div class="section-label mb-5">{{ $t("checkout_orders.items") }} ({{ items.length }})</div>
        <DataTable :columns="itemColumns" :rows="items">
          <template #status="{ row }">
            <StatusBadge :label="row.status" :tone="row.status === 'valid' ? 'positive' : 'negative'" />
          </template>
          <template #tax_rate="{ row }">{{ formatTax(row.tax_rate) }}</template>
        </DataTable>
      </div>

      <!-- Delivery: shipping + payment side by side -->
      <div class="order-detail__delivery mb-10">
        <div v-if="body.shipping_method" class="order-detail__card">
          <div class="section-label mb-2">{{ $t("checkout_orders.shipping_method") }}</div>
          <p class="fw-600 t-body">{{ body.shipping_method.name || body.shipping_method.code }}</p>
          <p class="t-muted fs-200">{{ body.shipping_method.code }}</p>
          <p v-if="shippingPrice" class="t-secondary mt-2">{{ shippingPrice }}</p>
        </div>
        <div v-if="paymentMethods.length" class="order-detail__card">
          <div class="section-label mb-2">{{ $t("checkout_orders.payment_method") }}</div>
          <div v-for="method in paymentMethods" :key="method.code" class="order-detail__payment-method">
            <p class="fw-600 t-body">{{ method.name || method.code }}</p>
            <p class="t-muted fs-200">{{ method.code }}</p>
          </div>
        </div>
      </div>

      <!-- Addresses: billing + shipping side by side -->
      <div v-if="body.addresses" class="order-detail__delivery mb-10">
        <div v-if="billing" class="order-detail__card">
          <div class="section-label mb-2">{{ $t("checkout_orders.billing_address") }}</div>
          <p class="fw-600 t-body">{{ billing.firstname }} {{ billing.lastname }}</p>
          <p class="t-secondary fs-200">{{ billing.street }}</p>
          <p class="t-secondary fs-200">{{ billing.postcode }} {{ billing.city }}, {{ billing.country_code }}</p>
          <p v-if="billing.email" class="t-muted fs-200 mt-2">{{ billing.email }}</p>
          <p v-if="billing.telephone" class="t-muted fs-200">{{ billing.dialling_code }} {{ billing.telephone }}</p>
          <p v-if="billing.company" class="t-muted fs-200 mt-2">{{ billing.company }}</p>
        </div>
        <div class="order-detail__card">
          <div class="section-label mb-2">{{ $t("checkout_orders.shipping_address") }}</div>
          <template v-if="shipping">
            <p class="fw-600 t-body">{{ shipping.firstname }} {{ shipping.lastname }}</p>
            <p class="t-secondary fs-200">{{ shipping.street }}</p>
            <p class="t-secondary fs-200">{{ shipping.postcode }} {{ shipping.city }}, {{ shipping.country_code }}</p>
          </template>
          <p v-else class="t-muted fs-200">{{ $t("checkout_orders.same_as_billing") }}</p>
        </div>
      </div>

      <!-- Payment History (only if exists) -->
      <div v-if="order.payment_intents && order.payment_intents.length" class="mb-10">
        <div class="section-label mb-5">{{ $t("checkout_orders.payment_intents") }}</div>
        <DataTable :columns="paymentIntentColumns" :rows="order.payment_intents" />
      </div>

      <!-- Attachments (only if exists) -->
      <div v-if="order.attachments && order.attachments.length" class="mb-8">
        <div class="section-label mb-5">{{ $t("checkout_orders.attachments") }}</div>
        <div v-for="att in order.attachments" :key="att.file_id" class="flex ai-ct gap-2 mb-2 t-secondary fs-200">
          <span>{{ att.name || `File #${att.file_id}` }}</span>
        </div>
      </div>
    </template>
  </PageLayout>
</template>

<script>
import { GET_Order } from "@/api/orders/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { formatDate } from "@/utils/format";

const STATUS_VARIANTS = {
  UNPAID: "warning", NEW: "warning", CONFIRMED: "positive", HOLDED: "info",
  IN_PROGRESS: "info", COMPLETED: "positive", RETURNED: "neutral", CANCELED: "negative",
};

export default {
  name: "OrderDetail",
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  data() {
    return {
      order: {},
      loading: false,
      itemColumns: [
        { key: "sku", label: "SKU", width: "180px" },
        { key: "quantity", label: "Qty", width: "60px" },
        { key: "status", label: "Status", width: "90px" },
        { key: "base_unit_price", label: "Unit Price", width: "110px" },
        { key: "total_price", label: "Total", width: "110px" },
        { key: "tax_rate", label: "Tax", width: "80px" },
      ],
      paymentIntentColumns: [
        { key: "code", label: "Method", width: "140px" },
        { key: "status", label: "Status", width: "120px" },
        { key: "external_order_id", label: this.$t("checkout_orders.external_id"), width: "1fr" },
      ],
    };
  },
  computed: {
    channel() { return this.$route.query.channel || process.env.VUE_APP_CHANNEL || "default-local"; },
    body() { return this.order.order_body || {}; },
    items() { return this.body.cart?.items || []; },
    billing() { return this.body.addresses?.billing_address || null; },
    shipping() { return this.body.addresses?.shipping_address || null; },
    // payment_method became a list with the multi-method (voucher) refactor — a voucher
    // settles alongside the gateway. Orders placed before it still hold a single dict.
    paymentMethods() {
      const pm = this.body.payment_method;
      if (Array.isArray(pm)) return pm.filter((entry) => entry && entry.code);
      return pm && pm.code ? [pm] : [];
    },
    shippingPrice() {
      const sm = this.body.shipping_method;
      if (!sm) return null;
      const price = sm.unit_price || sm.total_price || sm.base_unit_price;
      return price ? `${price} ${this.body.currency_code || ""}` : null;
    },
  },
  mounted() { this.fetchOrder(); },
  methods: {
    async fetchOrder() {
      this.loading = true;
      try {
        const { data } = await GET_Order(this.channel, this.$route.params.uid);
        this.order = data;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
        this.$router.push({ name: "OrderList" });
      } finally { this.loading = false; }
    },
    goBack() { this.$router.push({ name: "OrderList" }); },
    statusVariant(status) { return STATUS_VARIANTS[(status || "").toUpperCase()] || "neutral"; },
    statusLabel(status) {
      const key = `checkout_orders.statuses.${(status || "").toUpperCase()}`;
      const t = this.$t(key);
      return t !== key ? t : status;
    },
    formatDate(dateStr) { return dateStr ? formatDate(dateStr) : "-"; },
    formatTax(rate) {
      if (!rate) return "-";
      const n = parseFloat(rate);
      return n < 1 ? `${(n * 100).toFixed(0)}%` : `${n}%`;
    },
  },
};
</script>

<style lang="scss" scoped>
.order-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-8);
  margin-bottom: var(--space-8);
  border-bottom: 1px solid var(--border-subtle);
}

.order-detail__header-left {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.order-detail__header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.order-detail__meta {
  display: flex;
  gap: var(--space-12);
  padding-bottom: var(--space-5);
}

.order-detail__meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.order-detail__meta-label {
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.order-detail__meta-value {
  font-size: var(--fs-400);
  font-weight: 600;
  color: var(--text-body);
}

.order-detail__delivery {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
}

.order-detail__card {
  padding: var(--space-4) var(--space-5);
  background: var(--surface-raised);
  border-radius: var(--radius-base);

  p {
    line-height: 1.5;
  }
}

.order-detail__payment-method + .order-detail__payment-method {
  margin-top: var(--space-5);
}

@media only screen and (max-width: 768px) {
  .order-detail__delivery {
    grid-template-columns: 1fr;
  }
  .order-detail__meta {
    flex-direction: column;
    gap: var(--space-5);
  }
  .order-detail__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .order-detail__header-right {
    align-items: flex-start;
  }
}
</style>
