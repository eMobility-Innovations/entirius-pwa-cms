// Scope model of the shared translate dialog: which extra options a scope shows and how its estimate reads as table
// rows. The callers keep their API calls (`estimateFn` / `submitFn`); the estimate they return is the raw API answer:
// product and content one estimate with `per_language`, store one estimate per entity type.

export const SCOPES = ["product", "store", "content"];

// Pim entity types a store translation covers, in the order the store estimate lists them.
export const STORE_TYPES = [
  { value: "product", labelKey: "pim.products" },
  { value: "category", labelKey: "pim.categories" },
  { value: "feature", labelKey: "pim.features" },
  { value: "attribute", labelKey: "pim.attributes_label" },
];

export function formatCost(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(4)}`;
}

function sum(estimates, key) {
  return estimates.reduce((total, estimate) => total + Number(estimate[key] || 0), 0);
}

function perLanguageRows(estimate) {
  const rows = (estimate.per_language || []).map((row) => ({
    key: row.language,
    label: row.language.toUpperCase(),
    items: row.items,
    chars: row.chars,
    cost: row.cost_usd,
  }));
  return { rows, total: { items: null, chars: null, cost: estimate.estimated_cost_usd } };
}

function perTypeRows(estimates, t) {
  const labelKey = (type) => STORE_TYPES.find((entry) => entry.value === type)?.labelKey;
  const rows = estimates.map((estimate) => ({
    key: estimate.entity_type,
    label: t(labelKey(estimate.entity_type) || estimate.entity_type),
    items: estimate.estimated_items,
    chars: estimate.total_chars,
    cost: estimate.estimated_cost_usd,
  }));
  const total = { items: sum(estimates, "estimated_items"), chars: sum(estimates, "total_chars") };
  return { rows, total: { ...total, cost: sum(estimates, "estimated_cost_usd") } };
}

/** Table rows of an estimate, the total row last: `{ key, label, items, chars, cost }` (cost formatted). */
export function estimateRows(scope, estimate, t) {
  const { rows, total } = scope === "store" ? perTypeRows(estimate, t) : perLanguageRows(estimate);
  return [...rows, { key: "total", label: t("translate_dialog.total"), ...total }].map((row) => ({
    ...row,
    chars: row.chars?.toLocaleString() ?? null,
    cost: formatCost(row.cost),
  }));
}

/** The pages a content estimate lists (`per_draft`), or none. */
export function draftRows(scope, estimate) {
  if (scope !== "content") return [];
  return (estimate.per_draft || []).map((draft) => ({
    key: draft.draft_name,
    name: draft.draft_name,
    items: draft.items,
    chars: draft.chars?.toLocaleString() ?? null,
  }));
}
