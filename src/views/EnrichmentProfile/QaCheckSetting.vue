<template>
  <BasicCard :title="$t('enrichment.profile.qa_setting.title')">
    <Loader v-if="enabled === null" :size="24" />
    <BasicSwitch
      v-else
      :model-value="enabled"
      :label="$t('enrichment.profile.qa_setting.label')"
      :hint="$t('enrichment.profile.qa_setting.hint')"
      :disabled="saving"
      data-testid="qa-check-setting-switch"
      @update:model-value="save"
    />
  </BasicCard>
</template>

<script>
import { GET_ProfileSettings, PUT_ProfileSettings } from "@/api/enrichment/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";

// The instance default of the automatic guidelines check: every new AI text proposal is checked against the profile's
// checklists (a paid call per proposal) unless its run says otherwise. A setting, not profile content: it saves on
// change, makes no profile version and is no part of the profile form's unsaved state.
export default {
  name: "QaCheckSetting",
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { enabled: null, saving: false };
  },
  async mounted() {
    try {
      const { data } = await GET_ProfileSettings();
      this.enabled = data.qa_check;
    } catch (err) {
      this.toastError(err);
    }
  },
  methods: {
    async save(value) {
      this.saving = true;
      try {
        const { data } = await PUT_ProfileSettings({ qa_check: value });
        this.enabled = data.qa_check;
        const key = data.qa_check ? "on_toast" : "off_toast";
        this.notify.spawnNotification({ type: "positive", msg: this.$t(`enrichment.profile.qa_setting.${key}`) });
      } catch (err) {
        this.toastError(err);
      } finally {
        this.saving = false;
      }
    },
    toastError(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>
