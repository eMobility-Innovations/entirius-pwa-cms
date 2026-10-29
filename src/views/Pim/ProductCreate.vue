<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pim.create_product')" back="/pim/products">
        <template #meta>
          <PimChannelSelect />
        </template>
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>
    <BasicCard :title="$t('pim.basic_info')" gap class="mb-8">
      <div class="form-grid">
        <FormField
          label="SKU"
          required
          :error="formErrors.getFieldError('sku')?.msg || ''"
        >
          <BasicInput
            v-model="form.sku"
            format="key"
            :maxlength="128"
            :placeholder="$t('pim.sku_placeholder')"
          />
        </FormField>
        <FormField
          :label="$t('pim.feature_set')"
          required
          :error="formErrors.getFieldError('feature_set_idx')?.msg || ''"
        >
          <BasicSelect
            v-model="form.feature_set_idx"
            :options="featureSetOptions"
            :placeholder="$t('pim.select_feature_set')"
          />
        </FormField>
        <FormField :label="$t('pim.visibility')">
          <BasicSelect
            :options="visibilityOptions"
            v-model="form.visibility"
          />
        </FormField>
        <FormField :label="$t('pim.status')">
          <BasicSwitch
            :label="$t('pim.enabled')"
            v-model="form.is_enabled"
          />
        </FormField>
      </div>
    </BasicCard>

    <RequiredAttributeFields
      :rows="requiredRows"
      :channel-idx="channelIdx"
      :language="language"
      :error-of="requiredError"
      @change="(idx) => formErrors.clearFieldError(idx)"
    />

    <BasicCard :title="$t('pim.physical_properties')" gap class="mb-8">
      <p class="fs-200 t-warning">
        {{ $t("pim.shared_warning") }}
      </p>
      <div class="form-grid">
        <FormField
          label="EAN"
          :error="formErrors.getFieldError('ean')?.msg || ''"
        >
          <BasicInput
            v-model="form.ean"
            format="ean"
            :maxlength="16"
            :placeholder="$t('pim.ean_placeholder')"
          />
        </FormField>
        <FormField
          :label="$t('pim.weight')"
          :error="formErrors.getFieldError('weight')?.msg || ''"
        >
          <BasicInput
            v-model="form.weight"
            placeholder="kg"
          />
        </FormField>
        <FormField
          :label="$t('pim.width')"
          :error="formErrors.getFieldError('width')?.msg || ''"
        >
          <BasicInput
            v-model="form.width"
            placeholder="cm"
          />
        </FormField>
        <FormField
          :label="$t('pim.height')"
          :error="formErrors.getFieldError('height')?.msg || ''"
        >
          <BasicInput
            v-model="form.height"
            placeholder="cm"
          />
        </FormField>
        <FormField
          :label="$t('pim.depth')"
          :error="formErrors.getFieldError('deep')?.msg || ''"
        >
          <BasicInput
            v-model="form.deep"
            placeholder="cm"
          />
        </FormField>
      </div>
    </BasicCard>

    <BasicCard
      v-if="otherChannels.length"
      :title="$t('pim.also_add_to_channels')"
      gap
      class="mb-8"
    >
      <div v-for="ch in otherChannels" :key="ch.idx" class="flex-column gap-1">
        <BasicCheckbox
          :model-value="isChannelSelected(ch.idx)"
          @update:model-value="(on) => toggleChannel(ch.idx, on)"
        >
          {{ ch.name + " (" + ch.idx + ")" }}
        </BasicCheckbox>
        <BasicCheckbox
          v-if="isChannelSelected(ch.idx)"
          class="ml-6"
          :model-value="getChannelOption(ch.idx, 'inherit')"
          @update:model-value="
            (on) => setChannelOption(ch.idx, 'inherit', on)
          "
        >
          {{ $t("pim.inherit_translations") }}
        </BasicCheckbox>
      </div>
    </BasicCard>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  POST_Product,
  GET_FeatureSets,
  POST_AddToChannel,
} from "@/api/pim/api";
import { loadRequiredFeatures } from "@/composables/usePimCapabilities";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import RequiredAttributeFields from "./components/RequiredAttributeFields.vue";
import { buildAttributePayload, isRowFilled, rowsFromRequired } from "./helpers/requiredFeatures";

const PRODUCT_FORMATS = { sku: { format: "key" }, ean: { format: "ean" } };

export default {
  name: "ProductCreate",
  components: { PimChannelSelect, RequiredAttributeFields },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const formErrors = useFormErrors();
    return { loader, notify, pimChannel, formErrors };
  },
  data() {
    return {
      form: {
        sku: "",
        feature_set_idx: "",
        visibility: 4,
        is_enabled: true,
        ean: "",
        weight: "",
        width: "",
        height: "",
        deep: "",
      },
      featureSetOptions: [],
      visibilityOptions: [
        { label: "Not visible individually", value: 1 },
        { label: "Catalog", value: 2 },
        { label: "Search", value: 3 },
        { label: "Catalog & Search", value: 4 },
      ],
      selectedChannels: {},
      // Inputs of the set's required features; stays empty on a PIM older than 3.3.0 (legacy create).
      requiredRows: [],
    };
  },
  computed: {
    headerActions() {
      return [
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.createProduct },
      ];
    },
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    language() {
      return (this.pimChannel.activeChannelLanguages?.[0] || "en").toLowerCase();
    },
    otherChannels() {
      return this.pimChannel.channels.filter(
        (ch) => ch.idx !== this.channelIdx
      );
    },
  },
  watch: {
    "pimChannel.activeChannelIdx"() {
      this.fetchFeatureSets();
    },
    "form.feature_set_idx"(idx) {
      this.fetchRequiredFeatures(idx);
    },
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  mounted() {
    this.fetchFeatureSets();
  },
  methods: {
    async fetchFeatureSets() {
      try {
        const { data } = await GET_FeatureSets(this.channelIdx);
        this.featureSetOptions = (data.results || []).map((fs) => ({
          label: `${fs.name} (${fs.idx})`,
          value: fs.idx,
        }));
      } catch {
        // Feature sets may not be available yet
      }
    },
    async fetchRequiredFeatures(idx) {
      this.requiredRows = [];
      const data = await loadRequiredFeatures(idx);
      if (!data || idx !== this.form.feature_set_idx) return;
      this.requiredRows = rowsFromRequired(data);
    },
    requiredError(idx) {
      return this.formErrors.getFieldError(idx)?.msg || "";
    },
    validateRequiredRows() {
      let valid = true;
      for (const row of this.requiredRows) {
        if (isRowFilled(row)) continue;
        this.formErrors.errors[row.feature_idx] = { status: "error", msg: this.$t("pim.required_field") };
        valid = false;
      }
      return valid;
    },
    isChannelSelected(idx) {
      return !!this.selectedChannels[idx];
    },
    getChannelOption(idx, key) {
      return this.selectedChannels[idx]?.[key] ?? true;
    },
    toggleChannel(idx, selected) {
      if (selected) {
        this.selectedChannels = {
          ...this.selectedChannels,
          [idx]: { inherit: true },
        };
      } else {
        const { [idx]: _, ...rest } = this.selectedChannels;
        this.selectedChannels = rest;
      }
    },
    setChannelOption(idx, key, value) {
      if (!this.selectedChannels[idx]) return;
      this.selectedChannels = {
        ...this.selectedChannels,
        [idx]: { ...this.selectedChannels[idx], [key]: value },
      };
    },
    async createProduct() {
      const valid = this.formErrors.validateRequired(this.form, {
        sku: "SKU",
        feature_set_idx: this.$t("pim.feature_set"),
      });
      if (!valid || !this.formErrors.validateFormats(this.form, PRODUCT_FORMATS)) return;
      if (!this.validateRequiredRows()) return;

      this.loader.loaderStart();
      try {
        const payload = {
          sku: this.form.sku,
          feature_set_idx: this.form.feature_set_idx,
          visibility: this.form.visibility,
          is_enabled: this.form.is_enabled,
        };
        if (this.form.ean) payload.ean = this.form.ean;
        if (this.form.weight) payload.weight = this.form.weight;
        if (this.form.width) payload.width = this.form.width;
        if (this.form.height) payload.height = this.form.height;
        if (this.form.deep) payload.deep = this.form.deep;
        if (this.requiredRows.length) payload.attributes = buildAttributePayload(this.requiredRows);

        const { data } = await POST_Product(this.channelIdx, payload);

        // Add to selected channels
        const channelIdxs = Object.keys(this.selectedChannels);
        for (const targetIdx of channelIdxs) {
          const opts = this.selectedChannels[targetIdx];
          try {
            await POST_AddToChannel(this.channelIdx, data.sku, {
              target_channel_idx: targetIdx,
              copy_content: true,
              inherit: opts.inherit,
            });
          } catch (err) {
            this.notify.spawnNotification({
              type: "warning",
              msg: this.$t("pim.add_to_channel_failed") + ` (${targetIdx})`,
            });
          }
        }

        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.product_created"),
        });
        this.$router.push(`/pim/products/${data.sku}`);
      } catch (err) {
        this.formErrors.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>
