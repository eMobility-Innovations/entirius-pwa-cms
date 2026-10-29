import { accessApi } from './client'

// django-access: who the logged-in user is and what they may do (`{ user, gate_mode, manages_access, roles,
// permissions: { "<area>": "read" | "write" } }`).
export const GET_Me = () => accessApi.get('/api/access/v2/me/')

// Admin API (`access.manage`): the area catalogue (`{ modules: [{ module, areas }], roles, scopes }`) and roles.
const ADMIN = '/api/access/v2/admin'

// Every row of a list, page after page (the API pages by 100 at most): roles, staff, applications, an application's
// tokens (a rotation adds one each time).
async function allPages(get) {
  const rows = []
  for (let page = 1; ; page += 1) {
    const { data } = await get({ page, page_size: 100 })
    rows.push(...(data.results || []))
    if (!data.next) return rows
  }
}

export const GET_AccessCatalogue = () => accessApi.get(`${ADMIN}/catalogue/`)
export const GET_AccessRoles = (params = {}) => accessApi.get(`${ADMIN}/roles/`, { params })
export const GET_AccessRole = (id) => accessApi.get(`${ADMIN}/roles/${id}/`)
export const POST_AccessRole = (payload) => accessApi.post(`${ADMIN}/roles/`, payload)
export const PATCH_AccessRole = (id, payload) => accessApi.patch(`${ADMIN}/roles/${id}/`, payload)
export const DELETE_AccessRole = (id) => accessApi.delete(`${ADMIN}/roles/${id}/`)
export const GET_AccessAllRoles = () => allPages((params) => GET_AccessRoles(params))

// Staff directory, groups, grants (a role to one staff user or one group) and the audit log, newest first.
export const GET_AccessStaff = (params = {}) => accessApi.get(`${ADMIN}/staff/`, { params })
export const GET_AccessAllStaff = () => allPages((params) => GET_AccessStaff(params))
export const GET_AccessStaffUser = (id) => accessApi.get(`${ADMIN}/staff/${id}/`)
export const GET_AccessGroups = (params = {}) => accessApi.get(`${ADMIN}/groups/`, { params })
export const POST_AccessGrant = (payload) => accessApi.post(`${ADMIN}/grants/`, payload)
export const DELETE_AccessGrant = (id) => accessApi.delete(`${ADMIN}/grants/${id}/`)
export const GET_AccessAudit = (params = {}) => accessApi.get(`${ADMIN}/audit/`, { params })

// Applications (machine clients, never deleted — deactivated) and their tokens. Every token call carries `sensitive`:
// the debug interceptors (createClient) log `[redacted]` for its bodies — a create or rotate answer holds the raw
// value, which the caller hands straight to SecretReveal and nowhere else.
const SENSITIVE = { sensitive: true }

// A new staff account with one role (`{ username, email, role, password? }`). The answer carries the generated password
// when none was sent — `sensitive` like a token.
export const POST_AccessStaff = (payload) => accessApi.post(`${ADMIN}/staff/`, payload, SENSITIVE)

export const GET_AccessApplications = (params = {}) => accessApi.get(`${ADMIN}/applications/`, { params })
export const GET_AccessApplication = (id) => accessApi.get(`${ADMIN}/applications/${id}/`)
export const POST_AccessApplication = (payload) => accessApi.post(`${ADMIN}/applications/`, payload)
export const PATCH_AccessApplication = (id, payload) => accessApi.patch(`${ADMIN}/applications/${id}/`, payload)
export const GET_AccessTokens = (applicationId, params = {}) =>
  accessApi.get(`${ADMIN}/applications/${applicationId}/tokens/`, { params, ...SENSITIVE })
export const GET_AccessAllApplications = () => allPages((params) => GET_AccessApplications(params))
export const GET_AccessAllTokens = (applicationId) => allPages((params) => GET_AccessTokens(applicationId, params))
export const POST_AccessToken = (applicationId, payload) =>
  accessApi.post(`${ADMIN}/applications/${applicationId}/tokens/`, payload, SENSITIVE)
export const POST_AccessTokenRotate = (id, payload) => accessApi.post(`${ADMIN}/tokens/${id}/rotate/`, payload, SENSITIVE)
export const POST_AccessTokenRevoke = (id) => accessApi.post(`${ADMIN}/tokens/${id}/revoke/`, null, SENSITIVE)
export const POST_AccessTokenExpiry = (id, payload) => accessApi.post(`${ADMIN}/tokens/${id}/expiry/`, payload, SENSITIVE)

// Organization access-matrix overlay; its backend contract is separate.
import { accessApiBase } from "@/configs/accessMatrix";

const base = () => accessApiBase();

export const GET_MatrixMe = () => accessApi.get(`${base()}/me/`);
export const GET_Catalog = () => accessApi.get(`${base()}/catalog/`);
export const GET_Grants = () => accessApi.get(`${base()}/grants/`);
/** A group is submitted by NAME. The server resolves it to its stable key — the browser
 *  never composes one, because a key typed or cached here can never be matched back. */
export const POST_Grant = (payload) => accessApi.post(`${base()}/grants/`, payload);
export const DELETE_Grant = (id) => accessApi.delete(`${base()}/grants/${id}/`);
export const GET_Overrides = () => accessApi.get(`${base()}/overrides/`);
export const PUT_RoleOverride = (role, permissions) =>
  accessApi.put(`${base()}/overrides/roles/${encodeURIComponent(role)}/`, { permissions })
export const DELETE_RoleOverride = (role) =>
  accessApi.delete(`${base()}/overrides/roles/${encodeURIComponent(role)}/`)
export const PUT_UserOverride = (kcUsername, permissions) =>
  accessApi.put(`${base()}/overrides/users/${encodeURIComponent(kcUsername)}/`, { permissions })
export const DELETE_UserOverride = (kcUsername) =>
  accessApi.delete(`${base()}/overrides/users/${encodeURIComponent(kcUsername)}/`)
export const GET_Audit = () => accessApi.get(`${base()}/audit/`);
export const GET_Groups = () => accessApi.get(`${base()}/groups/`);
export const GET_Users = (q) => accessApi.get(`${base()}/users/`, { params: { q } });
export const GET_ServiceAccounts = () => accessApi.get(`${base()}/service-accounts/`);
export const GET_Unassigned = () => accessApi.get(`${base()}/unassigned/`);
