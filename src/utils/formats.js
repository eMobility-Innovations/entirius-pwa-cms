import { t } from "@/i18n";
import { numberLocale } from "@/utils/taxRate";

// Field formats (plan 61): one class per kind of value whose format matters. Per class:
// - `parse(text)` turns typed text into the model value the API takes ("232,5" → "232.50"); text it cannot read
//   comes back trimmed, never corrected into another value (the check reports it);
// - `display(value)` shows a model value (money and percent with the UI language's decimal separator);
// - `check(value, rules)` returns the i18n key of what is wrong, "" when fine. An empty value is always fine here —
//   required is the FormField / validateRequired rule, not a format.
// `rules`: `min` / `max` (numbers), `pattern` (the API regex of a code or key), `example` (shown in the message).
// Stored units never change: money stays a decimal string, percent stays percent (taxRate.js converts tax rates).

// Postgres `integer`: the largest whole number an API integer field stores.
export const INT_MAX = 2147483647;

const EAN_LENGTHS = [8, 12, 13, 14];
// A format's own limits; a rule of the field replaces them (`min: -100` lets a money field go negative).
const DEFAULT_LIMITS = { money: { min: 0 }, percent: { min: 0, max: 100 } };
const MONEY_RE = /^-?\d+(\.\d{1,2})?$/;
const INTEGER_RE = /^-?\d+$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value) => (value === null || value === undefined ? "" : String(value).trim());
// Thousands groups split by spaces: "1 234,5".
const THOUSANDS_RE = /^-?\d{1,3}(\s\d{3})+([.,]\d*)?$/;

// "1 234,5" → "1234.5": the spaces between thousands groups go, the comma reads as the decimal point. Any other inner
// space stays, so the check reports it ("12 5" is never read as 125).
function numeric(value) {
  const typed = text(value);
  return (THOUSANDS_RE.test(typed) ? typed.replace(/\s/g, "") : typed).replace(",", ".");
}
const dropLeadingZeros = (whole) => whole.replace(/^(-?)0+(?=\d)/, "$1");

function decimalSeparator() {
  const parts = new Intl.NumberFormat(numberLocale()).formatToParts(1.5);
  return parts.find((part) => part.type === "decimal").value;
}

const localised = (value) => text(value).replace(".", decimalSeparator());

function range(number, { min, max } = {}) {
  if (min !== undefined && min !== null && number < Number(min)) return "formats.min";
  if (max !== undefined && max !== null && number > Number(max)) return "formats.max";
  return "";
}

function parseMoney(value) {
  const typed = numeric(value);
  if (!MONEY_RE.test(typed)) return typed;
  const [whole, fraction = ""] = typed.split(".");
  return `${dropLeadingZeros(whole)}.${fraction.padEnd(2, "0")}`;
}

function checkMoney(value, rules = {}) {
  const typed = numeric(value);
  if (!MONEY_RE.test(typed)) return "formats.money";
  return range(Number(typed), rules);
}

function parsePercent(value) {
  const typed = numeric(value);
  return MONEY_RE.test(typed) ? String(Number(typed)) : typed;
}

function checkPercent(value, rules = {}) {
  const typed = numeric(value);
  if (!MONEY_RE.test(typed)) return "formats.percent";
  return range(Number(typed), rules);
}

function parseInteger(value) {
  const typed = numeric(value);
  return INTEGER_RE.test(typed) ? dropLeadingZeros(typed) : typed;
}

function checkInteger(value, rules) {
  const typed = numeric(value);
  if (!INTEGER_RE.test(typed)) return "formats.integer";
  return range(Number(typed), rules);
}

// GS1: from the right, the payload digits weigh 3, 1, 3, …; the check digit tops the sum up to a multiple of 10.
export function gtinCheckDigit(payload) {
  const sum = [...payload].reverse().reduce((acc, digit, i) => acc + Number(digit) * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function checkEan(value) {
  const digits = text(value);
  if (!/^\d+$/.test(digits) || !EAN_LENGTHS.includes(digits.length)) return "formats.ean";
  return gtinCheckDigit(digits.slice(0, -1)) === Number(digits.at(-1)) ? "" : "formats.ean_checksum";
}

function checkCode(value, { pattern } = {}, key = "formats.code") {
  const typed = text(value);
  if (/\s/.test(typed)) return key;
  return pattern && !new RegExp(pattern).test(typed) ? key : "";
}

function checkUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(text(value)).protocol) ? "" : "formats.url";
  } catch {
    return "formats.url";
  }
}

const upper = (value) => text(value).toUpperCase();
const letters = (length, key) => (value) => (new RegExp(`^[A-Z]{${length}}$`).test(text(value)) ? "" : key);

export const FORMATS = {
  money: { parse: parseMoney, display: (value) => localised(parseMoney(value)), check: checkMoney },
  percent: { parse: parsePercent, display: localised, check: checkPercent },
  integer: { parse: parseInteger, display: text, check: checkInteger },
  ean: { parse: (value) => text(value).replace(/[\s-]/g, ""), display: text, check: checkEan },
  // A code the API keeps upper-case (a lead type): typed in any case, stored upper-case.
  code: { parse: upper, display: text, check: (value, rules) => checkCode(value, rules) },
  // A key or an identifier kept as typed: no spaces, the API pattern when it has one.
  key: { parse: text, display: text, check: (value, rules) => checkCode(value, rules, "formats.key") },
  slug: {
    parse: (value) => text(value).toLowerCase().replace(/\s+/g, "-"),
    display: text,
    check: (value) => (SLUG_RE.test(text(value)) ? "" : "formats.slug"),
  },
  email: { parse: text, display: text, check: (value) => (EMAIL_RE.test(text(value)) ? "" : "formats.email") },
  url: { parse: text, display: text, check: checkUrl },
  iso2: { parse: upper, display: text, check: letters(2, "formats.iso2") },
  iso4217: { parse: upper, display: text, check: letters(3, "formats.iso4217") },
};

const isEmpty = (value) => text(value) === "";

/** The model value for typed text; "" for an empty field. */
export function parseFormat(format, value) {
  return isEmpty(value) ? "" : FORMATS[format].parse(value);
}

/** The text a field shows for a model value. */
export function displayFormat(format, value) {
  return isEmpty(value) ? "" : FORMATS[format].display(value);
}

/** The translated message of what is wrong with a value, "" when it is fine or empty. */
export function formatError(format, value, rules = {}) {
  if (isEmpty(value)) return "";
  // An unset rule (a BasicInput `min` of null) keeps the format's own limit (money ≥ 0).
  const set = Object.fromEntries(Object.entries(rules).filter(([, rule]) => rule !== null && rule !== undefined));
  const limits = { ...DEFAULT_LIMITS[format], ...set };
  const key = FORMATS[format].check(value, limits);
  return key ? t(key, { min: limits.min, max: limits.max, example: limits.example ?? t(`formats.example.${format}`) }) : "";
}
