<template>
  <PageLayout class="acc-detail__wrapper fs-300 t-body">
    <template #header>
      <PageHeader :title="pageTitle" :back="goBack" />
    </template>

    <Loader block v-if="loading" />

    <template v-else-if="customer">
      <!-- Profile Card -->
      <div class="mb-10">
        <div class="field-label mb-5">{{ $t("accounts.customer_detail") }}</div>
        <div class="acc-detail__grid">
          <FormField label="Email">
            <p class="t-body">{{ customer.email }}</p>
          </FormField>
          <FormField label="Name">
            <p class="t-body">{{ customer.firstname }} {{ customer.lastname }}</p>
          </FormField>
          <FormField :label="$t('accounts.phone')">
            <p class="t-body">{{ customer.dialling_code }} {{ customer.phone || '---' }}</p>
          </FormField>
          <FormField :label="$t('accounts.sex')">
            <p class="t-body">{{ customer.sex || '---' }}</p>
          </FormField>
          <FormField :label="$t('accounts.language')">
            <p class="t-body">{{ customer.language || '---' }}</p>
          </FormField>
          <FormField :label="$t('accounts.group')">
            <span v-if="customer.group" class="bg-accent-subtle t-strong fs-200 ph-2 rounded">
              {{ customer.group.name }}
            </span>
            <span v-else class="t-muted">---</span>
          </FormField>
          <FormField :label="$t('accounts.channel')">
            <p class="t-body">{{ customer.source_channel ? customer.source_channel.label : '---' }}</p>
          </FormField>
          <FormField :label="$t('accounts.external_id')">
            <p class="t-body">{{ customer.external_id || '---' }}</p>
          </FormField>
        </div>
      </div>

      <!-- Status Row -->
      <div class="flex flex-wrap ai-ct gap-5 rg-3 mb-10">
        <StatusBadge
          :label="customer.is_active ? $t('accounts.active') : $t('accounts.inactive')"
          :tone="customer.is_active ? 'positive' : 'negative'"
        />
        <StatusBadge
          :label="customer.is_verified ? $t('accounts.verified') : $t('accounts.not_verified')"
          :tone="customer.is_verified ? 'info' : 'neutral'"
        />
        <template v-if="customer.blacklist_channels.length">
          <span
            v-for="ch in customer.blacklist_channels"
            :key="ch.idx"
            class="bg-negative-subtle t-negative fs-200 ph-2 rounded"
          >
            {{ $t("accounts.blacklisted") }}: {{ ch.label }}
          </span>
        </template>
      </div>

      <!-- Session Info -->
      <div v-if="customer.last_session_ip || customer.last_session_country" class="mb-10">
        <div class="field-label mb-5">{{ $t("accounts.session_info") }}</div>
        <div class="acc-detail__grid">
          <FormField :label="$t('accounts.last_ip')">
            <p class="t-body">{{ customer.last_session_ip || '---' }}</p>
          </FormField>
          <FormField :label="$t('accounts.last_country')">
            <p class="t-body">{{ customer.last_session_country || '---' }}</p>
          </FormField>
        </div>
      </div>

      <!-- Extra Data -->
      <div v-if="customer.extra && Object.keys(customer.extra).length" class="mb-10">
        <div class="field-label mb-5">{{ $t("accounts.extra_data") }}</div>
        <pre class="bg-raised p-5 rounded fs-200 t-secondary ov-auto">{{ JSON.stringify(customer.extra, null, 2) }}</pre>
      </div>

      <!-- Addresses Table -->
      <div class="mb-10">
        <div class="field-label mb-5">{{ $t("accounts.addresses") }} ({{ customer.addresses_count }})</div>
        <DataTable
          :columns="addressColumns"
          :rows="customer.addresses"
          row-key="address_id"
          :empty-text="$t('accounts.no_addresses')"
        >
          <template #cell-name="{ row }">
            {{ row.firstname }} {{ row.lastname }}
            <span v-if="row.company" class="t-muted fs-200"> ({{ row.company }})</span>
          </template>
          <template #cell-defaults="{ row }">
            <div class="flex gap-2">
              <span v-if="row.is_default_billing" class="bg-positive-subtle t-positive fs-200 ph-2 rounded">
                {{ $t("accounts.default_billing") }}
              </span>
              <span v-if="row.is_default_shipping" class="bg-accent-subtle t-strong fs-200 ph-2 rounded">
                {{ $t("accounts.default_shipping") }}
              </span>
            </div>
          </template>
        </DataTable>
      </div>

      <!-- Stats -->
      <div class="flex gap-10 t-muted fs-200">
        <span>{{ $t("accounts.wishlist_items") }}: {{ customer.wishlist_items_count }}</span>
      </div>
    </template>
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { GET_Customer } from "@/api/accounts/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "CustomerDetail",
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  data() {
    return {
      customer: null,
      loading: false,
    };
  },
  computed: {
    pageTitle() {
      if (!this.customer) return this.$t("accounts.customer_detail");
      const name = (this.customer.firstname + " " + this.customer.lastname).trim();
      return name || this.customer.email;
    },
    addressColumns() {
      return [
        { key: "name", label: this.$t("accounts.name"), width: "1fr" },
        { key: "street", label: this.$t("accounts.street"), width: "1fr" },
        { key: "city", label: this.$t("accounts.city"), width: "120px" },
        { key: "postcode", label: this.$t("accounts.postcode"), width: "100px" },
        { key: "country_code", label: this.$t("accounts.country"), width: "80px" },
        { key: "defaults", label: "", width: "200px" },
      ];
    },
  },
  mounted() {
    this.fetchCustomer();
  },
  methods: {
    async fetchCustomer() {
      this.loading = true;
      try {
        const { data } = await GET_Customer(this.$route.params.uid);
        this.customer = data;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        this.$router.push("/accounts/customers");
      } finally {
        this.loading = false;
      }
    },
    // Opened from another panel (a Leads company card) the arrow returns there; only an in-app path is followed.
    goBack() {
      const back = this.$route.query.back;
      const internal = typeof back === "string" && back.startsWith("/") && !back.startsWith("//");
      this.$router.push(internal ? back : "/accounts/customers");
    },
  },
};
</script>

<style lang="scss" scoped>
.acc-detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-5);
}

@media only screen and (max-width: 768px) {
  .acc-detail__grid {
    grid-template-columns: 1fr;
  }
}
</style>
