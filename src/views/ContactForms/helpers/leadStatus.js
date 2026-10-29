// Lead-status -> visual variant + i18n label.
// Shared across BookingList (for the embedded linked_lead badge),
// LeadList, and LeadDetail.

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "won",
  "lost",
];

const VARIANTS = {
  new: "warning",
  contacted: "info",
  qualified: "positive",
  unqualified: "neutral",
  won: "positive",
  lost: "negative",
};

export function leadStatusVariant(status) {
  return VARIANTS[(status || "").toLowerCase()] || "neutral";
}

export function leadStatusLabel($t, status) {
  if (!status) return "---";
  const key = `cf.statuses.${String(status).toLowerCase()}`;
  const translated = $t(key);
  return translated !== key ? translated : status;
}

// FSM allowlist — MUST mirror _ALLOWED_TRANSITIONS in lead_service.py.
// Used by the LeadDetail toolbar to compute which "Change status" options
// are actually valid for the current state (rather than sending an
// INVALID_TRANSITION request and handling the 400).
const ALLOWED_NEXT = {
  new: ["contacted", "unqualified"],
  contacted: ["qualified", "unqualified"],
  qualified: ["won", "lost"],
  unqualified: ["new"],
  won: ["lost"],
  lost: ["qualified", "won"],
};

export function allowedTransitions(currentStatus) {
  return ALLOWED_NEXT[(currentStatus || "").toLowerCase()] || [];
}
