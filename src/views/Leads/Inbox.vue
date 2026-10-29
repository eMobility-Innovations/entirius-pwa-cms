<template>
  <div ref="root" class="inbox" data-testid="leads-inbox">
    <div class="inbox__chips" data-testid="inbox-summary">
      <FilterChip
        v-for="key in FILTERS"
        :key="key"
        :label="$t(`leads.inbox.filter.${key}`)"
        :count="key === 'all' ? null : counts[key]"
        :active="filter === key"
        :class="{ 'inbox__chip--empty': key !== 'all' && !counts[key] && filter !== key }"
        :data-testid="`inbox-filter-${key}`"
        @click="setFilter(key)"
      />
    </div>

    <Loader block v-show="loading" />

    <!-- Drafts is where the work starts: empty, it says what waits for the send beat and when it leaves -->
    <EmptyState
      v-if="!loading && !rows.length && filter === 'draft'"
      icon="empty"
      :title="$t('leads.inbox.empty_title')"
      :message="emptyMessage"
      data-testid="inbox-empty"
    >
      <BasicButton data-testid="inbox-refresh" @click="reload">{{ $t("leads.inbox.refresh") }}</BasicButton>
    </EmptyState>
    <p v-else-if="!loading && !rows.length" class="t-muted m-0" data-testid="inbox-empty">{{ emptySentence }}</p>

    <InboxRow
      v-for="row in rows"
      :key="row.id"
      :row="row"
      :filter="filter"
      :active="isActive(row)"
      @send-now="sendNow"
    />
    <BasicButton v-if="next" class="as-s" :disabled="loading" data-testid="inbox-more" @click="loadPage(page + 1)">
      {{ $t("leads.thread.earlier_more") }}
    </BasicButton>
    <p v-if="error" class="t-negative m-0" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { t } from "@/i18n";
import { GET_Conversations, GET_WaitingMessages, POST_SendNow } from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useLeadsThreadStore } from "@/stores/leadsThread";
import { useLeadsReviewStore } from "@/stores/leadsReview";
import { sendStateSentence } from "@/utils/leadsLabels";
import { sendState } from "@/utils/leadsTime";
import InboxRow from "./InboxRow.vue";

// One Inbox: every conversation of the channel (one row per company or other subject_ref, never one per technical
// thread), newest activity first, behind four chips — drafts to review, mails waiting for the send beat, replies,
// all. A conversation is in a state when any of its threads is. The counts come with the list (`conversations/`
// counts), so a chip never lies.
const FILTERS = ["all", "draft", "waiting", "replied"];
const PAGE_SIZE = 20;
const POLL_MS = 30000; // the bell's cadence: a new reply shows up under Replies on the next poll

const route = useRoute();
const reviewQueue = useLeadsReviewStore();
const shownThread = useLeadsThreadStore();
const root = ref(null);
const filter = ref(null); // null until the first answer picks Drafts (when any wait) or All
const rows = ref([]);
const counts = ref({ all: 0, draft: 0, waiting: 0, replied: 0 });
const page = ref(1);
const next = ref(false);
const loading = ref(false);
const error = ref("");
const waiting = ref([]); // the outbox — only the empty Drafts state reads it, for the next departure

const firstSlot = computed(() => waiting.value.map((m) => m.next_slot).filter(Boolean).sort()[0] || "");
const emptyMessage = computed(() =>
  waiting.value.length
    ? t("leads.inbox.empty_message", { count: waiting.value.length, state: sendStateSentence(sendState(firstSlot.value)) })
    : t("leads.inbox.empty_message_none")
);
const emptySentence = computed(
  () =>
    ({
      all: t("leads.thread.no_thread"),
      waiting: t("communicator.scheduled.empty"),
      replied: t("leads.inbox.empty_replied"),
    })[filter.value]
);

function isActive(row) {
  const id = String(route.params.id);
  if (route.name === "LeadsReview") return String(row.draft?.id) === id;
  if (route.name === "LeadsConversation") return String(row.id) === id;
  // A company card shows its newest thread — the thread a company's row stands for.
  return route.name === "LeadsThread" && row.id === shownThread.shownId;
}

async function fetchPage(state, number) {
  const params = { page: number, page_size: PAGE_SIZE, ...(state === "all" ? {} : { state }) };
  return (await GET_Conversations(params)).data;
}

// Pages 1..count in one answer — a refresh keeps what "Show more" opened. A row that moved between two pages while
// they were read shows once.
async function fetchTop(state, count) {
  const pages = await Promise.all(Array.from({ length: count }, (_, index) => fetchPage(state, index + 1)));
  const seen = new Set();
  const results = pages.flatMap((data) => data.results).filter((row) => !seen.has(row.id) && seen.add(row.id));
  return { ...pages[pages.length - 1], results };
}

// No filter yet (the first answer): Drafts when any wait, else All.
async function fetchList(number, count) {
  const state = filter.value;
  if (state) return { state, data: number === 1 ? await fetchTop(state, count) : await fetchPage(state, number) };
  const drafts = await fetchTop("draft", count);
  return drafts.counts.draft ? { state: "draft", data: drafts } : { state: "all", data: await fetchTop("all", count) };
}

// Poll, chip, Show more and the review signal race each other: only the latest request writes the list, and
// `loading` follows that one.
let latest = 0;

async function loadPage(number, count = 1) {
  const request = ++latest;
  loading.value = true;
  try {
    const { state, data } = await fetchList(number, count);
    if (request !== latest) return;
    filter.value = state;
    rows.value = number === 1 ? data.results : [...rows.value, ...data.results];
    counts.value = data.counts;
    next.value = Boolean(data.next);
    page.value = number === 1 ? count : number;
    error.value = "";
    reviewQueue.setCount(data.counts.draft);
    if (state === "draft" && !data.counts.draft) waiting.value = await GET_WaitingMessages();
  } catch (err) {
    if (request !== latest) return;
    filter.value = filter.value || "all";
    error.value = extractApiMessage(err, t("leads.inbox.load_error"));
  } finally {
    if (request === latest) loading.value = false;
  }
}

const reload = () => loadPage(1);
const refresh = () => loadPage(1, page.value); // the list as far as it is open, scroll untouched

function setFilter(key) {
  if (key === filter.value) return;
  filter.value = key;
  rows.value = [];
  reload();
}

async function sendNow(messageId) {
  error.value = "";
  try {
    await POST_SendNow(messageId);
    await refresh();
  } catch (err) {
    error.value = extractApiMessage(err, t("leads.review.error"));
  }
}

// On a phone the list hides (stays mounted) while a draft or thread is open; back puts the layout's scroller where
// it was. Recorded while the list is on screen — hiding it clamps the scroller before any route watcher runs.
let scroller = null;
let scrollTop = 0;
const remember = () => route.name === "LeadsInbox" && (scrollTop = scroller.scrollTop);
watch(
  () => route.name,
  (name) => name === "LeadsInbox" && scroller && (scroller.scrollTop = scrollTop),
  { flush: "post" }
);

let timer = null;
const poll = () => document.visibilityState === "visible" && !loading.value && refresh();

onMounted(() => {
  scroller = root.value?.closest(".leads");
  scroller?.addEventListener("scroll", remember, { passive: true });
  timer = setInterval(poll, POLL_MS);
  reload();
});
onBeforeUnmount(() => {
  scroller?.removeEventListener("scroll", remember);
  clearInterval(timer);
});
// The Inbox column stays mounted while Review acts — an accepted draft moves from Drafts to Waiting at once.
watch(() => reviewQueue.changes, refresh);

defineExpose({ reload });
</script>

<style scoped>
.inbox {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-8);
}
.inbox__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.inbox__chip--empty {
  opacity: 0.5;
}
</style>
