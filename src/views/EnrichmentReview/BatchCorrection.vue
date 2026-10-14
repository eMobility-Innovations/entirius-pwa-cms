<template>
  <BasicButton size="sm" mutates :disabled="!count" data-testid="batch-correct" @click="openDialog">
    {{ $t("enrichment.correct.all", { count }) }}
  </BasicButton>
  <BasicModal
    v-model:open="open"
    :title="$t('enrichment.correct.all_title', { count })"
    :persistent="busy"
    data-testid="batch-correct-dialog"
  >
    <div class="flex-column gap-5">
      <p class="fs-300 t-secondary m-0">{{ $t("enrichment.correct.all_hint") }}</p>
      <CorrectionBar batch :busy="busy" @submit="submit" />
    </div>
  </BasicModal>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_Proposals, POST_ReviseTask } from "@/api/enrichment/api";
import CorrectionBar from "./CorrectionBar.vue";
import { reviseBody } from "./correction";

// "Correct all N in this run": one instruction or quick action for every pending proposal of a task — across all its
// products, whatever the page filters (contract A3 § 1 Batch). N is that task-wide count, read from the API and
// re-read when the dialog opens. The corrections run in the background, one AI call per proposal; `queued` reports
// how many went (the caller refreshes later).
export default {
  name: "BatchCorrection",
  components: { CorrectionBar },
  props: {
    taskId: { type: Number, required: true },
  },
  emits: ["queued"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { open: false, busy: false, count: 0 };
  },
  watch: {
    taskId: { immediate: true, handler: "loadCount" },
  },
  methods: {
    async loadCount() {
      try {
        const { data } = await GET_Proposals({ task: this.taskId, status: "pending", page_size: 1 });
        this.count = data.count || 0;
      } catch (err) {
        this.count = 0;
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      }
    },
    openDialog() {
      this.open = true;
      this.loadCount();
    },
    async submit({ instruction, quickAction }) {
      this.busy = true;
      try {
        const { data } = await POST_ReviseTask(this.taskId, reviseBody({ instruction, quickAction }));
        this.open = false;
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.correct.all_queued", { count: data.queued }) });
        this.$emit("queued", data.queued);
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
