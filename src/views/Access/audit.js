// Audit log (django-access): the README's actions and the list queries. A superuser's write through the gate leaves
// one `gate.bypass` row per request — numerous, so by default the API folds them into one row per actor and day
// (`fold_bypass`), before paging. An access version without the parameter ignores it and answers raw rows.

export const AUDIT_ACTIONS = [
  "role.create",
  "role.update",
  "role.delete",
  "grant.create",
  "grant.delete",
  "grant.migrate",
  "staff.create",
  "application.create",
  "application.update",
  "token.create",
  "token.rotate",
  "token.revoke",
  "token.expiry",
  "legacy.import",
  "legacy.purge",
  "gate.bypass",
];
export const BYPASS = "gate.bypass";
export const AUDIT_PAGE_SIZE = 50;

// "2026-10-02" (the date picker's value) → that local day's start, or with `endOfDay` its last millisecond, as ISO.
function dayBound(value, endOfDay) {
  const [year, month, day] = value.split("-").map(Number);
  if (!endOfDay) return new Date(year, month - 1, day).toISOString();
  return new Date(new Date(year, month - 1, day + 1).getTime() - 1).toISOString();
}

export function auditParams({ page = 1, action, actor, from, to, fold = false }) {
  const params = { page, page_size: AUDIT_PAGE_SIZE };
  if (action) params.action = action;
  if (actor) params.actor = actor;
  if (from) params.from = dayBound(from, false);
  if (to) params.to = dayBound(to, true);
  if (fold) params.fold_bypass = true;
  return params;
}

// Entries a row stands for: `folded` of a folded row, 1 for an ordinary row and for a row of an API without folding.
export const foldedCount = (row) => row.folded ?? 1;

// The first page of the bypass entries behind a folded row: its actor between the row's own bounds.
export function foldedRequestsParams(row) {
  const params = { page: 1, page_size: AUDIT_PAGE_SIZE, action: BYPASS, from: row.first_at, to: row.last_at };
  if (row.actor_id) params.actor = row.actor_id;
  return params;
}
