import { t } from "@/i18n";

// Short, human-readable labels for discount-rule modifiers (`promo.modifier_short.*`).
//
// The backend discount-meta `label` is the long Django enum description
// (e.g. "The role defining how many units of the gratis product should be...")
// — far too long for dropdowns and badges. Use these short labels in the UI;
// keep the long one only as a hover title where space allows.
export function modifierShortLabel(value, fallback) {
  const key = `promo.modifier_short.${value}`;
  const label = t(key);
  return label === key ? fallback || value : label;
}
