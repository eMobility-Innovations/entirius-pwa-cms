import { enrichmentApi } from "./client";

// django-enrichment admin API v2 (etap-05). All endpoints JWT + IsAdminUser.
const ENR = "/api/enrichment/v2/admin";

// --- Workers (AI POC) ---

// Active workers of one module: [{ key, label, kind, target_module, mode, model (blank = toolbox default), params_schema }].
export const GET_Workers = (params) =>
  enrichmentApi.get(`${ENR}/workers/`, { params });

// Work queue per worker: [{ key, label, mode, state (running|paused), paused_reason, paused_at, online_instances,
// queued_units, oldest_queued_age_s, leased_units, failed_units_24h, nobody_taking }].
export const GET_WorkersStatus = () =>
  enrichmentApi.get(`${ENR}/workers/status/`);

// Resume a paused worker → its status row.
export const POST_ResumeWorker = (key) =>
  enrichmentApi.post(`${ENR}/workers/${key}/resume/`);

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

// Try again: runs only the failed products of a finished task, empty body → 201 the NEW task (the answer of
// `POST_SpawnTask`, `params.retry_of` = this id). 409 not finished or nothing failed, 400 a workflow step's task,
// cost-guard refusals as on create.
export const POST_RetryTask = (taskId) =>
  enrichmentApi.post(`${ENR}/tasks/${taskId}/retry/`);

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
// Bearer token — fetch it as a blob through the authenticated client and objectURL it. `variant` = one image of a
// cover step's variants (0-based); omitted = the proposal's one staged file.
export const GET_StagedFile = (proposalId, variant = null) =>
  enrichmentApi.get(`${ENR}/proposals/${proposalId}/staged-file/`, {
    responseType: "blob",
    ...(variant == null ? {} : { params: { variant } }),
  });

// `data` = `{ mode: "add" | "replace" }` for a proposal that offers the choice (applyMode.acceptBody), else none.
export const POST_AcceptProposal = (proposalId, data) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/accept/`, data);

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

// body { module, channel, refs (≤ 500) } → { known: [{ ref, label }], unknown: [ref] } — which pasted SKUs exist.
export const POST_ResolveSubjects = (data) =>
  enrichmentApi.post(`${ENR}/subjects/resolve/`, data);

// params { module, channel, ref } → [{ ref, label, url, is_main }] — one item's pictures, main first.
export const GET_SubjectPictures = (params) =>
  enrichmentApi.get(`${ENR}/subjects/pictures/`, { params });

// --- Workflows (contract A4 § 6) ---

// Active workflows: [{ key, label, target_module, inputs_schema, steps: [{ key, label, needs, gate, output }] }].
export const GET_Workflows = () =>
  enrichmentApi.get(`${ENR}/workflows/`);

// params { status?, definition?, page? } → paginated runs, newest first.
export const GET_Runs = (params) =>
  enrichmentApi.get(`${ENR}/runs/`, { params });

// { uid, definition_label, channel, inputs, subject_ref, status, current_step, steps: [{ …, status, proposal_id }],
// cost_usd, cost_complete, created_at } — a step's output is its proposal (`GET_Proposal(proposal_id)`).
export const GET_Run = (uid) =>
  enrichmentApi.get(`${ENR}/runs/${uid}/`);

// body { definition, inputs, channel } → 201 run; 400 with the brief's field errors.
export const POST_Run = (data) =>
  enrichmentApi.post(`${ENR}/runs/`, data);

// body { instruction? } → 200 run (the step's pending output is replaced by a new one).
export const POST_RegenerateStep = (uid, stepKey, data = {}) =>
  enrichmentApi.post(`${ENR}/runs/${uid}/steps/${stepKey}/regenerate/`, data);

export const POST_CancelRun = (uid) =>
  enrichmentApi.post(`${ENR}/runs/${uid}/cancel/`);

// --- Company profile (contract A4 § 2) ---

// params { channel } → { channel, complete, sections: [{ key, complete, minimum }] } of the merged profile.
export const GET_ProfileStatus = (params) =>
  enrichmentApi.get(`${ENR}/profile/status/`, { params });

// params { channel } → { channel, data, version, schema_version, updated_by_id, modified_at } — the scope's own data.
export const GET_Profile = (params) =>
  enrichmentApi.get(`${ENR}/profile/`, { params });

// body { data, note? } → 200 new version; 400 details[].field = "data.<path>".
export const PUT_Profile = (params, data) =>
  enrichmentApi.put(`${ENR}/profile/`, data, { params });

// params { channel } → [{ id, version, note, data, created_by_id, created_at }], newest first.
export const GET_ProfileVersions = (params) =>
  enrichmentApi.get(`${ENR}/profile/versions/`, { params });

export const POST_RestoreProfileVersion = (number, params) =>
  enrichmentApi.post(`${ENR}/profile/versions/${number}/restore/`, null, { params });

// The instance's AI settings (not profile content, no version): → { qa_check } — check every new AI text
// proposal against the checklists unless a run says otherwise (`params.qa_check`).
export const GET_ProfileSettings = () =>
  enrichmentApi.get(`${ENR}/profile/settings/`);

// body { qa_check: boolean } → { qa_check }
export const PUT_ProfileSettings = (data) =>
  enrichmentApi.put(`${ENR}/profile/settings/`, data);

// → { schema_version, json_schema }
export const GET_ProfileSchema = () =>
  enrichmentApi.get(`${ENR}/profile/schema/`);

// --- Memory (contract A4 § 3) ---

// params { channel?, kind?, subject_ref?, status?, page?, page_size? } → paginated entries, newest first.
export const GET_Memory = (params) =>
  enrichmentApi.get(`${ENR}/memory/`, { params });

// body { status: "active" | "dismissed" }
export const PATCH_Memory = (id, data) =>
  enrichmentApi.patch(`${ENR}/memory/${id}/`, data);

export const DELETE_Memory = (id) =>
  enrichmentApi.delete(`${ENR}/memory/${id}/`);

// body { target?: always_rules | rules | facts } → { entry, profile }
export const POST_PromoteMemory = (id, data = {}) =>
  enrichmentApi.post(`${ENR}/memory/${id}/promote/`, data);

// --- QA checks (contract A4 § 4) ---

// Re-runs the deterministic checks on the current value → the proposal.
export const POST_CheckProposal = (proposalId) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/check/`);

// "Add to facts": body { value, label? } → 201 memory fact_suggestion.
export const POST_SuggestFact = (proposalId, data) =>
  enrichmentApi.post(`${ENR}/proposals/${proposalId}/facts/suggest/`, data);

// --- AI usage (header counter) ---

// This month's AI usage of the instance → { period: "YYYY-MM", tokens, cost_usd: "3.40" | null, cost_since, currency };
// 503 while the toolbox is down (the caller stays quiet).
export const GET_UsageMonth = () =>
  enrichmentApi.get(`${ENR}/usage/month/`);
