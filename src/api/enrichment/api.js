import { enrichmentApi } from "./client";

// django-enrichment admin API v2 (etap-05). All endpoints JWT + IsAdminUser.
const ENR = "/api/enrichment/v2/admin";

// --- Workers (AI POC) ---

// Active workers of one module: [{ key, label, kind, target_module, mode, params_schema }].
export const GET_Workers = (params) =>
  enrichmentApi.get(`${ENR}/workers/`, { params });

// --- Tasks ---

export const GET_Tasks = (params) =>
  enrichmentApi.get(`${ENR}/tasks/`, { params });

export const GET_Task = (taskId) =>
  enrichmentApi.get(`${ENR}/tasks/${taskId}/`);

// body: { type, scope_spec, params, batch_key? }
export const POST_SpawnTask = (data) =>
  enrichmentApi.post(`${ENR}/tasks/`, data);

export const PATCH_Task = (taskId, data) =>
  enrichmentApi.patch(`${ENR}/tasks/${taskId}/`, data);

// CSV import (etap-11): one file = one channel + one language; rows group by the `type` column
// into N tasks. Pass a FormData (file + channel + language [+ params]) — let the client set the
// multipart boundary; do NOT force a Content-Type header.
export const POST_ImportCsv = (formData) =>
  enrichmentApi.post(`${ENR}/tasks/import-csv/`, formData);

export const GET_TaskTargets = (taskId, params) =>
  enrichmentApi.get(`${ENR}/tasks/${taskId}/targets/`, { params });

// --- Spawn rules (etap-13) ---

export const GET_SpawnRules = (params) =>
  enrichmentApi.get(`${ENR}/spawn-rules/`, { params });

export const GET_SpawnRule = (key) =>
  enrichmentApi.get(`${ENR}/spawn-rules/${key}/`);

// body: { key, module, check_key, params?, scope?, task_type, task_params?, limit?, cooldown_days?, auto?, active? }
export const POST_SpawnRule = (data) =>
  enrichmentApi.post(`${ENR}/spawn-rules/`, data);

export const PATCH_SpawnRule = (key, data) =>
  enrichmentApi.patch(`${ENR}/spawn-rules/${key}/`, data);

export const DELETE_SpawnRule = (key) =>
  enrichmentApi.delete(`${ENR}/spawn-rules/${key}/`);

// 201 {status:"spawned", task} | 200 {status:"already_running", task} | 200 {status:"no_candidates", task:null}
export const POST_SpawnRuleRun = (key) =>
  enrichmentApi.post(`${ENR}/spawn-rules/${key}/run/`);

// --- Proposals ---

// params: filters + paging; `task` = the owning task id (contract A3 § 1).
export const GET_Proposals = (params) =>
  enrichmentApi.get(`${ENR}/proposals/`, { params });

export const GET_Proposal = (proposalId) =>
  enrichmentApi.get(`${ENR}/proposals/${proposalId}/`);

// Edit before accept: body { proposed_value } — pending proposals only, else 400.
export const PATCH_Proposal = (proposalId, data) =>
  enrichmentApi.patch(`${ENR}/proposals/${proposalId}/`, data);

// Media (etap-08): the staged "after" image is admin-only, so an <img src> can't carry the
// Bearer token — fetch it as a blob through the authenticated client and objectURL it.
export const GET_StagedFile = (proposalId) =>
  enrichmentApi.get(`${ENR}/proposals/${proposalId}/staged-file/`, {
    responseType: "blob",
  });

export const POST_AcceptProposal = (proposalId) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/accept/`);

export const POST_RejectProposal = (proposalId, data = {}) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/reject/`, data);

// body: filter object { target_module?, target_kind?, batch_id?, source?, confidence_min?, search? }
export const POST_BulkAcceptProposals = (filters) =>
  enrichmentApi.post(`${ENR}/proposals/bulk-accept/`, filters);

// body: filter object + { reason? }
export const POST_BulkRejectProposals = (filters) =>
  enrichmentApi.post(`${ENR}/proposals/bulk-reject/`, filters);

// Single-level undo (etap-09): reverts the filtered APPLIED set. Response carries `mode`
// (sync/async) + reverted/blocked counts — blocked = drifted since apply, left untouched.
export const POST_BulkUndoProposals = (filters) =>
  enrichmentApi.post(`${ENR}/proposals/bulk-undo/`, filters);

// --- Revisions and corrections (contract A3 § 1) ---

// [{ number, value, instruction, scope, author_kind (ai | user | restore), author, created_at }], oldest first.
export const GET_ProposalRevisions = (proposalId) =>
  enrichmentApi.get(`${ENR}/proposals/${proposalId}/revisions/`);

// body: { instruction?, quick_action?, scope? } → 201 revision | 200 { candidates } (variants, nothing saved).
// Synchronous AI call (up to ~30 s); 422 REVISION_NOT_APPLICABLE when the answer does not fit the text.
export const POST_ReviseProposal = (proposalId, data) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/revise/`, data);

export const POST_RestoreRevision = (proposalId, number) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/revisions/${number}/restore/`);

// Replaces the proposal's correction rules → the proposal.
export const PUT_ProposalRules = (proposalId, rules) =>
  enrichmentApi.put(`${ENR}/proposals/${proposalId}/rules/`, { rules });

// body: { rule, target: "template" | "worker" } → { target, rules }.
export const POST_PromoteRule = (proposalId, data) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/rules/promote/`, data);

// Correct every pending proposal of a task in the background: body { instruction?, quick_action? } → 202 { queued }.
export const POST_ReviseTask = (taskId, data) =>
  enrichmentApi.post(`${ENR}/tasks/${taskId}/revise/`, data);

// --- Templates and field catalog (contract A3 § 2, § 4) ---

// [{ key, label, worker_key, worker_label, kind, target_module, params, rules, position, active }], inactive included.
export const GET_Templates = (params) =>
  enrichmentApi.get(`${ENR}/templates/`, { params });

export const GET_Template = (key) =>
  enrichmentApi.get(`${ENR}/templates/${key}/`);

// body: { key, label, worker_key, params?, rules?, position?, active? }
export const POST_Template = (data) =>
  enrichmentApi.post(`${ENR}/templates/`, data);

// body: any of { label, worker_key, params, rules, position, active } — `key` is immutable.
export const PATCH_Template = (key, data) =>
  enrichmentApi.patch(`${ENR}/templates/${key}/`, data);

export const DELETE_Template = (key) =>
  enrichmentApi.delete(`${ENR}/templates/${key}/`);

// params { target_module, channel, language? } → [{ key, label, type (text | html | select | multiselect),
// max_length?, translatable, options?: [{ value, label }], options_truncated? }]; 404 NOT_SUPPORTED without a catalog.
export const GET_Fields = (params) =>
  enrichmentApi.get(`${ENR}/fields/`, { params });

// params { target_module, channel } → ["pl", "en", …], main language first.
export const GET_Languages = (params) =>
  enrichmentApi.get(`${ENR}/languages/`, { params });
