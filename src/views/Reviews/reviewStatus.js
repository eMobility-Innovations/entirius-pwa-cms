// Shared by the queue and the detail view — one place for the status → badge mapping.
export const REVIEW_STATUSES = [
  "pending",
  "accepted",
  "not_accepted",
  "archived",
];

export const STATUS_VARIANTS = {
  pending: "informative",
  accepted: "positive",
  not_accepted: "negative",
  archived: "neutral",
};

export function statusVariant(status) {
  return STATUS_VARIANTS[status] || "neutral";
}

export function formatStars(rate) {
  if (rate == null) return "—";
  const rounded = Math.round(Number(rate));
  return `${"★".repeat(rounded)}${"☆".repeat(
    Math.max(0, 5 - rounded)
  )} ${Number(rate).toFixed(1)}`;
}
