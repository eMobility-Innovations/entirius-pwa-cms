<template>
  <PageLayout data-testid="leads-conversation">
    <template #header>
      <!-- a phone shows the conversation alone: back to the list; the desktop keeps the list beside it -->
      <PageHeader :title="$t('leads.thread.conversation')" :back="isDesktop ? undefined : goBack" />
    </template>
    <div class="conversation flex-column gap-4">
      <Loader block v-show="loading" />
      <p v-if="missing" class="t-muted m-0" role="status" data-testid="conversation-missing">
        {{ $t("leads.thread.mail_unavailable") }}
      </p>
      <template v-if="thread">
        <h2 class="conversation__wrap fs-400 fw-600 m-0" data-testid="conversation-recipient">{{ recipient }}</h2>
        <p class="conversation__wrap m-0" data-testid="thread-subject">
          <strong>{{ threadSubject(thread.timeline) }}</strong>
          <span class="t-secondary fs-200"> · {{ $t(`leads.thread.state.${thread.status}`) }}</span>
        </p>
        <ThreadTimeline
          :busy="optoutBusy"
          :messages="thread.timeline || []"
          :optouts="thread.optouts || []"
          :waiting="waitingOf(waiting, thread.id)"
          @confirm-optout="confirmOptout"
        />
      </template>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { t } from "@/i18n";
import { GET_ThreadWithOptouts, GET_WaitingMessages, POST_ConfirmOptout } from "@/api/communicator/api";
import { useIsDesktop } from "@/composables/useIsDesktop";
import { useNotifyStore } from "@/stores/notify";
import { threadSubject, waitingOf } from "@/utils/leadsThread";
import ThreadTimeline from "./ThreadTimeline.vue";

// One thread by id — the screen of a conversation that belongs to no company, so every reply has a place.
const route = useRoute();
const router = useRouter();
const notify = useNotifyStore();
const isDesktop = useIsDesktop();

const thread = ref(null);
const waiting = ref([]);
const loading = ref(true);
const missing = ref(false);
const optoutBusy = ref(false);

const recipient = computed(() =>
  [thread.value?.recipient_name, thread.value?.recipient_email].filter(Boolean).join(" · ")
);

async function load() {
  loading.value = true;
  try {
    const [detail, mails] = await Promise.all([GET_ThreadWithOptouts(route.params.id), GET_WaitingMessages()]);
    thread.value = detail;
    waiting.value = mails;
    missing.value = false;
  } catch {
    thread.value = null;
    missing.value = true;
  } finally {
    loading.value = false;
  }
}

async function confirmOptout(replyId) {
  if (optoutBusy.value) return;
  optoutBusy.value = true;
  try {
    await POST_ConfirmOptout(replyId);
    await load();
  } catch {
    notify.spawnNotification({ msg: t("leads.review.error"), type: "negative" });
  } finally {
    optoutBusy.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push({ name: "LeadsInbox" });
}

onMounted(load);
watch(() => route.params.id, (id) => id && route.name === "LeadsConversation" && load());
</script>

<style scoped>
.conversation {
  overflow-x: clip;
}
.conversation__wrap {
  overflow-wrap: anywhere;
}
</style>
