import { communicatorApi } from "./client";
import { useLeadsChannelStore } from "@/stores/leadsChannel";

// django-communicator admin API v2 — review queue, threads, replies (plan 13).
const base = () =>
  `/api/communicator/v2/admin/${useLeadsChannelStore().activeChannelIdx}`;

export const GET_ReviewNext = () => communicatorApi.get(`${base()}/review/next/`);

// params: { status, page, page_size }
export const GET_ReviewList = (params) =>
  communicatorApi.get(`${base()}/review/`, { params });

// A draft waiting for review, by id (one request); null once it left the queue or is not on this channel (404).
export const GET_ReviewMessage = async (id) => {
  try {
    const { data } = await communicatorApi.get(`${base()}/review/${id}/`);
    return data.status === "review_required" ? data : null;
  } catch (err) {
    if ((err?.httpStatus ?? err?.response?.status) === 404) return null;
    throw err;
  }
};

export const POST_ReviewAccept = (id) =>
  communicatorApi.post(`${base()}/review/${id}/accept/`, {});

export const POST_ReviewRewrite = (id, { notes }) =>
  communicatorApi.post(`${base()}/review/${id}/rewrite/`, { notes });

export const POST_ReviewEdit = (id, { subject, body_text }) =>
  communicatorApi.post(`${base()}/review/${id}/edit/`, { subject, body_text });

export const POST_ReviewSkip = (id, { reject_reason = "" } = {}) =>
  communicatorApi.post(`${base()}/review/${id}/skip/`, { reason: reject_reason });

export const POST_ReviewSkipCompany = (id) =>
  communicatorApi.post(`${base()}/review/${id}/skip-company/`, {});

// params: { subject_ref, page, page_size } — newest first
export const GET_Threads = (params) => communicatorApi.get(`${base()}/threads/`, { params });

// The Inbox: one row per conversation (subject_ref) = its newest thread, state from any of its threads.
// params: { state, page, page_size } — latest activity first; `counts` per state come with every page
export const GET_Conversations = (params) => communicatorApi.get(`${base()}/conversations/`, { params });

export const GET_Thread = (id) => communicatorApi.get(`${base()}/threads/${id}/`);

// One thread with its timeline and its suspected opt-out replies (confirmed or not).
export const GET_ThreadWithOptouts = async (id) => {
  const [detail, replies] = await Promise.all([GET_Thread(id), GET_Replies({ thread: id, kind: "suspected_optout" })]);
  return { ...detail.data, optouts: replies.data.results || [] };
};

// Approved and scheduled messages — the mails waiting for the send beat. The outbox endpoint is the one source
// of the slot: it adds `next_slot`, the earliest moment the send policy allows, so no two screens disagree.
export const GET_WaitingMessages = async () => {
  const lists = await Promise.all(["approved", "scheduled"].map((status) => GET_Messages({ status, page_size: 100 })));
  return lists.flatMap(({ data }) => data.results || []);
};

export const GET_Replies = (params) =>
  communicatorApi.get(`${base()}/replies/`, { params });

export const POST_ConfirmOptout = (replyId) =>
  communicatorApi.post(`${base()}/replies/${replyId}/confirm-optout/`, {});

// Plan 14 — templates, sequences, send settings.
export const GET_Templates = () => communicatorApi.get(`${base()}/templates/`);

export const GET_Template = (id) => communicatorApi.get(`${base()}/templates/${id}/`);

export const PUT_Template = (id, body) => communicatorApi.put(`${base()}/templates/${id}/`, body);

export const GET_TemplateVersions = (id) => communicatorApi.get(`${base()}/templates/${id}/versions/`);

export const POST_TestGenerate = (id, context) =>
  communicatorApi.post(`${base()}/templates/${id}/test-generate/`, { context });

export const GET_Models = () => communicatorApi.get(`${base()}/models/`);

export const GET_Sequences = () => communicatorApi.get(`${base()}/sequences/`);

export const POST_Sequence = (body) => communicatorApi.post(`${base()}/sequences/`, body);

export const GET_SequenceTexts = (id) => communicatorApi.get(`${base()}/sequences/${id}/texts/`);

export const POST_SequenceText = (id, body) => communicatorApi.post(`${base()}/sequences/${id}/texts/`, body);

// UX-005: a text edits in place (future follow-ups only); DELETE of a used text deactivates it (200) instead of 204.
export const PATCH_SequenceText = (id, textId, body) =>
  communicatorApi.patch(`${base()}/sequences/${id}/texts/${textId}/`, body);

export const DELETE_SequenceText = (id, textId) => communicatorApi.delete(`${base()}/sequences/${id}/texts/${textId}/`);

export const GET_Policy = () => communicatorApi.get(`${base()}/policy/`);

export const PUT_Policy = (body) => communicatorApi.put(`${base()}/policy/`, body);

export const GET_Channel = () => communicatorApi.get(`${base()}/channel/`);

// Never sends live_enabled: that flag is Grappelli-only.
export const PATCH_Channel = ({ mode, sandbox_mailbox }) =>
  communicatorApi.patch(`${base()}/channel/`, { mode, sandbox_mailbox });

export const GET_Suppressions = () => communicatorApi.get(`${base()}/suppressions/`);

export const POST_Suppression = (body) => communicatorApi.post(`${base()}/suppressions/`, body);

export const DELETE_Suppression = (id) => communicatorApi.delete(`${base()}/suppressions/${id}/`);

// params: { status, page }
export const GET_Messages = (params) => communicatorApi.get(`${base()}/messages/`, { params });

// C-31: moves scheduled_at to the channel clock only; the next beat run sends.
export const POST_SendNow = (id) => communicatorApi.post(`${base()}/messages/${id}/send-now/`, {});

// UX-007 — the mail footer per language: HTML around `{{ legal }}` (the agreements text), sanitised on save.
export const GET_Footers = () => communicatorApi.get(`${base()}/footers/`);

export const PUT_Footer = (language, html) => communicatorApi.put(`${base()}/footers/${language}/`, { html });

export const DELETE_Footer = (language) => communicatorApi.delete(`${base()}/footers/${language}/`);
