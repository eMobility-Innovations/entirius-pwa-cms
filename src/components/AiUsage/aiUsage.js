import { t, uiLocale } from "@/i18n";

// The header AI-usage counter: number formats and the one-line summary. Pure functions, the component polls.
// REFRESH_MS: how often an open CMS tab re-reads the usage (the backend caches it for 60 s).
export const REFRESH_MS = 5 * 60 * 1000;
export const UNKNOWN = "—";

const known = (value) => value !== null && value !== undefined && value !== "";

// 3827328 → "3.8M" (EN) / "3,8 mln" (PL); unknown → "—". EN suffixes are upper case in every browser (en-GB gives "m").
export function formatTokens(tokens) {
  if (!known(tokens)) return UNKNOWN;
  const text = new Intl.NumberFormat(uiLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(tokens);
  return uiLocale().startsWith("en") ? text.toUpperCase() : text;
}

// The exact count for the panel: 3827328 → "3,827,328".
export function formatTokensExact(tokens) {
  return known(tokens) ? new Intl.NumberFormat(uiLocale()).format(tokens) : UNKNOWN;
}

// "3.40" + "USD" → "$3.40" (EN) / "3,40 $" (PL); null → "—".
export function formatCost(cost, currency = "USD") {
  if (!known(cost)) return UNKNOWN;
  return new Intl.NumberFormat(uiLocale(), { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(Number(cost));
}

// "2026-10" → "October 2026".
export function formatPeriod(period) {
  if (!period) return UNKNOWN;
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat(uiLocale(), { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

// "2026-10-15" → "15 Oct".
export function formatDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(uiLocale(), { day: "numeric", month: "short" }).format(new Date(year, month - 1, date));
}

// The counter text: "AI this month: 3.8M tokens · $0.12" (no cost part while the cost is unknown).
export function summary(usage) {
  const tokens = t("ai_usage.tokens", { count: formatTokens(usage?.tokens) });
  const cost = known(usage?.cost_usd) ? formatCost(usage.cost_usd, usage.currency) : null;
  return [`${t("ai_usage.prefix")}: ${tokens}`, cost].filter(Boolean).join(" · ");
}

// The panel's note under the numbers: why the cost is missing or partial, else what it includes.
export function costNote(usage) {
  if (!usage) return t("ai_usage.unavailable");
  if (!known(usage.cost_usd)) return t("ai_usage.cost_off");
  if (usage.cost_since) return t("ai_usage.cost_since", { date: formatDay(usage.cost_since) });
  return t("ai_usage.cost_billed");
}
