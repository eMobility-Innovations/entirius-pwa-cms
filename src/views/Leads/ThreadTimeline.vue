<template>
  <ol class="tl" data-testid="thread-timeline">
    <li v-if="!entries.length" class="tl__empty">{{ $t("leads.thread.empty") }}</li>
    <li
      v-for="(entry, i) in entries"
      :key="i"
      class="tl__entry"
      :class="`tl__entry--${entry.side}`"
      :data-testid="`timeline-${entry.side}`"
    >
      <div class="tl__bubble">
        <p v-if="entry.tag" class="tl__tag">{{ entry.tag }}</p>
        <p v-if="entry.subject" class="tl__subject">{{ entry.subject }}</p>
        <p class="tl__body">{{ entry.text.own }}</p>
        <template v-if="entry.text.quoted">
          <BasicButton
            class="tl__quote-toggle"
            variant="ghost"
            size="sm"
            :aria-expanded="String(quotesOpen.has(i))"
            data-testid="timeline-quote-toggle"
            @click="toggleQuote(i)"
          >
            {{ $t(quotesOpen.has(i) ? "leads.thread.quote_hide" : "leads.thread.quote_show") }}
          </BasicButton>
          <p v-if="quotesOpen.has(i)" class="tl__body tl__quote" data-testid="timeline-quote">{{ entry.text.quoted }}</p>
        </template>
        <p class="tl__meta">
          <span v-if="!entry.sendState" data-testid="timeline-time">{{ formatTime(entry.at) }}</span>
          <span v-if="entry.status" class="tl__status" :data-testid="`status-${entry.status}`">
            {{ $t(`leads.status.${entry.status}`) }}<template v-if="entry.sendState"> · {{ entry.sendState }}</template>
          </span>
        </p>
        <div v-if="entry.optout" class="tl__optout">
          <span v-if="entry.optout.optout_confirmed_at">{{ $t("leads.thread.optout_confirmed") }}</span>
          <template v-else>
            <span>{{ $t("leads.thread.optout_suspected") }}</span>
            <BasicButton variant="danger" :disabled="busy" data-testid="confirm-optout" @click="$emit('confirm-optout', entry.optout.id)">
              {{ $t("leads.thread.confirm_optout") }}
            </BasicButton>
          </template>
        </div>
      </div>
    </li>
  </ol>
</template>

<script setup>
import { computed, reactive } from "vue";
import { t } from "@/i18n";
import { sendStateLabel } from "@/utils/leadsLabels";
import { splitQuote } from "@/utils/leadsThread";
import { formatTime, sendState } from "@/utils/leadsTime";

// The chat timeline of ONE communicator thread: our messages and the replies, oldest first.
const props = defineProps({
  messages: { type: Array, default: () => [] },
  optouts: { type: Array, default: () => [] },
  // approved/scheduled messages of this thread — their `next_slot` is what a waiting bubble says, as in the Inbox
  waiting: { type: Array, default: () => [] },
  // an opt-out confirmation is in flight — the button stays disabled until it settles
  busy: { type: Boolean, default: false },
});
defineEmits(["confirm-optout"]);

const WAITING_STATUSES = ["approved", "scheduled"];
const quotesOpen = reactive(new Set());

function toggleQuote(index) {
  if (!quotesOpen.delete(index)) quotesOpen.add(index);
}

// A message entry carries its `message_id`, which names the waiting message (follow-ups share a subject).
function waitingState(item) {
  const waiting = props.waiting.find((message) => message.id === item.message_id);
  return sendStateLabel(sendState(waiting?.next_slot || ""));
}

function messageEntry(item, index, firstOut) {
  const out = item.direction === "out";
  const waiting = out && WAITING_STATUSES.includes(item.status);
  return {
    at: item.at,
    side: out ? "out" : "in",
    subject: item.subject,
    text: splitQuote(item.body_text),
    status: out ? item.status : "",
    sendState: waiting ? waitingState(item) : "",
    tag: out && index !== firstOut ? t("leads.thread.followup") : "",
    optout: out ? null : props.optouts.find((reply) => reply.received_at === item.at) || null,
  };
}

const entries = computed(() => {
  const firstOut = props.messages.findIndex((message) => message.direction === "out");
  return props.messages.map((message, i) => messageEntry(message, i, firstOut));
});
</script>

<style scoped>
.tl {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tl__empty {
  color: var(--text-muted);
  text-align: center;
}
.tl__entry {
  display: flex;
}
.tl__entry--out {
  justify-content: flex-end;
}
.tl__bubble {
  max-width: 85%;
  padding: var(--space-5) var(--space-8);
  border-radius: var(--radius-xl);
  background: var(--surface-raised);
  color: var(--text-body);
}
.tl__entry--out .tl__bubble {
  background: var(--accent-subtle);
  border-bottom-right-radius: var(--radius-base);
}
.tl__entry--in .tl__bubble {
  border-bottom-left-radius: var(--radius-base);
}
.tl__tag,
.tl__meta {
  margin: 0;
  font-size: var(--fs-200);
  color: var(--text-secondary);
}
.tl__meta {
  display: flex;
  gap: var(--space-5);
  justify-content: flex-end;
}
.tl__status {
  font-weight: 600;
}
.tl__subject {
  margin: 0 0 var(--space-2);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.tl__body {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.tl__quote-toggle {
  margin-top: var(--space-2);
}
.tl__quote {
  margin-top: var(--space-2);
  color: var(--text-secondary);
}
/* A phone has no width to spare: bubbles take nearly the whole line and a slimmer padding. */
@media (max-width: 1023px) {
  .tl__bubble {
    max-width: 95%;
    padding: var(--space-5);
  }
}
.tl__optout {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  align-items: center;
  margin-top: var(--space-5);
  color: var(--negative);
}
</style>
