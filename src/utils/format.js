import { uiLocale } from "@/i18n"

/**
 * Format a money amount to 2 decimal places + optional currency suffix.
 *
 * Backend stores DecimalField with 4 decimal places (e.g. "40.3000") — UI always
 * shows 2 ("40.30 PLN"). Convention matches PriceManager views (`num.toFixed(2)`).
 *
 * @param {string|number|null|undefined} amount - decimal-ish input
 * @param {string} [currency] - ISO 4217 code appended after a space
 * @returns {string} "" for null/empty/NaN, "40.30" or "40.30 PLN" otherwise
 */
export function formatCost(amount, currency = "") {
  if (amount === null || amount === undefined || amount === "") return ""
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (Number.isNaN(num)) return ""
  const formatted = num.toFixed(2)
  return currency ? `${formatted} ${currency}` : formatted
}

/**
 * Format an ISO datetime string into a compact label in the locale of the UI language.
 *
 * Default: short date + short time. Backend serializes datetimes as ISO 8601 with timezone
 * (e.g. "2026-05-18T19:06:46Z"). This produces "18/05/2026, 21:06" (EN) or
 * "18.05.2026, 21:06" (PL) without seconds — fits narrow table cells.
 *
 * @param {string|null|undefined} iso
 * @param {object} [opts] - extra Intl.DateTimeFormat options to override defaults
 * @returns {string} "" for null/empty/invalid, locale-formatted string otherwise
 */
export function formatDate(iso, opts = {}) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const defaults = { dateStyle: "short", timeStyle: "short" }
  try {
    return new Intl.DateTimeFormat(uiLocale(), { ...defaults, ...opts }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

/**
 * Format an ISO date or datetime string as a short date ("18/05/2026" EN, "18.05.2026" PL).
 *
 * @param {string|null|undefined} iso
 * @returns {string} "" for null/empty/invalid
 */
export function formatDay(iso) {
  return formatDate(iso, { dateStyle: "short", timeStyle: undefined })
}

const RELATIVE_UNITS = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * "2 min ago" / "2 min temu" (UI language). Under a minute is "now"; null/invalid is "".
 *
 * @param {string|null|undefined} iso
 * @param {number} now epoch ms (tests pin it)
 */
export function formatRelative(iso, now = Date.now()) {
  const time = iso ? new Date(iso).getTime() : NaN
  if (Number.isNaN(time)) return ""
  const seconds = Math.round((time - now) / 1000)
  const format = new Intl.RelativeTimeFormat(uiLocale(), { numeric: "auto", style: "short" })
  const [unit, size] = RELATIVE_UNITS.find(([, s]) => Math.abs(seconds) >= s) || ["second", 1]
  return unit === "second" ? format.format(0, "second") : format.format(Math.round(seconds / size), unit)
}

/**
 * A cost in US dollars as people read it: "$0.04"; a cost under a cent "<$0.01". Unknown (null, "", NaN) is "".
 *
 * @param {string|number|null|undefined} amount - decimal-ish input ("0.0420")
 */
export function formatUsd(amount) {
  const formatted = formatCost(amount)
  if (!formatted) return ""
  const num = Number(amount)
  if (num > 0 && num < 0.01) return "<$0.01"
  return `$${formatted}`
}
