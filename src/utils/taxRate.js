import { uiLocale } from "@/i18n";

// PriceManager stores a tax rate as a decimal fraction with 4 places ("0.2300" = 23 %);
// the CMS shows and takes percent. Both directions round to 2 percent decimals.

// The Intl locale of the UI language (formats.js reads its decimal separator from it).
export const numberLocale = uiLocale;

const round2 = (n) => Math.round(n * 100) / 100;

// null for a missing or non-numeric value: an empty field is never a silent zero.
function toNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function rateToPercent(rate) {
  const num = toNumber(rate);
  return num === null ? null : round2(num * 100);
}

export function percentToRate(percent) {
  const num = toNumber(percent);
  return num === null ? null : (round2(num) / 100).toFixed(4);
}

// "23 %", "8,5 %" (pl) / "8.5 %" (en); "" when the rate is missing.
export function formatTaxRate(rate) {
  const percent = rateToPercent(rate);
  if (percent === null) return "";
  return `${new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 2 }).format(percent)} %`;
}
