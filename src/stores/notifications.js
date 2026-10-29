import { defineStore } from "pinia";
import { ref } from "vue";
import {
  GET_Notifications,
  GET_UnreadCount,
  POST_MarkRead,
} from "@/api/notifications/api";
import { GET_Threads } from "@/api/communicator/api";
import { t } from "@/i18n";
import { useNotifyStore } from "@/stores/notify";
import { routeForSubjectRef } from "@/utils/subjectRef";

// Notification bar (django-notifications) — not the toast store (`notify`).
const POLL_MS = 30000;

export const useNotificationsStore = defineStore("notifications", () => {
  const unread = ref(0);
  const items = ref([]);
  let timer = null;
  const reading = new Set();

  async function poll() {
    if (document.visibilityState !== "visible") return;
    try {
      const { data } = await GET_UnreadCount();
      unread.value = data.unread;
    } catch (err) {
      console.warn("Notification count unavailable:", err.message || err);
    }
  }

  async function loadItems() {
    try {
      const { data } = await GET_Notifications({ unread: 1 });
      items.value = data.results || [];
    } catch (err) {
      console.warn("Notifications unavailable:", err.message || err);
    }
  }

  // A tab coming back to the foreground polls at once instead of waiting up to POLL_MS.
  function start() {
    if (timer) return;
    poll();
    timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
  }

  function stop() {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", poll);
    timer = null;
    unread.value = 0;
    items.value = [];
  }

  async function markRead(id) {
    await POST_MarkRead(id);
    items.value = items.value.filter((item) => item.id !== id);
    unread.value = Math.max(0, unread.value - 1);
  }

  // A reply about something that is not a company (a test reference, …) still has a screen: its newest thread.
  // Nothing found (not a conversation, or no communicator) = no link, as before.
  async function conversationRoute(subjectRef) {
    if (!subjectRef) return null;
    try {
      const { data } = await GET_Threads({ subject_ref: subjectRef, page_size: 1 });
      const thread = data.results?.[0];
      return thread ? { name: "LeadsConversation", params: { id: thread.id } } : null;
    } catch {
      return null;
    }
  }

  // Opening a row marks it read; returns the route to jump to (null = no link, a repeated tap or a failed read).
  // Single-flight per id: a double tap never drops the badge twice; a failed read keeps the badge.
  async function open(item) {
    if (reading.has(item.id)) return null;
    reading.add(item.id);
    try {
      await markRead(item.id);
      return routeForSubjectRef(item.subject_ref) || (await conversationRoute(item.subject_ref));
    } catch {
      useNotifyStore().spawnNotification({ msg: t("notification_bar.read_failed"), type: "negative" });
      return null;
    } finally {
      reading.delete(item.id);
    }
  }

  return { unread, items, poll, loadItems, start, stop, markRead, open };
});
