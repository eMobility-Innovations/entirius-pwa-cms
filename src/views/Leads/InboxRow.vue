<template>
  <article
    class="inbox-row"
    :class="[`inbox-row--${marker}`, { 'inbox-row--active': active }]"
    :data-thread="row.id"
    data-testid="inbox-item"
  >
    <router-link :to="target" class="inbox-row__link" active-class="" exact-active-class="">
      <span class="inbox-row__name" data-testid="inbox-item-name">{{ name }}</span>
      <span class="inbox-row__time">
        <span v-if="row.thread_count > 1" class="inbox-row__threads" data-testid="inbox-item-threads">{{ threads }} · </span>
        {{ formatTime(row.activity_at) }}
      </span>
      <!-- two drafts to one company differ by who gets them (FIX-17 item 4); the draft may sit in an older thread -->
      <span v-if="marker === 'draft'" class="inbox-row__to" data-testid="inbox-item-to">
        {{ $t("leads.review.to") }}: {{ row.draft.recipient_email || row.recipient_email || row.recipient_name }}
      </span>
      <span class="inbox-row__subject" data-testid="inbox-item-subject">{{ subject }}</span>
      <span class="inbox-row__state" data-testid="inbox-item-state">
        <FontAwesomeIcon v-if="marker === 'waiting'" :icon="$icons.scheduled" class="inbox-row__clock" />
        <strong v-if="marker !== 'none'" class="inbox-row__marker" :data-testid="`inbox-marker-${marker}`">{{ markerText }}</strong>
        <template v-else>{{ $t(`leads.thread.state.${row.status}`) }}</template><template v-if="detail"> · {{ detail }}</template>
      </span>
    </router-link>
    <div v-if="marker === 'waiting' && canSendNow(row.waiting)" class="inbox-row__send">
      <BasicButton size="sm" data-testid="inbox-item-send-now" @click="$emit('send-now', row.waiting.id)">
        {{ $t("communicator.scheduled.send_now") }}
      </BasicButton>
    </div>
  </article>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { t } from "@/i18n";
import { useMuninStore } from "@/stores/munin";
import { loadCompanyName } from "@/utils/leadsCompanyNames";
import { sendStateSentence } from "@/utils/leadsLabels";
import { splitQuote } from "@/utils/leadsThread";
import { canSendNow, formatTime, sendState } from "@/utils/leadsTime";
import { pluralKey } from "@/utils/plural";
import { companyIdFromSubjectRef, routeForSubjectRef } from "@/utils/subjectRef";

// One conversation of the Inbox (its newest thread; draft, waiting mail and reply from any of its threads). The row
// keeps one layout; a single marker says what it waits for: a draft to review, a mail waiting for the send beat
// (clock + the `sendState` sentence, the one wording of a departure) or a reply.
const props = defineProps({
  row: { type: Object, required: true }, // a `conversations/` row: thread + subject, last_text, draft, waiting, replied, thread_count
  filter: { type: String, default: "all" },
  active: { type: Boolean, default: false },
});
defineEmits(["send-now"]);

const munin = useMuninStore();
const companyName = ref("");

// The chip the user looks through decides the marker of a conversation that is in several states at once.
const MARKER_ORDER = { all: ["draft", "replied", "waiting"], draft: ["draft"], waiting: ["waiting"], replied: ["replied"] };
const holds = {
  draft: (row) => Boolean(row.draft),
  waiting: (row) => Boolean(row.waiting),
  replied: (row) => row.replied,
};
const marker = computed(() => (MARKER_ORDER[props.filter] || MARKER_ORDER.all).find((key) => holds[key](props.row)) || "none");

const markerText = computed(
  () =>
    ({
      draft: t("leads.inbox.marker_draft"),
      replied: t("leads.thread.state.replied"),
      waiting: sendStateSentence(sendState(props.row.waiting?.next_slot)),
    })[marker.value]
);

const firstLine = (text) => splitQuote(text).own.split("\n").find((line) => line.trim()) || "";
const detail = computed(() => (marker.value === "waiting" ? "" : firstLine(props.row.last_text)));
const subject = computed(() => (marker.value === "draft" ? props.row.draft.subject : props.row.subject) || t("leads.inbox.untitled"));
const threads = computed(() => t(`leads.inbox.threads_${pluralKey(props.row.thread_count)}`, { count: props.row.thread_count }));
const name = computed(() => companyName.value || props.row.recipient_name || props.row.recipient_email);

// A company's thread lives in the leads module: with leads off (communicator alone) it opens as a thread by id, and
// no company is looked up.
const leadsOn = computed(() => munin.isModuleEnabled("leads"));

// A draft opens Review; any other row opens the company card, else its newest thread by id.
const target = computed(() => {
  if (marker.value === "draft") return { name: "LeadsReview", params: { id: props.row.draft.id } };
  const company = leadsOn.value && routeForSubjectRef(props.row.subject_ref);
  return company || { name: "LeadsConversation", params: { id: props.row.id } };
});

onMounted(async () => {
  const companyId = leadsOn.value && companyIdFromSubjectRef(props.row.subject_ref);
  if (companyId) companyName.value = await loadCompanyName(companyId);
});
</script>

<style scoped>
.inbox-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}
.inbox-row--draft,
.inbox-row--replied {
  border-left: 3px solid var(--accent);
}
.inbox-row--active {
  border-color: var(--accent);
}
.inbox-row__link {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-1) var(--space-5);
  min-height: 56px;
  padding: var(--space-5) var(--space-8);
  color: var(--text-body);
  text-decoration: none;
}
.inbox-row__name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.inbox-row__time {
  font-size: var(--fs-200);
  color: var(--text-muted);
}
.inbox-row__threads {
  white-space: nowrap;
}
.inbox-row__to,
.inbox-row__subject,
.inbox-row__state {
  grid-column: 1 / -1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-secondary);
}
.inbox-row__state {
  font-size: var(--fs-200);
}
.inbox-row__marker {
  color: var(--text-accent);
}
.inbox-row--waiting .inbox-row__marker {
  font-weight: 400;
  color: var(--text-secondary);
}
.inbox-row__clock {
  margin-right: var(--space-1);
  color: var(--text-muted);
}
.inbox-row__send {
  padding: 0 var(--space-8) var(--space-5);
}
</style>
