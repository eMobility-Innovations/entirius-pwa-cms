<template>
  <BasicCard
    v-if="loaded"
    :title="$t('pim.quality_settings')"
    gap
    class="mb-8"
    data-test="quality-settings-card"
  >
    <div class="form-grid">
      <FormField
        :label="$t('pim.gaps_skip_default_label')"
        :hint="$t('pim.gaps_skip_default_tooltip')"
      >
        <BasicSwitch
          :model-value="settings.gaps_skip_default_featureset"
          :disabled="saving"
          data-test="skip-default-switcher"
          @update:model-value="toggleSkipDefault"
        />
      </FormField>

      <FormField
        v-if="allSets.length"
        :label="$t('pim.default_feature_set')"
        :hint="$t('pim.default_feature_set_tooltip')"
      >
        <BasicSelect
          :options="setOptions"
          :model-value="currentDefaultIdx"
          :placeholder="$t('pim.default_feature_set')"
          data-test="default-set-picker"
          @update:model-value="onPickDefault"
        />
      </FormField>
    </div>

    <ConfirmDialog
      :open="pendingDefaultIdx != null"
      :title="$t('pim.default_feature_set')"
      :message="defaultConfirmMessage"
      :confirm-label="$t('common.confirm')"
      :cancel-label="$t('common.cancel')"
      @confirm="confirmDefaultChange"
      @cancel="pendingDefaultIdx = null"
    />
  </BasicCard>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import {
  GET_GapSettings,
  PATCH_GapSettings,
  GET_FeatureSetsGlobal,
  PATCH_FeatureSet,
} from "@/api/pim/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "QualitySettings",
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  data() {
    return {
      loaded: false,
      settings: { gaps_skip_default_featureset: true },
      allSets: [],
      pendingDefaultIdx: null,
      saving: false,
    };
  },
  computed: {
    setOptions() {
      return this.allSets.map((s) => ({ label: s.name || s.idx, value: s.idx }));
    },
    currentDefaultSet() {
      return this.allSets.find((s) => s.is_default) || null;
    },
    currentDefaultIdx() {
      return this.currentDefaultSet ? this.currentDefaultSet.idx : null;
    },
    defaultConfirmMessage() {
      if (this.currentDefaultSet) {
        return this.$t("pim.confirm_set_default", {
          name: this.currentDefaultSet.name || this.currentDefaultSet.idx,
        });
      }
      return this.$t("common.confirm");
    },
  },
  mounted() {
    this.fetchSettings();
    this.fetchSets();
  },
  methods: {
    // Soft-compat: old backend has no gaps/settings/ → card stays hidden, zero console output.
    async fetchSettings() {
      try {
        const { data } = await GET_GapSettings();
        this.settings = data;
        this.loaded = true;
      } catch {
        this.loaded = false;
      }
    },
    // Silent — without sets the picker row hides and the toggle still works.
    async fetchSets() {
      try {
        const { data } = await GET_FeatureSetsGlobal({ page_size: 100 });
        this.allSets = data.results || [];
      } catch {
        this.allSets = [];
      }
    },
    async toggleSkipDefault() {
      if (this.saving) return;
      const next = !this.settings.gaps_skip_default_featureset;
      this.saving = true;
      try {
        const { data } = await PATCH_GapSettings({
          gaps_skip_default_featureset: next,
        });
        this.settings = data;
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.quality_settings_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.saving = false;
      }
    },
    onPickDefault(idx) {
      if (idx == null || idx === this.currentDefaultIdx) return;
      this.pendingDefaultIdx = idx;
    },
    // One PATCH is enough — the backend demotes the previous default atomically.
    async confirmDefaultChange() {
      const idx = this.pendingDefaultIdx;
      this.pendingDefaultIdx = null;
      if (idx == null) return;
      this.saving = true;
      try {
        await PATCH_FeatureSet(idx, { is_default: true });
        await this.fetchSets();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.quality_settings_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
