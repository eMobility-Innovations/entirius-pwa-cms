<template>
  <article class="tg" :class="{ 'tg--reply': holdsReply }" data-testid="earlier-thread">
    <div class="tg__head flex ai-st gap-3">
      <!-- the whole summary toggles for a tap on a phone; the IconButton is the keyboard and screen-reader control -->
      <div class="tg__summary flex flex-wrap ai-ct pointer" data-testid="earlier-thread-summary" @click="onSummaryClick">
        <span class="tg__subject" data-testid="earlier-thread-subject">{{ title }}</span>
        <span class="tg__meta" data-testid="earlier-thread-to">{{ $t("leads.review.to") }}: {{ recipient }}</span>
        <span class="tg__meta">
          {{ $t(`leads.thread.state.${thread.status}`) }}<template v-if="thread.last_message_at">
            · {{ formatTime(thread.last_message_at) }}</template>
        </span>
        <span v-if="holdsReply" class="tg__reply" data-testid="earlier-thread-reply">{{ $t("leads.thread.earlier_reply") }}</span>
        <StatusBadge
          v-if="pending"
          tone="negative"
          size="sm"
          :label="$t('leads.thread.optout_suspected')"
          data-testid="earlier-thread-optout"
        />
      </div>
      <IconButton
        :icon="open ? 'collapse' : 'expand'"
        :label="$t(open ? 'leads.thread.hide_thread' : 'leads.thread.show_thread')"
        :aria-expanded="String(open)"
        data-testid="earlier-thread-toggle"
        @click="toggle"
      />
    </div>
    <Loader block v-show="loading" />
    <ThreadTimeline
      v-if="open && detail"
      :messages="detail.timeline || []"
      :optouts="detail.optouts"
      :waiting="waiting"
      :busy="optoutBusy"
      @confirm-optout="confirmOptout"
    />
  </article>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { t } from "@/i18n";
import { GET_ThreadWithOptouts, POST_ConfirmOptout } from "@/api/communicator/api";
import { useNotifyStore } from "@/stores/notify";
import { threadSubject } from "@/utils/leadsThread";
import { formatTime } from "@/utils/leadsTime";
import ThreadTimeline from "./ThreadTimeline.vue";

// One older thread of the company, collapsed to its header. The conversation loads with the header: collapsed rows
// of the same company are told apart by their subject and recipient, not by opening them one by one.
const props = defineProps({
  thread: { type: Object, required: true },
  pending: { type: Boolean, default: false },
  waiting: { type: Array, default: () => [] },
  // the thread holding the reply the bell announced: opened and marked on arrival, never scrolled to — the newest
  // thread above stays on screen (FIX-17c item 5)
  holdsReply: { type: Boolean, default: false },
});
const emit = defineEmits(["changed"]);
const notify = useNotifyStore();

const open = ref(props.holdsReply);
const loading = ref(false);
const detail = ref(null);
const optoutBusy = ref(false);

const title = computed(
  () => threadSubject(detail.value?.timeline) || props.thread.recipient_name || props.thread.recipient_email
);
const recipient = computed(() =>
  [props.thread.recipient_name, props.thread.recipient_email].filter(Boolean).join(" · ")
);

async function loadDetail() {
  loading.value = true;
  try {
    detail.value = await GET_ThreadWithOptouts(props.thread.id);
  } finally {
    loading.value = false;
  }
}

function toggle() {
  open.value = !open.value;
}

// A drag that selects the subject or recipient to copy it is no tap: it leaves the thread as it is. Text selected
// outside this summary (the draft body, another thread) does not block the tap. A click reaches the summary only when
// the drag ended inside it, so one of the selection's ends is there.
function onSummaryClick(event) {
  const selection = window.getSelection();
  const inSummary = [selection?.anchorNode, selection?.focusNode].some((node) => event.currentTarget.contains(node));
  if (!selection?.toString() || !inSummary) toggle();
}

onMounted(loadDetail);

async function confirmOptout(replyId) {
  if (optoutBusy.value) return;
  optoutBusy.value = true;
  try {
    await POST_ConfirmOptout(replyId);
    await loadDetail();
    emit("changed");
  } catch {
    notify.spawnNotification({ msg: t("leads.review.error"), type: "negative" });
  } finally {
    optoutBusy.value = false;
  }
}
</script>

<style scoped>
.tg {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-subtle);
}
.tg__summary {
  flex: 1;
  min-width: 0;
  gap: var(--space-2) var(--space-5);
}
.tg__subject {
  flex: 1 1 100%;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.tg__meta {
  font-size: var(--fs-200);
  color: var(--text-secondary);
}
.tg--reply {
  border-top: 2px solid var(--accent);
}
.tg__reply {
  font-size: var(--fs-200);
  font-weight: 600;
  color: var(--text-accent);
}
</style>
