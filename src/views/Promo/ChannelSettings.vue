<template>
  <div class="channel-settings">
    <Loader block v-show="loading" />
    <BasicCard v-show="!loading">
      <div class="flex ai-ct jc-sb mb-10">
        <h3 class="fs-400 fw-600">
          {{ $t("promo.cfg_title") }} · {{ form.idx }}
        </h3>
        <BasicButton mutates
          variant="primary"
          :disabled="saving"
          @click="save"
        >
          {{ $t('promo.btn_save') }}
        </BasicButton>
      </div>

      <h4 class="cfg-section">{{ $t("promo.cfg_section_validity") }}</h4>
      <div class="cfg-grid">
        <FormField :label="$t('promo.cfg_label')">
          <BasicInput v-model="form.label" />
        </FormField>
        <FormField :label="$t('promo.cfg_validity_days')" :hint="$t('promo.cfg_validity_days_tip')">
          <NumberInput
            v-model="form.default_validity_period_days"
            :min="1"
            :max="3650"
          />
        </FormField>
        <FormField :label="$t('promo.pv_validity_precision')">
          <BasicSelect
            :options="precisionOptions"
            v-model="form.validity_precision"
          />
        </FormField>
        <FormField :label="$t('promo.pv_expiry_starts_from')">
          <BasicSelect
            :options="expiryStartsOptions"
            v-model="form.expiry_starts_from"
          />
        </FormField>
        <FormField :label="$t('promo.cfg_allow_extension')" :hint="$t('promo.cfg_allow_extension_tip')">
          <BasicSwitch
            v-model="form.allow_extension"
          />
        </FormField>
        <FormField :label="$t('promo.cfg_extension_days')" :hint="$t('promo.cfg_extension_days_tip')">
          <NumberInput
            v-model="form.extension_period_days"
            :min="1"
            :max="3650"
          />
        </FormField>
      </div>

      <h4 class="cfg-section">{{ $t("promo.cfg_section_limits") }}</h4>
      <div class="cfg-grid">
        <FormField :label="$t('promo.cfg_min_value')" :hint="$t('promo.cfg_min_value_tip')">
          <BasicInput v-model="form.min_value" type="number" />
        </FormField>
        <FormField :label="$t('promo.cfg_max_value')" :hint="$t('promo.cfg_max_value_tip')">
          <BasicInput v-model="form.max_value" type="number" />
        </FormField>
        <FormField :label="$t('promo.cfg_max_per_cart')" :hint="$t('promo.cfg_max_per_cart_tip')">
          <NumberInput
            v-model="form.max_vouchers_per_cart"
            :min="1"
            :max="99"
          />
        </FormField>
        <FormField :label="$t('promo.cfg_max_total_per_cart')" :hint="$t('promo.cfg_max_total_per_cart_tip')">
          <BasicInput
            v-model="form.max_total_voucher_value_per_cart"
            type="number"
          />
        </FormField>
        <FormField :label="$t('promo.cfg_allow_stacking')" hint-level="important" :hint="$t('promo.cfg_allow_stacking_tip')">
          <BasicSwitch
            v-model="form.allow_stacking_with_discount_codes"
          />
        </FormField>
      </div>

      <h4 class="cfg-section">{{ $t("promo.cfg_section_code") }}</h4>
      <div class="cfg-grid">
        <FormField :label="$t('promo.cfg_code_charset')" hint-level="important" :hint="$t('promo.cfg_code_charset_tip')">
          <BasicInput v-model="form.code_charset" />
        </FormField>
        <FormField :label="$t('promo.cfg_code_length')" :hint="$t('promo.cfg_code_length_tip')">
          <NumberInput v-model="form.code_length" :min="8" :max="32" />
        </FormField>
        <FormField :label="$t('promo.cfg_require_pin')" hint-level="important" :hint="$t('promo.cfg_require_pin_tip')">
          <BasicSwitch
            v-model="form.require_pin"
          />
        </FormField>
      </div>

      <h4 class="cfg-section">{{ $t("promo.cfg_section_security") }}</h4>
      <div class="cfg-grid">
        <FormField :label="$t('promo.cfg_require_approval')" hint-level="important" :hint="$t('promo.cfg_require_approval_tip')">
          <BasicSwitch
            v-model="form.require_issuance_approval"
          />
        </FormField>
        <FormField :label="$t('promo.cfg_max_failed')" :hint="$t('promo.cfg_max_failed_tip')">
          <NumberInput v-model="form.max_failed_attempts" :min="1" :max="99" />
        </FormField>
        <FormField :label="$t('promo.cfg_lockout_minutes')" :hint="$t('promo.cfg_lockout_minutes_tip')">
          <NumberInput
            v-model="form.failed_attempt_lockout_minutes"
            :min="0"
            :max="1440"
          />
        </FormField>
      </div>
    </BasicCard>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import {
  GET_ChannelConfig,
  PATCH_ChannelConfig,
  GET_VoucherMeta,
} from "@/api/voucher/api";
import { enumDescKey } from "./promo-enum-hints";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";
import { extractApiMessage } from "@/composables/useFormErrors";

function emptyForm() {
  return {
    idx: "",
    label: "",
    default_validity_period_days: "365",
    validity_precision: "datetime",
    expiry_starts_from: "purchase",
    min_value: "10.00",
    max_value: "10000.00",
    max_vouchers_per_cart: "8",
    max_total_voucher_value_per_cart: "10000.00",
    allow_stacking_with_discount_codes: false,
    allow_extension: false,
    extension_period_days: "365",
    require_issuance_approval: false,
    code_charset: "",
    code_length: "12",
    require_pin: false,
    max_failed_attempts: "5",
    failed_attempt_lockout_minutes: "30",
  };
}

export default {
  name: "ChannelSettings",
  setup() {
    return {
      notify: useNotifyStore(),
      checkoutChannel: useCheckoutChannelStore(),
    };
  },
  data() {
    return {
      loading: false,
      saving: false,
      form: emptyForm(),
      meta: { validity_precisions: [], expiry_starts_from: [] },
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
    precisionOptions() {
      return this.meta.validity_precisions.map((t) =>
        this.withDesc("validity_precision", t)
      );
    },
    expiryStartsOptions() {
      return this.meta.expiry_starts_from.map((t) =>
        this.withDesc("expiry_starts_from", t)
      );
    },
  },
  watch: {
    "checkoutChannel.activeChannelIdx"() {
      this.fetchMeta();
      this.fetchConfig();
    },
  },
  mounted() {
    this.fetchMeta();
    this.fetchConfig();
  },
  methods: {
    withDesc(kind, t) {
      const k = enumDescKey(kind, t.value);
      return { label: t.label, value: t.value, description: k ? this.$t(k) : "" };
    },
    async fetchMeta() {
      try {
        const { data } = await GET_VoucherMeta(this.channel);
        this.meta = {
          validity_precisions: data.validity_precisions || [],
          expiry_starts_from: data.expiry_starts_from || [],
        };
      } catch {
        // Non-critical — dropdowns degrade to raw values
      }
    },
    async fetchConfig() {
      this.loading = true;
      try {
        const { data } = await GET_ChannelConfig(this.channel);
        this.form = {
          idx: data.idx,
          label: data.label,
          default_validity_period_days: String(
            data.default_validity_period_days
          ),
          validity_precision: data.validity_precision,
          expiry_starts_from: data.expiry_starts_from,
          min_value: String(data.min_value),
          max_value: String(data.max_value),
          max_vouchers_per_cart: String(data.max_vouchers_per_cart),
          max_total_voucher_value_per_cart: String(
            data.max_total_voucher_value_per_cart
          ),
          allow_stacking_with_discount_codes:
            data.allow_stacking_with_discount_codes,
          allow_extension: data.allow_extension,
          extension_period_days: String(data.extension_period_days),
          require_issuance_approval: data.require_issuance_approval,
          code_charset: data.code_charset,
          code_length: String(data.code_length),
          require_pin: data.require_pin,
          max_failed_attempts: String(data.max_failed_attempts),
          failed_attempt_lockout_minutes: String(
            data.failed_attempt_lockout_minutes
          ),
        };
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractError(err),
        });
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.saving = true;
      try {
        await PATCH_ChannelConfig(this.channel, {
          label: this.form.label,
          default_validity_period_days: parseInt(
            this.form.default_validity_period_days
          ),
          validity_precision: this.form.validity_precision,
          expiry_starts_from: this.form.expiry_starts_from,
          min_value: String(this.form.min_value),
          max_value: String(this.form.max_value),
          max_vouchers_per_cart: parseInt(this.form.max_vouchers_per_cart),
          max_total_voucher_value_per_cart: String(
            this.form.max_total_voucher_value_per_cart
          ),
          allow_stacking_with_discount_codes:
            this.form.allow_stacking_with_discount_codes,
          allow_extension: this.form.allow_extension,
          extension_period_days: parseInt(this.form.extension_period_days),
          require_issuance_approval: this.form.require_issuance_approval,
          code_charset: this.form.code_charset,
          code_length: parseInt(this.form.code_length),
          require_pin: this.form.require_pin,
          max_failed_attempts: parseInt(this.form.max_failed_attempts),
          failed_attempt_lockout_minutes: parseInt(
            this.form.failed_attempt_lockout_minutes
          ),
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("promo.saved"),
        });
        this.fetchConfig();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractError(err),
        });
      } finally {
        this.saving = false;
      }
    },
    extractError(err) {
      return extractApiMessage(err, this.$t("notifications.error"));
    },
  },
};
</script>

<style lang="scss" scoped>
.cfg-section {
  font-size: var(--fs-300);
  font-weight: 600;
  margin: var(--space-10) 0 var(--space-5);
}

.cfg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-8);
}
</style>
