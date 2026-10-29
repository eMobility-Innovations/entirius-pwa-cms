<template>
  <PageLayout class="review" data-testid="leads-review">
    <template #header>
      <PageHeader :title="$t('leads.review.title')" :back="goInbox" />
    </template>
    <div class="review__body flex-column gap-4">
      <Loader block v-show="loading" />

      <p v-if="scheduledLabel" class="review__scheduled" role="status" data-testid="review-scheduled">
        {{ scheduledLabel }}
      </p>

      <AiToolboxHint />
      <ConfigBanner code="communicator.smtp" />

      <div v-if="failedVersion" class="review__failed flex-column gap-4" role="alert" data-testid="review-failed">
        <p class="review__failed-text m-0">
          {{ $t("leads.review.rewrite_failed", { reason: failedVersion.failure_detail || failedVersion.failure_code }) }}
        </p>
        <ActionBar :actions="failedActions" />
      </div>

      <article
        v-else-if="message && !scheduledLabel"
        class="review__draft flex-column gap-4"
        :style="{ transform: `translateX(${offset}px)` }"
        data-testid="review-draft"
        v-on="editing ? {} : handlers"
      >
        <header class="flex-column">
          <router-link v-if="companyId" :to="{ name: 'LeadsThread', params: { id: companyId } }" class="review__company">
            {{ companyName }}
          </router-link>
          <span v-else class="review__company">{{ companyName }}</span>
          <span class="review__meta">{{ $t("leads.review.to") }}: {{ message.thread?.recipient_email }}</span>
          <span v-if="queueTotal" class="review__meta" data-testid="review-position">
            {{ $t("leads.review.queue_position", { index: queueIndex, count: queueTotal }) }}
          </span>
        </header>

        <IntelCard v-if="munin.isModuleEnabled('siteintel')" :context="message.render_context" />

        <template v-if="editing">
          <FormField :label="$t('leads.review.subject')">
            <BasicInput v-model="draft.subject" data-testid="edit-subject" />
          </FormField>
          <FormField :label="$t('leads.review.body')">
            <BasicTextarea v-model="draft.body_text" :rows="12" data-testid="edit-body" />
          </FormField>
          <ActionBar :actions="editActions" />
        </template>
        <template v-else>
          <h2 class="review__subject fs-400 fw-600 m-0" data-testid="review-subject">{{ message.subject }}</h2>
          <p class="review__text m-0" data-testid="review-body">{{ message.body_text }}</p>
          <p class="t-muted fs-200 m-0">{{ $t("leads.review.swipe_hint") }}</p>
        </template>
      </article>
    </div>

    <BasicModal
      v-model:open="rewriteOpen"
      :title="$t('leads.rewrite.title')"
      :actions="rewriteActions"
      data-testid="rewrite-modal"
    >
      <FormField :label="$t('leads.rewrite.label')" hint-level="important" :hint="$t('leads.rewrite.hint')">
        <BasicTextarea v-model="rewriteNotes" :rows="4" :placeholder="$t('leads.rewrite.placeholder')" data-testid="rewrite-notes" />
      </FormField>
    </BasicModal>
    <ConfirmDialog
      :open="discarding"
      :title="$t('leads.review.discard_title')"
      :message="$t('leads.review.discard_confirm')"
      :confirm-label="$t('leads.review.discard_yes')"
      :cancel-label="$t('leads.review.discard_keep')"
      tone="danger"
      @confirm="settleDiscard(true)"
      @cancel="settleDiscard(false)"
    />

    <!-- pinned to the bottom of the scroll body on every size; Review keeps the phone tab bar off (meta.noBottomBar) -->
    <template v-if="message && !editing && !scheduledLabel && !failedVersion" #footer>
      <ReviewActions
        ref="reviewActions"
        :busy="busy"
        :ai-disabled="aiDisabled"
        @send="accept"
        @skip="skip"
        @rewrite="openRewrite"
        @edit="startEdit"
        @skip-company="skipCompany"
      />
    </template>
  </PageLayout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import { t } from "@/i18n";
import { isConflict } from "@/api/createClient";
import * as api from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useLeadsReviewStore } from "@/stores/leadsReview";
import { useMuninStore } from "@/stores/munin";
import { useNotifyStore } from "@/stores/notify";
import { useSwipe } from "@/composables/useSwipe";
import { companyIdFromSubjectRef } from "@/utils/subjectRef";
import { sendStateSentence } from "@/utils/leadsLabels";
import { sendState } from "@/utils/leadsTime";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import ConfigBanner from "@/components/ConfigHealth/ConfigBanner.vue";
import { useConfigHealthStore } from "@/stores/configHealth";
import IntelCard from "./IntelCard.vue";
import ReviewActions from "./ReviewActions.vue";

const SCHEDULED_MS = 4000;

const route = useRoute();
const router = useRouter();
const munin = useMuninStore();
const configHealth = useConfigHealthStore();
const notify = useNotifyStore();
const reviewQueue = useLeadsReviewStore();

const message = ref(null);
const loading = ref(false);
const busy = ref(false);
const editing = ref(false);
const rewriteOpen = ref(false);
const rewriteNotes = ref("");
const scheduledLabel = ref("");
const failedVersion = ref(null);
const draft = ref({ subject: "", body_text: "" });
const queueIndex = ref(0);
const queueTotal = ref(0);
const discarding = ref(false);
let nextTimer = null;
let settle = null;

const { offset, handlers } = useSwipe({ onRight: accept, onLeft: skip });

const companyId = computed(() => companyIdFromSubjectRef(message.value?.thread?.subject_ref));
const companyName = computed(
  () => message.value?.render_context?.company_name || message.value?.thread?.recipient_name || ""
);
const aiDisabled = computed(() => !configHealth.aiUsable);
const failedActions = computed(() => [
  { key: "back", label: t("leads.review.cancel"), role: "secondary", testid: "failed-back", onClick: () => (failedVersion.value = null) },
  { key: "retry", label: t("leads.review.retry"), role: "primary", testid: "failed-retry", onClick: retryRewrite },
]);
const editActions = computed(() => [
  { key: "cancel", label: t("leads.review.cancel"), role: "secondary", testid: "edit-cancel", onClick: cancelEdit },
  { key: "save", label: t("leads.review.save"), role: "primary", disabled: busy.value, testid: "edit-save", onClick: saveEdit },
]);
// The reviewer's note for an AI rewrite of the draft.
const rewriteActions = computed(() => [
  { key: "cancel", label: t("leads.review.cancel"), role: "secondary", testid: "rewrite-cancel", onClick: () => (rewriteOpen.value = false) },
  {
    key: "submit",
    label: t("leads.rewrite.submit"),
    role: "primary",
    disabled: !rewriteNotes.value.trim(),
    testid: "rewrite-submit",
    onClick: () => rewrite(rewriteNotes.value.trim()),
  },
]);
const unsaved = computed(
  () => editing.value && (draft.value.subject !== message.value?.subject || draft.value.body_text !== message.value?.body_text)
);

// Leaving Edit (Cancel, Inbox, another draft) with unsaved changes asks first — in the app sheet, not the browser's.
function confirmDiscard() {
  if (!unsaved.value) return Promise.resolve(true);
  discarding.value = true;
  return new Promise((resolve) => {
    settle = resolve;
  });
}

function settleDiscard(discard) {
  discarding.value = false;
  settle?.(discard);
  settle = null;
}

onBeforeRouteLeave(confirmDiscard);
onBeforeRouteUpdate(confirmDiscard);

async function load() {
  loading.value = true;
  try {
    message.value = await api.GET_ReviewMessage(route.params.id);
    if (!message.value) {
      notify.spawnNotification({ msg: t("leads.review.already_handled"), type: "warning" });
      return await goNext();
    }
    await loadQueuePosition();
  } finally {
    loading.value = false;
  }
}

// "Draft 2 of 3": after a send the next draft is visibly another one, not the same screen again.
async function loadQueuePosition() {
  try {
    const { data } = await api.GET_ReviewList({ status: "review_required", page_size: 100 });
    const ids = (data.results || []).map((item) => item.id);
    queueTotal.value = ids.length;
    queueIndex.value = ids.indexOf(message.value.id) + 1;
  } catch {
    queueTotal.value = 0;
  }
}

async function goNext() {
  try {
    const { data } = await api.GET_ReviewNext();
    router.replace({ name: "LeadsReview", params: { id: data.id } });
  } catch {
    goInbox();
  }
}

function goInbox() {
  router.replace({ name: "LeadsInbox" });
}

// Runs one review call; a 409 is either "already handled" or a refused action (see onConflict).
async function act(call, after) {
  if (busy.value || !message.value) return;
  busy.value = true;
  try {
    const { data } = await call();
    reviewQueue.queueChanged();
    await after(data);
  } catch (err) {
    if (isConflict(err)) return await onConflict(err);
    notify.spawnNotification({ msg: t("leads.review.error"), type: "negative" });
  } finally {
    busy.value = false;
  }
}

// The 409 `error` code (communicator docs/api.md) decides: ALREADY_REVIEWED → someone else handled it, move on;
// any other conflict → the service refused the action, show its message and stay on the draft.
async function onConflict(err) {
  if (err.error !== "ALREADY_REVIEWED") {
    notify.spawnNotification({ msg: extractApiMessage(err, t("leads.review.refused")), type: "negative" });
    return;
  }
  notify.spawnNotification({ msg: t("leads.review.conflict"), type: "warning" });
  reviewQueue.queueChanged();
  return goNext();
}

// The confirmation reads the same `next_slot` the Inbox and the waiting table read — one source for the slot.
// A failed list, or a mail it does not hold, is an unknown schedule — never "waiting for the send window".
async function acceptedState(accepted) {
  const waiting = await api.GET_WaitingMessages().catch(() => []);
  const mail = waiting.find((item) => item.id === accepted.id);
  return mail ? sendStateSentence(sendState(mail.next_slot)) : t("leads.send_state.unknown");
}

function accept() {
  return act(
    () => api.POST_ReviewAccept(message.value.id),
    async (data) => {
      scheduledLabel.value = t("leads.review.accepted", { state: await acceptedState(data) });
      nextTimer = setTimeout(goNext, SCHEDULED_MS);
    }
  );
}

function skip() {
  return act(() => api.POST_ReviewSkip(message.value.id), goNext);
}

function skipCompany() {
  return act(() => api.POST_ReviewSkipCompany(message.value.id), goNext);
}

// The action answers with the new version itself — show it directly (it may sit beyond the first review page);
// a failed rewrite stays on the reviewed draft with its reason.
function openVersion(data) {
  if (data.status === "failed") {
    failedVersion.value = data;
    return;
  }
  message.value = data;
  router.replace({ name: "LeadsReview", params: { id: data.id } });
}

function openRewrite() {
  rewriteNotes.value = "";
  rewriteOpen.value = true;
}

// The rewrite dialog opens from a menu item that is gone once it closes: focus goes back to the more button (after
// the dialog's focus trap has let go).
const reviewActions = ref(null);
watch(rewriteOpen, (open) => open || nextTick(() => reviewActions.value?.focusMore()));

function retryRewrite() {
  failedVersion.value = null;
  openRewrite();
}

function rewrite(notes) {
  rewriteOpen.value = false;
  return act(() => api.POST_ReviewRewrite(message.value.id, { notes }), openVersion);
}

function startEdit() {
  draft.value = { subject: message.value.subject, body_text: message.value.body_text };
  editing.value = true;
}

async function cancelEdit() {
  if (await confirmDiscard()) editing.value = false;
}

function saveEdit() {
  return act(() => api.POST_ReviewEdit(message.value.id, draft.value), (data) => {
    editing.value = false;
    openVersion(data);
  });
}

watch(
  () => route.params.id,
  (id) => {
    if (!id) return;
    clearTimeout(nextTimer);
    scheduledLabel.value = "";
    failedVersion.value = null;
    editing.value = false;
    if (message.value?.id !== Number(id)) load();
  },
  { immediate: true }
);
onBeforeUnmount(() => clearTimeout(nextTimer));
</script>

<style scoped>
/* The draft moves sideways under a swipe; the page never scrolls sideways with it. */
.review__body {
  overflow-x: clip;
}
.review__scheduled {
  margin: var(--space-10) 0;
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--positive-subtle);
  color: var(--text-body);
  font-size: var(--fs-400);
  font-weight: 600;
  text-align: center;
}
.review__failed {
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--negative-subtle);
}
.review__failed-text {
  color: var(--text-body);
  overflow-wrap: anywhere;
}
.review__draft {
  touch-action: pan-y;
  transition: transform 0.1s ease;
}
.review__company {
  font-weight: 600;
  font-size: var(--fs-400);
  color: var(--text-body);
  overflow-wrap: anywhere;
}
.review__meta {
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.review__subject {
  margin-top: var(--space-5);
  overflow-wrap: anywhere;
}
.review__text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
</style>
