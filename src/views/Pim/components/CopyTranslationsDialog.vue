<script>
import { usePimChannelStore } from "@/stores/pimChannel";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { POST_CopyTranslations } from "@/api/pim/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "CopyTranslationsDialog",
  props: {
    channelIdx: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close", "copied"],
  setup() {
    const pimChannel = usePimChannelStore();
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { pimChannel, loader, notify };
  },
  data() {
    return {
      copyMode: "all",
      selectedLanguage: "",
    };
  },
  computed: {
    sourceChannelIdx() {
      return this.pimChannel.defaultChannelIdx;
    },
    modeOptions() {
      return [
        { label: this.$t("pim.all_matching_languages"), value: "all" },
        { label: this.$t("pim.single_language_only"), value: "single" },
      ];
    },
    languageOptions() {
      return this.pimChannel.activeChannelLanguages.map((lang) => ({ label: lang.toUpperCase(), value: lang }));
    },
    // Cancel · Copy (R5).
    actions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: () => this.$emit("close") },
        { key: "copy", role: "primary", label: this.$t("common.copy"), testid: "pim-copy-translations-submit",
          disabled: this.copyMode === "single" && !this.selectedLanguage, onClick: this.confirmCopy },
      ];
    },
  },
  methods: {
    async confirmCopy() {
      const payload = { source_channel_idx: this.sourceChannelIdx };
      if (this.copyMode === "single" && this.selectedLanguage) {
        payload.languages = [this.selectedLanguage];
      }
      try {
        this.loader.loaderStart();
        await POST_CopyTranslations(this.channelIdx, this.sku, payload);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.translations_copied"),
        });
        this.$emit("copied");
        this.$emit("close");
      } catch (error) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(error, this.$t("pim.copy_translations_failed")),
        });
        this.$emit("close");
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>

<template>
  <BasicModal
    :open="visible"
    :title="$t('pim.copy_translations')"
    size="sm"
    :actions="actions"
    @close="$emit('close')"
  >
    <div class="flex-column gap-4" data-testid="pim-copy-translations-dialog">
      <p class="t-muted fs-200">
        {{ $t("pim.copy_translations_desc", { channel: sourceChannelIdx }) }}
      </p>
      <BasicRadioGroup v-model="copyMode" :options="modeOptions" :aria-label="$t('pim.copy_translations')" />
      <FormField v-if="copyMode === 'single'" :label="$t('pim.select_language')">
        <BasicSelect v-model="selectedLanguage" :options="languageOptions" :placeholder="$t('pim.select_language')" />
      </FormField>
    </div>
  </BasicModal>
</template>
