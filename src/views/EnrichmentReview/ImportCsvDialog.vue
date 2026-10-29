<template>
  <BasicModal
    :open="visible"
    :title="$t('enrichment.import.title')"
    :actions="actions"
    @close="$emit('close')"
  >
    <div class="flex-column gap-4" data-testid="enrichment-import-dialog">
      <FormField
        :label="$t('enrichment.import.file')"
        hint-level="important"
        :hint="$t('enrichment.import.format_hint')"
      >
        <label
          class="import-csv__drop"
          :class="{ 'import-csv__drop--on': dragging }"
          data-testid="enrichment-import-drop"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <input
            type="file"
            accept=".csv,text/csv"
            class="import-csv__file-input"
            data-testid="enrichment-import-file"
            @change="onPick"
          />
          <FontAwesomeIcon :icon="$icons.importCsv" class="t-muted" />
          <span class="fs-200">{{ fileLabel }}</span>
        </label>
        <BasicButton
          variant="ghost"
          size="sm"
          class="mt-2"
          data-testid="enrichment-import-sample"
          @click="downloadSample"
        >
          {{ $t("enrichment.import.download_sample") }}
        </BasicButton>
      </FormField>

      <FormField :label="$t('enrichment.import.channel')">
        <BasicSelect
          :options="channelOptions"
          v-model="channel"
          :placeholder="$t('enrichment.import.channel')"
          data-testid="enrichment-import-channel"
        />
      </FormField>

      <FormField :label="$t('enrichment.import.language')">
        <BasicSelect
          :options="languageOptions"
          v-model="language"
          :placeholder="$t('enrichment.import.language')"
          data-testid="enrichment-import-language"
        />
      </FormField>

      <p
        v-if="error"
        class="fs-200 t-negative"
        data-testid="enrichment-import-error"
      >
        {{ error }}
      </p>
    </div>
  </BasicModal>
</template>

<script>
import { usePimChannelStore } from "@/stores/pimChannel";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { POST_ImportCsv } from "@/api/enrichment/api";

// Authoritative sample handed to the operator. Matches the backend importer's locked schema
// EXACTLY — header `sku,field,type` (django_enrichment.services.csv_import.EXPECTED_HEADER), one
// row per (subject, field), `type` = work-type (rows grouped → one task each). Verified to import
// against the live endpoint (HTTP 201, 3 tasks). Keep the header byte-identical or the import 400s.
const SAMPLE_CSV = `sku,field,type
ENT-S001,description,describe
ENT-S001,meta_title,seo
ENT-S002,short_description,describe
ENT-S002,meta_description,seo
ENT-S003,picture,media-refresh
`;

export default {
  name: "EnrichmentImportCsvDialog",
  props: {
    visible: { type: Boolean, default: false },
  },
  emits: ["close", "imported"],
  setup() {
    return { pimChannel: usePimChannelStore(), notify: useNotifyStore() };
  },
  data() {
    return {
      file: null,
      channel: "",
      language: "",
      dragging: false,
      busy: false,
      error: "",
    };
  },
  computed: {
    actions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), disabled: this.busy,
          onClick: () => this.$emit("close") },
        { key: "submit", role: "primary", label: this.$t("enrichment.import.submit"), testid: "enrichment-import-submit",
          disabled: this.busy || !this.canSubmit, loading: this.busy, onClick: this.submit },
      ];
    },
    channelOptions() {
      return this.pimChannel.channels.map((c) => ({
        value: c.idx,
        label: c.name || c.idx,
      }));
    },
    availableLanguages() {
      return this.pimChannel.activeChannelLanguages.length
        ? this.pimChannel.activeChannelLanguages
        : this.pimChannel.allLanguages;
    },
    languageOptions() {
      return this.availableLanguages.map((l) => ({
        value: l,
        label: l.toUpperCase(),
      }));
    },
    fileLabel() {
      return this.file ? this.file.name : this.$t("enrichment.import.file_hint");
    },
    canSubmit() {
      return !!this.file && !!this.channel && !!this.language;
    },
  },
  watch: {
    visible(open) {
      if (open) this.reset();
    },
  },
  methods: {
    reset() {
      this.file = null;
      this.error = "";
      this.dragging = false;
      this.channel = this.pimChannel.activeChannelIdx || "";
      const langs = this.availableLanguages;
      this.language = langs.length ? langs[0] : "";
    },
    // Hand the operator a ready-to-edit file in the exact shape the importer accepts — far fewer
    // "header must be exactly [...]" round-trips. UTF-8 Blob → anchor download, no backend call.
    downloadSample() {
      const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "enrichment-sample.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onPick(event) {
      this.setFile(event.target.files?.[0] || null);
    },
    onDrop(event) {
      this.dragging = false;
      this.setFile(event.dataTransfer?.files?.[0] || null);
    },
    setFile(file) {
      this.error = "";
      if (file && !/\.csv$/i.test(file.name)) {
        this.file = null;
        this.error = this.$t("enrichment.import.invalid_file");
        return;
      }
      this.file = file;
    },
    async submit() {
      if (this.busy || !this.canSubmit) return;
      this.busy = true;
      this.error = "";
      const form = new FormData();
      form.append("file", this.file);
      form.append("channel", this.channel);
      form.append("language", this.language);
      try {
        const { data } = await POST_ImportCsv(form);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("enrichment.import.toast_success", {
            count: data.task_count,
          }),
        });
        this.$emit("imported", data.task_count);
        this.$emit("close");
      } catch (err) {
        // Surface backend validation (bad header, empty file, ...) inline so the user can fix + retry.
        // The enrichment client's interceptor rejects with the UNWRAPPED v2 envelope (not an axios
        // error), so read it directly; fall back to the axios shape, then the generic helper. The
        // actionable reason lives in details[].description (message is the generic "validation failed").
        const body = err?.response?.data || err || {};
        this.error =
          body?.details?.[0]?.description ||
          body?.message ||
          extractApiMessage(err, this.$t("notifications.error"));
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.import-csv__drop {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 72px;
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-base);
  cursor: pointer;
  text-align: center;

  &--on {
    border-color: var(--accent);
    color: var(--text-accent);
  }
}

.import-csv__file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
