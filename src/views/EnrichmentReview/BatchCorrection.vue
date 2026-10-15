<template>
  <BasicButton size="sm" mutates :disabled="!count" data-testid="batch-correct" @click="openDialog">
    {{ $t("enrichment.correct.all", { count }) }}
  </BasicButton>
  <BasicModal
    v-model:open="open"
    :title="$t('enrichment.correct.all_title', { count })"
    :persistent="busy"
    :actions="actions"
    data-testid="batch-correct-dialog"
  >
    <div class="flex-column gap-5">
      <p class="fs-300 t-secondary m-0">{{ $t("enrichment.correct.all_hint") }}</p>
      <CorrectionBar batch :busy="busy" @submit="submit" @draft="(value) => (draft = value)" />
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
// how many went (the caller refreshes later). A suggestion chip is picked, not sent: the footer's primary sends.
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
    return { open: false, busy: false, count: 0, draft: null };
  },
  computed: {
    actions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), disabled: this.busy, onClick: this.close },
        { key: "send", role: "primary", mutates: true, label: this.$t("enrichment.correct.send_all", { count: this.count }),
          disabled: !this.draft?.ready || !this.count, loading: this.busy, testid: "batch-send",
          onClick: () => this.submit(this.draft) },
      ];
    },
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
    close() {
      this.open = false;
    },
    openDialog() {
      this.open = true;
      this.loadCount();
    },
    // One batch at a time: a second send (the footer, Enter in the composer) while one is on its way sends nothing.
    async submit({ instruction, quickAction }) {
      if (this.busy) return;
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
