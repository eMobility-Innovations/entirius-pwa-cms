<template>
  <div class="overview-grid">
    <FormField
      :label="$t('atlas.form.idx_label')"
      hint-level="important"
      :hint="$t('atlas.form.idx_tooltip')"
    >
      <BasicInput
        :model-value="form.idx"
        disabled
        data-testid="overview-idx"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.name_label')"
      :hint="$t('atlas.form.name_tooltip')"
      required
      :error="errors.name?.msg || ''"
    >
      <BasicInput v-model="form.name" :maxlength="128" data-testid="overview-name" />
    </FormField>
    <FormField
      :label="$t('atlas.form.kind_label')"
      :hint="$t('atlas.form.kind_tooltip')"
    >
      <BasicSelect
        :options="kindOptions"
        v-model="form.kind"
        data-testid="overview-kind"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.type_label')"
      hint-level="important"
      :hint="$t('atlas.form.type_tooltip')"
    >
      <BasicSelect
        :options="typeOptions"
        v-model="form.source_type"
        data-testid="overview-type"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.review_mode_label')"
      hint-level="important"
      :hint="$t('atlas.form.review_mode_tooltip')"
    >
      <BasicSelect
        :options="reviewModeOptions"
        v-model="form.review_mode"
        data-testid="overview-review-mode"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.is_active_label')"
      hint-level="important"
      :hint="$t('atlas.form.is_active_tooltip')"
    >
      <BasicSwitch
        v-model="form.is_active"
        data-testid="overview-is-active"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.default_language_label')"
      :hint="$t('atlas.form.default_language_tooltip')"
    >
      <BasicSelect
        :options="regionalStore.languageOptions"
        v-model="form.default_language_id"
        :placeholder="$t('atlas.form.select_language')"
        data-testid="overview-language"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.default_currency_label')"
      :hint="$t('atlas.form.default_currency_tooltip')"
    >
      <BasicSelect
        :options="regionalStore.currencyOptions"
        v-model="form.default_currency_id"
        :placeholder="$t('atlas.form.select_currency')"
        data-testid="overview-currency"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.country_label')"
      :hint="$t('atlas.form.country_tooltip')"
    >
      <BasicSelect
        :options="regionalStore.countryOptions"
        v-model="form.country_id"
        :placeholder="$t('atlas.form.select_country')"
        data-testid="overview-country"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.sku_prefix_label')"
      hint-level="important"
      :hint="$t('atlas.form.sku_prefix_tooltip')"
      :error="errors.sku_prefix?.msg || ''"
    >
      <BasicInput
        v-model="form.sku_prefix"
        format="key"
        :maxlength="10"
        data-testid="overview-sku-prefix"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.warehouse_label')"
      hint-level="important"
      :hint="$t('atlas.form.warehouse_tooltip')"
    >
      <BasicInput
        v-model="form.target_warehouse_code"
        :maxlength="64"
        placeholder="WH-MAIN"
        data-testid="overview-warehouse"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.feature_set_label')"
      :hint="$t('atlas.form.feature_set_tooltip')"
    >
      <BasicInput
        v-model="form.default_feature_set_idx"
        :maxlength="64"
        data-testid="overview-feature-set"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.qty_subtract_label')"
      hint-level="important"
      :hint="$t('atlas.form.qty_subtract_tooltip')"
    >
      <NumberInput
        v-model="form.qty_subtract"
        :min="0"
        :max="9999"
        data-testid="overview-qty-subtract"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.qty_minimum_label')"
      hint-level="important"
      :hint="$t('atlas.form.qty_minimum_tooltip')"
    >
      <NumberInput
        v-model="form.qty_minimum"
        :min="0"
        :max="9999"
        data-testid="overview-qty-minimum"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.lead_time_label')"
      :hint="$t('atlas.form.lead_time_tooltip')"
    >
      <NumberInput
        v-model="form.lead_time_days"
        :min="0"
        :max="365"
        data-testid="overview-lead-time"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.contact_email_label')"
      :hint="$t('atlas.form.contact_email_tooltip')"
      :error="errors.contact_email?.msg || ''"
    >
      <BasicInput
        v-model="form.contact_email"
        format="email"
        type="email"
        :maxlength="254"
        placeholder="ops@example.com"
        data-testid="overview-contact-email"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.contact_phone_label')"
      :hint="$t('atlas.form.contact_phone_tooltip')"
    >
      <BasicInput
        v-model="form.contact_phone"
        type="tel"
        :maxlength="32"
        data-testid="overview-contact-phone"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.contact_person_label')"
      :hint="$t('atlas.form.contact_person_tooltip')"
    >
      <BasicInput
        v-model="form.contact_person"
        :maxlength="128"
        data-testid="overview-contact-person"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.company_name_label')"
      :hint="$t('atlas.form.company_name_tooltip')"
      class="overview-grid__wide"
    >
      <BasicInput
        v-model="form.company_name"
        :maxlength="128"
        data-testid="overview-company"
      />
    </FormField>
    <FormField
      :label="$t('atlas.form.notes_label')"
      :hint="$t('atlas.form.notes_tooltip')"
      class="overview-grid__wide"
    >
      <BasicInput v-model="form.notes" data-testid="overview-notes" />
    </FormField>
    <!-- etap-10 (Dziura #31) — preferred-only physical writes opt-in escape hatch. -->
    <FormField
      v-if="!isMonitoringSupplier"
      :label="
        $t('atlas.form.allow_physical_writes_from_non_preferred_label')
      "
      hint-level="important"
      :hint="
        $t('atlas.form.allow_physical_writes_from_non_preferred_tooltip')
      "
      class="overview-grid__wide"
    >
      <BasicSwitch
        v-model="form.allow_physical_writes_from_non_primary"
        data-testid="overview-allow-physical-writes-non-preferred"
      />
    </FormField>
    <!-- etap-13b — auto-preferred selection per-supplier knobs. Grouped at the end
         so they sit visually under "advanced" supplier config and don't interrupt
         the everyday metadata flow. -->
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.preferred_strategy_label')"
      :hint="$t('atlas.form.preferred_strategy_tooltip')"
    >
      <BasicSelect
        v-model="form.primary_strategy"
        :options="preferredStrategyOptions"
        data-testid="overview-preferred-strategy"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.preferred_switch_cooldown_hours_label')"
      hint-level="important"
      :hint="$t('atlas.form.preferred_switch_cooldown_hours_tooltip')"
    >
      <NumberInput
        v-model="form.primary_switch_cooldown_hours"
        :min="0"
        :max="720"
        data-testid="overview-cooldown-hours"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.preferred_switch_hysteresis_pct_label')"
      hint-level="important"
      :hint="$t('atlas.form.preferred_switch_hysteresis_pct_tooltip')"
    >
      <NumberInput
        v-model="form.primary_switch_hysteresis_pct"
        :min="0"
        :max="100"
        data-testid="overview-hysteresis-pct"
      />
    </FormField>
    <FormField
      v-if="!isMonitoringSupplier"
      :label="$t('atlas.form.eval_frequency_label')"
      hint-level="important"
      :hint="$t('atlas.form.eval_frequency_tooltip')"
    >
      <BasicSelect
        v-model="form.eval_frequency"
        :options="evalFrequencyOptions"
        data-testid="overview-eval-frequency"
      />
    </FormField>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useRegionalStore } from "@/stores/regional";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { PATCH_Source } from "@/api/atlas/api";

const OVERVIEW_FORMATS = { sku_prefix: { format: "key" }, contact_email: { format: "email" } };

const FIELDS = [
  "name",
  "kind",
  "source_type",
  "review_mode",
  "is_active",
  "default_language_id",
  "default_currency_id",
  "country_id",
  "sku_prefix",
  "target_warehouse_code",
  "default_feature_set_idx",
  "qty_subtract",
  "qty_minimum",
  "lead_time_days",
  "contact_email",
  "contact_phone",
  "contact_person",
  "company_name",
  "notes",
  // etap-10 (Dziura #31) — primary-only physical writes opt-in.
  "allow_physical_writes_from_non_primary",
  // etap-13b auto-primary config
  "primary_strategy",
  "primary_switch_cooldown_hours",
  "primary_switch_hysteresis_pct",
  "eval_frequency",
];

export default {
  name: "OverviewTab",
  props: {
    supplier: { type: Object, default: null },
  },
  emits: ["updated", "header-actions"],
  setup() {
    const { errors, handleApiError, clearErrors, validateFormats } = useFormErrors();
    const regionalStore = useRegionalStore();
    regionalStore.fetchAll();
    return {
      notify: useNotifyStore(),
      regionalStore,
      errors,
      handleApiError,
      clearErrors,
      validateFormats,
    };
  },
  data() {
    return {
      form: this.buildForm(this.supplier),
      original: this.buildForm(this.supplier),
      saving: false,
    };
  },
  computed: {
    isMonitoringSupplier() {
      return this.supplier?.kind === "monitoring";
    },
    isDirty() {
      return FIELDS.some((k) => this.form[k] !== this.original[k]);
    },
    // Save lives in SourceDetail's PageHeader (R5), not in the tab.
    headerActions() {
      return [
        {
          key: "save",
          label: this.$t("common.save"),
          role: "primary",
          disabled: this.saving || !this.isDirty,
          testid: "suppliers-overview-save",
          onClick: this.save,
        },
      ];
    },
    kindOptions() {
      return [
        { value: "procurement", label: this.$t("atlas.kind.procurement") },
        { value: "monitoring", label: this.$t("atlas.kind.monitoring") },
        { value: "enrichment", label: this.$t("atlas.kind.enrichment") },
      ];
    },
    typeOptions() {
      return [
        { value: "feed", label: this.$t("atlas.type.feed") },
        { value: "manual", label: this.$t("atlas.type.manual") },
        { value: "dropship", label: this.$t("atlas.type.dropship") },
      ];
    },
    reviewModeOptions() {
      return [
        { value: "manual", label: this.$t("atlas.review_mode.manual") },
        { value: "auto", label: this.$t("atlas.review_mode.auto") },
      ];
    },
    preferredStrategyOptions() {
      return [
        {
          value: "lowest_cost_with_stock",
          label: this.$t("atlas.preferred_strategy.lowest_cost_with_stock"),
        },
        {
          value: "highest_stock",
          label: this.$t("atlas.preferred_strategy.highest_stock"),
        },
        {
          value: "manual_only",
          label: this.$t("atlas.preferred_strategy.manual_only"),
        },
      ];
    },
    evalFrequencyOptions() {
      return [
        { value: "daily", label: this.$t("atlas.eval_frequency.daily") },
        { value: "hourly", label: this.$t("atlas.eval_frequency.hourly") },
        { value: "manual", label: this.$t("atlas.eval_frequency.manual") },
      ];
    },
  },
  watch: {
    headerActions: {
      handler(actions) {
        this.$emit("header-actions", actions);
      },
      immediate: true,
    },
    supplier: {
      handler(newVal) {
        this.form = this.buildForm(newVal);
        this.original = this.buildForm(newVal);
      },
      deep: false,
    },
  },
  beforeUnmount() {
    this.$emit("header-actions", []);
  },
  methods: {
    buildForm(supplier) {
      const out = { idx: supplier?.idx || "" };
      for (const k of FIELDS) {
        out[k] = supplier?.[k] ?? this.fieldDefault(k);
      }
      return out;
    },
    fieldDefault(field) {
      if (["qty_subtract", "qty_minimum", "lead_time_days"].includes(field))
        return 0;
      if (field === "is_active") return true;
      if (field === "kind") return "procurement";
      if (field === "source_type") return "feed";
      if (field === "review_mode") return "manual";
      if (field === "primary_strategy") return "lowest_cost_with_stock";
      if (field === "primary_switch_cooldown_hours") return 24;
      if (field === "primary_switch_hysteresis_pct") return 2;
      if (field === "eval_frequency") return "daily";
      if (field === "allow_physical_writes_from_non_primary") return false;
      if (
        ["default_language_id", "default_currency_id", "country_id"].includes(
          field
        )
      )
        return null;
      return "";
    },
    // Only a value changed here is checked: a stored one the operator did not touch never blocks the save.
    changedFormats() {
      return Object.fromEntries(Object.entries(OVERVIEW_FORMATS).filter(([k]) => this.form[k] !== this.original[k]));
    },
    async save() {
      if (!this.supplier) return;
      this.clearErrors();
      if (!this.validateFormats(this.form, this.changedFormats())) return;
      this.saving = true;
      try {
        const payload = {};
        for (const k of FIELDS) {
          if (this.form[k] !== this.original[k]) payload[k] = this.form[k];
        }
        if (Object.keys(payload).length === 0) {
          this.saving = false;
          return;
        }
        const { data } = await PATCH_Source(this.supplier.idx, payload);
        this.original = this.buildForm(data);
        this.form = this.buildForm(data);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.toast.updated", {
            name: data.name || data.idx,
          }),
        });
        this.$emit("updated", data);
      } catch (err) {
        this.handleApiError(err);
        if (Object.keys(this.errors).length === 0) {
          this.notify.spawnNotification({
            type: "negative",
            msg: extractApiMessage(err, this.$t("notifications.error")),
          });
        }
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-8);
}
.overview-grid__wide {
  grid-column: 1 / -1;
}
</style>
