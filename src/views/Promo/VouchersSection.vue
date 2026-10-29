<template>
  <div class="vouchers-section">
    <div class="vouchers-section__subnav mb-10">
      <ReadonlyOff>
        <SegmentedControl v-model="subTab" :options="subTabOptions" />
      </ReadonlyOff>
    </div>
    <VouchersList v-if="subTab === 'vouchers'" />
    <CampaignsList v-else-if="subTab === 'campaigns'" />
    <ProductVouchersList v-else-if="subTab === 'product_vouchers'" />
    <ChannelSettings v-else-if="subTab === 'settings'" />
  </div>
</template>

<script>
import VouchersList from "./VouchersList.vue";
import CampaignsList from "./CampaignsList.vue";
import ProductVouchersList from "./ProductVouchersList.vue";
import ChannelSettings from "./ChannelSettings.vue";
import { ReadonlyOff } from "@/composables/useReadonly";

export default {
  name: "VouchersSection",
  components: {
    ReadonlyOff,
    VouchersList,
    CampaignsList,
    ProductVouchersList,
    ChannelSettings,
  },
  data() {
    const sub = this.$route.query.sub;
    return {
      subTab: ["campaigns", "product_vouchers", "settings"].includes(sub)
        ? sub
        : "vouchers",
    };
  },
  computed: {
    subTabOptions() {
      return [
        { value: "vouchers", label: this.$t("promo.sub_vouchers") },
        { value: "campaigns", label: this.$t("promo.sub_campaigns") },
        {
          value: "product_vouchers",
          label: this.$t("promo.sub_product_vouchers"),
        },
        { value: "settings", label: this.$t("promo.sub_settings") },
      ];
    },
  },
  watch: {
    subTab(sub) {
      this.$router
        .replace({ query: { ...this.$route.query, sub } })
        .catch(() => {});
    },
  },
};
</script>

<style lang="scss" scoped>
.vouchers-section__subnav {
  display: flex;
}
</style>
