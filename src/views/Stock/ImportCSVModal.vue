<template>
  <BasicModal
    :open="true"
    size="sm"
    :title="$t('stock.import_title')"
    :actions="footerActions"
    @close="$emit('close')"
  >
    <FormField v-if="!report" :label="$t('stock.import_select_file')">
      <ImportChooseFile :file-name="selectedFile?.name" @select="onFileSelect" />
    </FormField>

    <div v-else class="flex fd-col gap-2">
      <p class="fs-300 fw-600 t-positive mb-5">{{ $t("stock.import_success") }}</p>
      <div class="flex jc-sb fs-300">
        <span>{{ $t("stock.import_rows_parsed") }}:</span>
        <span class="fw-600">{{ report.rows_parsed }}</span>
      </div>
      <div class="flex jc-sb fs-300">
        <span>{{ $t("stock.import_rows_imported") }}:</span>
        <span class="fw-600 t-positive">{{ report.rows_imported }}</span>
      </div>
      <div v-if="report.rows_skipped > 0" class="flex jc-sb fs-300">
        <span>{{ $t("stock.import_rows_skipped") }}:</span>
        <span class="fw-600 t-warning">{{ report.rows_skipped }}</span>
      </div>
      <div v-if="report.errors && report.errors.length" class="mt-5">
        <p class="fs-200 fw-600 t-negative mb-2">{{ $t("stock.import_errors") }}:</p>
        <ul class="fs-200 t-secondary">
          <li v-for="(err, i) in report.errors.slice(0, 10)" :key="i">
            {{ $t("stock.import_row_error", { row: err.row, error: err.error }) }}
          </li>
        </ul>
      </div>
    </div>
  </BasicModal>
</template>

<script>
import { useNotifyStore } from "@/stores/notify"
import { POST_ImportCSV } from "@/api/stock/api"
import { extractApiMessage } from "@/composables/useFormErrors"
import ImportChooseFile from "./ImportChooseFile.vue"

export default {
  name: "ImportCSVModal",
  components: { ImportChooseFile },
  props: {
    warehouseCode: { type: String, required: true },
  },
  emits: ["close", "imported"],
  setup() {
    const notify = useNotifyStore()
    return { notify }
  },
  data() {
    return {
      selectedFile: null,
      uploading: false,
      report: null,
    }
  },
  computed: {
    footerActions() {
      if (this.report) {
        return [
          { key: "close", label: this.$t("common.close"), role: "secondary", onClick: () => this.$emit("close") },
          { key: "done", label: this.$t("stock.import_done"), role: "primary", onClick: () => this.$emit("imported") },
        ]
      }
      return [
        { key: "cancel", label: this.$t("common.cancel"), role: "secondary", onClick: () => this.$emit("close") },
        {
          key: "upload",
          label: this.$t("stock.import_upload"),
          role: "primary",
          disabled: !this.selectedFile,
          loading: this.uploading,
          onClick: this.upload,
        },
      ]
    },
  },
  methods: {
    onFileSelect(file) {
      this.selectedFile = file
    },
    async upload() {
      if (!this.selectedFile) return
      this.uploading = true
      try {
        const formData = new FormData()
        formData.append("file", this.selectedFile)
        const { data } = await POST_ImportCSV(this.warehouseCode, formData)
        this.report = data
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        })
        this.$emit("close")
      } finally {
        this.uploading = false
      }
    },
  },
}
</script>
