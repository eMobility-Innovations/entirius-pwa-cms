<template>
  <BasicModal
    :open="open"
    :title="$t('dp.import')"
    :actions="actions"
    @close="$emit('close')"
  >
    <div class="flex-column gap-4">
      <FormField :label="$t('dp.import_file')" hint-level="important" hint=".csv">
        <ImportChooseFile :file-name="selectedFile?.name" @select="onFileSelect" />
      </FormField>

      <FormField :label="$t('dp.import_type')">
        <BasicSelect
          :options="typeOptions"
          v-model="typeCode"
          :placeholder="$t('common.select')"
        />
      </FormField>

      <FormField :label="$t('dp.import_mode')">
        <BasicRadioGroup v-model="mode" name="points-import-mode" :options="modeOptions" />
      </FormField>

      <FormField :label="$t('dp.import_channel')">
        <BasicInput v-model="channelIdx" />
      </FormField>

      <div v-if="importResult" class="flex-column gap-3">
        <StatusBadge :label="$t('dp.import_complete')" tone="positive" />
        <p class="fs-300 t-body">
          {{
            $t("dp.import_success", {
              created: importResult.created || 0,
              updated: importResult.updated || 0,
              disabled: importResult.disabled || 0,
            })
          }}
        </p>
      </div>
    </div>
  </BasicModal>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { GET_Types, POST_Import } from "@/api/deliverypoints/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import ImportChooseFile from "@/views/Stock/ImportChooseFile.vue";

// The import is not routed (the service imports with `manage.py import_deliverypoints`); the dialog is kept for when
// the panel opens it again.
export default {
  name: "ImportDialog",
  components: { ImportChooseFile },
  props: {
    open: { type: Boolean, default: false },
  },
  emits: ["close"],
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      types: [],
      selectedFile: null,
      typeCode: "",
      mode: "incremental",
      channelIdx: "",
      submitting: false,
      importResult: null,
    };
  },
  computed: {
    actions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: () => this.$emit("close") },
        { key: "import", role: "primary", label: this.$t("dp.import_submit"), onClick: this.submitImport,
          disabled: this.submitting || !this.selectedFile, loading: this.submitting },
      ];
    },
    modeOptions() {
      return [
        { value: "incremental", label: this.$t("dp.import_mode_incremental") },
        { value: "full", label: this.$t("dp.import_mode_full") },
      ];
    },
    typeOptions() {
      return this.types.map((t) => ({ label: t.name, value: t.code }));
    },
  },
  // Mounted while closed: the types load, and the last file and result clear, each time the dialog opens.
  watch: {
    open: {
      immediate: true,
      handler(isOpen) {
        if (!isOpen) return;
        this.selectedFile = null;
        this.importResult = null;
        this.fetchTypes();
      },
    },
  },
  methods: {
    async fetchTypes() {
      try {
        const { data } = await GET_Types({ page_size: 100 });
        this.types = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    onFileSelect(file) {
      this.selectedFile = file;
      this.importResult = null;
    },
    async submitImport() {
      if (!this.selectedFile) return;

      this.submitting = true;
      this.loader.loaderStart();
      try {
        const formData = new FormData();
        formData.append("file", this.selectedFile);
        formData.append("mode", this.mode);
        if (this.typeCode) formData.append("type_code", this.typeCode);
        if (this.channelIdx) formData.append("channel_idx", this.channelIdx);

        const { data } = await POST_Import(formData);
        this.importResult = data;

        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("dp.import_success", {
            created: data.created || 0,
            updated: data.updated || 0,
            disabled: data.disabled || 0,
          }),
        });

        this.selectedFile = null;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.submitting = false;
        this.loader.loaderFinish();
      }
    },
  },
};
</script>
