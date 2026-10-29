<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <!-- the header renders in every state: its back control stays while loading or after a failed load -->
      <PageHeader :title="$t('cf.submission_detail')" back="/forms/list">
        <template v-if="submission" #actions>
          <BasicSelect
            :floating-label="$t('cf.status')"
            :options="statusOptions"
            :model-value="submission.status"
            class="cf-detail__status"
            @update:model-value="updateStatus"
          />
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else-if="submission">
        <div class="mb-10">
          <StatusBadge
            :label="statusLabel(submission.status)"
            :tone="statusVariant(submission.status)"
          />
        </div>

        <!-- Header info -->
        <div class="cf-header mb-10">
          <div class="cf-header__row">
            <span class="cf-header__label t-muted fs-200 fw-600 tt-upper">{{
              $t("cf.id")
            }}</span>
            <span class="t-body">{{ submission.id }}</span>
          </div>
          <div class="cf-header__row">
            <span class="cf-header__label t-muted fs-200 fw-600 tt-upper">{{
              $t("cf.email")
            }}</span>
            <span class="t-body">{{ submission.email }}</span>
          </div>
          <div class="cf-header__row">
            <span class="cf-header__label t-muted fs-200 fw-600 tt-upper">{{
              $t("cf.channel")
            }}</span>
            <span class="t-body">{{ submission.channel_idx }}</span>
          </div>
          <div class="cf-header__row">
            <span class="cf-header__label t-muted fs-200 fw-600 tt-upper">{{
              $t("cf.type")
            }}</span>
            <span :class="submission.type ? 't-body' : 't-muted'">{{
              submission.type || "---"
            }}</span>
          </div>
          <div class="cf-header__row">
            <span class="cf-header__label t-muted fs-200 fw-600 tt-upper">{{
              $t("cf.slug")
            }}</span>
            <span class="t-body">{{ submission.slug || "---" }}</span>
          </div>
          <div class="cf-header__row">
            <span class="cf-header__label t-muted fs-200 fw-600 tt-upper">{{
              $t("cf.code")
            }}</span>
            <span class="t-body">{{ submission.code || "---" }}</span>
          </div>
          <div class="cf-header__row cf-header__row--full">
            <span class="cf-header__label t-muted fs-200 fw-600 tt-upper">{{
              $t("cf.created_at")
            }}</span>
            <span class="t-body">{{
              formatDate(submission.created_at)
            }}</span>
          </div>

          <!-- Form Data — full-width row at the bottom of the header grid -->
          <div class="cf-header__row cf-header__row--full">
            <h2 class="fs-400 fw-600 mb-5">{{ $t("cf.body") }}</h2>
            <div
              v-if="isRenderableObject(submission.body)"
              class="cf-fields bg-raised rounded p-8"
            >
              <div
                v-for="(val, key) in submission.body"
                :key="key"
                class="cf-field"
                :class="{ 'cf-field--full': key === 'message' }"
              >
                <span
                  class="cf-field__label t-muted fs-200 fw-600 tt-upper"
                  >{{ humanizeKey(key) }}</span
                >
                <span v-if="isSimpleValue(val)" class="t-body fs-300">{{
                  val
                }}</span>
                <pre
                  v-else
                  class="cf-body--nested bg-base rounded p-5 fs-200 t-body mt-1"
                  >{{ JSON.stringify(val, null, 2) }}</pre
                >
              </div>
            </div>
            <pre
              v-else
              class="cf-body bg-raised rounded p-8 fs-200 t-body"
              >{{ formatBody(submission.body) }}</pre
            >
          </div>
        </div>

        <!-- Attachments -->
        <div v-if="submission.attachments && submission.attachments.length">
          <h2 class="fs-400 fw-600 mb-5">{{ $t("cf.attachments") }}</h2>
          <div class="cf-attachments">
            <div
              v-for="att in submission.attachments"
              :key="att.id"
              class="cf-attachment flex ai-ct gap-5 p-5 bg-raised rounded mb-2"
            >
              <font-awesome-icon :icon="$icons.attachment" class="t-muted" />
              <span class="t-body fs-200">{{ att.name }}</span>
              <IconButton
                icon="download"
                variant="outline"
                :label="`${$t('cf.download_attachment')}: ${att.name}`"
                @click="downloadAttachment(att)"
              />
            </div>
          </div>
        </div>
      </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import {
  GET_Submission,
  GET_AttachmentDownload,
  PATCH_SubmissionStatus,
} from "@/api/contactForms/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "ContactFormDetail",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      submission: null,
      loading: false,
    };
  },
  computed: {
    statusOptions() {
      return [
        { label: this.$t("cf.status_todo"), value: "todo" },
        { label: this.$t("cf.status_in_progress"), value: "in_progress" },
        { label: this.$t("cf.status_done"), value: "done" },
      ];
    },
  },
  mounted() {
    this.fetchSubmission();
  },
  methods: {
    statusVariant(status) {
      const map = {
        todo: "warning",
        in_progress: "info",
        done: "positive",
      };
      return map[status] || "neutral";
    },
    statusLabel(status) {
      const map = {
        todo: this.$t("cf.status_todo"),
        in_progress: this.$t("cf.status_in_progress"),
        done: this.$t("cf.status_done"),
      };
      return map[status] || status || "---";
    },
    async updateStatus(newStatus) {
      if (newStatus === this.submission.status) return;
      try {
        const { data } = await PATCH_SubmissionStatus(this.submission.id, {
          status: newStatus,
        });
        this.submission.status = data.status;
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("cf.status_updated"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    formatDate(isoStr) {
      if (!isoStr) return "---";
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    formatBody(body) {
      if (!body) return "---";
      if (typeof body === "string") return body;
      return JSON.stringify(body, null, 2);
    },
    isRenderableObject(body) {
      return body && typeof body === "object" && !Array.isArray(body);
    },
    isSimpleValue(val) {
      return val === null || typeof val !== "object";
    },
    humanizeKey(key) {
      return key.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    },
    async fetchSubmission() {
      const pk = this.$route.params.id;
      this.loading = true;
      try {
        const { data } = await GET_Submission(pk);
        this.submission = data;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async downloadAttachment(att) {
      try {
        const response = await GET_AttachmentDownload(
          this.submission.id,
          att.id
        );
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", att.name || "attachment");
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.$t("notifications.error"),
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.cf-header {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.cf-header__row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cf-header__row--full {
  grid-column: 1 / -1;
}

.cf-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.cf-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cf-field--full {
  grid-column: 1 / -1;
}

.cf-detail__status {
  width: 160px;
  flex-shrink: 0;
}

.cf-body,
.cf-body--nested {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  max-height: 400px;
}
</style>
