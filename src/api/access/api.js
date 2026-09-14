import { accessApi } from "./client";
import { accessApiBase } from "@/configs/accessMatrix";

const base = () => accessApiBase();

export const GET_Me = () => accessApi.get(`${base()}/me/`);
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
