import { t } from "@/i18n";

// i18n keys for per-option descriptions (Dropdown `el.description`) of voucher
// enum dropdowns. The backend meta gives terse labels; these add a muted second
// line explaining each choice. Keyed by the enum's `value` (matches
// django_checkout_voucher/models/enums.py). Shared across the voucher views.
export const VOUCHER_ENUM_DESC = {
  tax_type: { mpv: "promo.tax_mpv_desc", spv: "promo.tax_spv_desc" },
  validity_precision: {
    date: "promo.precision_date_desc",
    datetime: "promo.precision_datetime_desc",
  },
  expiry_starts_from: {
    purchase: "promo.expiry_purchase_desc",
    activation: "promo.expiry_activation_desc",
  },
  filter_mode: {
    inclusion: "promo.mode_inclusion_desc",
    exclusion: "promo.mode_exclusion_desc",
  },
  campaign_type: {
    sale: "promo.campaign_sale_desc",
    admin_issued: "promo.campaign_admin_desc",
  },
};

// Returns the i18n key for an option's description, or "" when none is defined.
export function enumDescKey(kind, value) {
  return VOUCHER_ENUM_DESC[kind]?.[value] || "";
}

// Badge label of a voucher enum value (`promo.enum_label.<kind>.<value>`); the backend meta label (or the raw value)
// only for a value the CMS does not know yet.
export function enumLabel(kind, value, fallback) {
  const key = `promo.enum_label.${kind}.${value}`;
  const label = t(key);
  if (label !== key) return label;
  // Tag needs a string label: an unknown value shows as itself, a missing one as a dash.
  return fallback || (value == null || value === "" ? "—" : String(value));
}
