import { notificationsApi } from "./client";
import { useLeadsChannelStore } from "@/stores/leadsChannel";

// django-notifications admin API v2 — the shared notification bar (plan 13).
const base = () =>
  `/api/notifications/v2/admin/${useLeadsChannelStore().activeChannelIdx}/notifications`;

export const GET_Notifications = (params = { unread: 1 }) =>
  notificationsApi.get(`${base()}/`, { params });

export const GET_UnreadCount = () => notificationsApi.get(`${base()}/unread-count/`);

export const POST_MarkRead = (id) => notificationsApi.post(`${base()}/${id}/read/`, {});

export const POST_MarkAllRead = () => notificationsApi.post(`${base()}/read-all/`, {});
