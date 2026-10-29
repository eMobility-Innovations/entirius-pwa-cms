// Grants (django-access): a role goes to one active staff user or to one auth.Group. Revoking is always allowed, except
// that the server's lockout guard answers 409 when nobody active would be left to manage access — the user reads that
// as a sentence, never as the code.

import { isConflict } from "@/api/createClient";

const errorBody = (err) => err?.response?.data ?? err;

export function grantPayload(role, { userId, groupId }) {
  return userId ? { role, user_id: userId } : { role, group_id: groupId };
}

// "Editor" for a direct grant, "Editor · via Warehouse" for one that comes through a group.
export function roleLabel(role, t) {
  return role.via_group ? `${role.name} · ${t("access.staff.via", { group: role.via_group })}` : role.name;
}

// Roles a holder can still be given: every role but the ones it already holds directly.
export function roleOptions(roles, heldKeys) {
  return roles.filter((role) => !heldKeys.includes(role.key)).map((role) => ({ label: role.name, value: role.key }));
}

// A revoke refused by the lockout guard → the sentence; a refused grant (a non-staff account, a duplicate) → the
// server's own description.
export function grantErrorMessage(err, t, { revoking = false } = {}) {
  if (revoking && isConflict(err)) return t("access.grants.lockout");
  const body = errorBody(err);
  return body?.details?.[0]?.description || body?.message || t("notifications.error");
}
