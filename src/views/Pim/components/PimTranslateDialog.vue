<template>
  <TranslateDialog
    :open="open"
    :scope="scope"
    :title="dialogTitle"
    :summary="summary"
    :languages="languageOptions"
    :source-language="pimChannel.activeChannel?.default_language || ''"
    :estimate-fn="translateFns.estimateFn"
    :submit-fn="translateFns.submitFn"
    @update:open="(value) => $emit('update:open', value)"
    @translated="$emit('translated')"
  >
    <template #languages>
      <div v-if="!addingOpen">
        <BasicButton
          variant="ghost"
          size="sm"
          data-testid="pim-translate-add-language"
          @click="addingOpen = true"
        >
          {{ $t("pim.translate_add_language_to_channel") }}
        </BasicButton>
      </div>
      <FormField v-else :label="$t('pim.translate_add_language_to_channel')">
        <div class="flex ai-ct flex-wrap gap-2">
          <BasicSelect
            v-model="newLanguage"
            class="flex-1"
            :options="addableOptions"
            :placeholder="$t('pim.translate_select_new_language')"
          />
          <BasicButton @click="closeAdding">{{ $t("common.cancel") }}</BasicButton>
          <BasicButton mutates variant="primary" :disabled="!newLanguage" :loading="addingLanguage" @click="addLanguage">
            {{ $t("pim.translate_add_language") }}
          </BasicButton>
        </div>
      </FormField>
    </template>
  </TranslateDialog>
</template>

<script>
// Pim's TranslateDialog: the channel's languages named from the system language list, adding a language to the
// channel, and the translator calls of the product and store scopes (translateFns.js).
import TranslateDialog from "@/components/TranslateDialog/index.vue";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useNotifyStore } from "@/stores/notify";
import { GET_SystemLanguages, POST_AddLanguageToChannel } from "@/api/pim/translator";
import { extractApiMessage } from "@/composables/useFormErrors";
import { productTranslateFns, storeTranslateFns } from "../translateFns";

export default {
  name: "PimTranslateDialog",
  components: { TranslateDialog },
  props: {
    open: { type: Boolean, default: false },
    scope: { type: String, required: true, validator: (value) => ["product", "store"].includes(value) },
    channelIdx: { type: String, required: true },
    entityIds: { type: Array, default: () => [] },
  },
  emits: ["update:open", "translated"],
  setup() {
    return { pimChannel: usePimChannelStore(), notify: useNotifyStore() };
  },
  data() {
    return { systemLanguages: [], addingOpen: false, addingLanguage: false, newLanguage: "" };
  },
  computed: {
    translateFns() {
      if (this.scope === "store") return storeTranslateFns(this.channelIdx);
      return productTranslateFns(this.channelIdx, this.entityIds);
    },
    dialogTitle() {
      if (this.scope === "store") return this.$t("pim.translate_store");
      return this.$t("pim.translate_selected", { count: this.entityIds.length });
    },
    summary() {
      if (this.scope === "store") return this.$t("pim.translate_store_desc");
      return `${this.entityIds.length} ${this.$t("pim.translate_selected_items")}`;
    },
    languageOptions() {
      return this.pimChannel.activeChannelLanguages.map((lang) => ({ label: this.languageLabel(lang), value: lang }));
    },
    addableOptions() {
      const assigned = new Set(this.pimChannel.activeChannelLanguages);
      return this.systemLanguages
        .filter((lang) => !assigned.has(lang.iso2))
        .map((lang) => ({ label: `${lang.iso2.toUpperCase()} — ${lang.name_en}`, value: lang.iso2 }));
    },
  },
  watch: {
    open(value) {
      if (!value) return;
      this.closeAdding();
      this.loadSystemLanguages();
    },
  },
  methods: {
    languageLabel(iso2) {
      const found = this.systemLanguages.find((lang) => lang.iso2 === iso2);
      return found ? `${iso2.toUpperCase()} - ${found.name_en}` : iso2.toUpperCase();
    },
    closeAdding() {
      this.addingOpen = false;
      this.newLanguage = "";
    },
    async loadSystemLanguages() {
      try {
        const { data } = await GET_SystemLanguages({ page_size: 200 });
        this.systemLanguages = data.results || [];
      } catch {
        // non-critical: the languages keep their codes, nothing to add
      }
    },
    async addLanguage() {
      this.addingLanguage = true;
      try {
        await POST_AddLanguageToChannel(this.channelIdx, this.newLanguage);
        await this.pimChannel.fetchChannels();
        this.closeAdding();
        this.notify.spawnNotification({ type: "positive", msg: this.$t("pim.translate_language_added") });
      } catch (err) {
        const msg = extractApiMessage(err, this.$t("pim.translate_language_add_failed"));
        this.notify.spawnNotification({ type: "negative", msg });
      } finally {
        this.addingLanguage = false;
      }
    },
  },
};
</script>
