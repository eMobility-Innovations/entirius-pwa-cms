// Application tokens (django-access): the rules the token dialogs share. A token is publishable (reaches browsers) or
// secret (server-to-server); one token never holds both groups. No token has to expire and there is no maximum lifetime
// (D31): every token, legacy or not, takes any future date or none; the API flags an old one `rotation_due` instead. A
// picked date means the start of that day in the browser's time zone (the `access_token expire --at` rule), so
// tomorrow is the earliest. The server checks it again; its 400 `EXPIRY_IN_PAST` reads as the same field error.

const DAY_MS = 86400000;
const EXPIRY_IN_PAST = "EXPIRY_IN_PAST";
// Client-only: "On a date" with no day picked — never sent as "No expiry".
const DATE_MISSING = "DATE_MISSING";
export const PUBLISHABLE = "publishable";
export const SECRET = "secret";

// "ent_api_Ab3d…x9Q2": how a token is recognised, never by its value.
export const tokenKey = (token) => (token.last_four ? `${token.prefix}…${token.last_four}` : token.prefix);

// An unknown scope counts as secret: the stricter rules apply.
export function scopeGroup(key, scopes) {
  return scopes.find((scope) => scope.key === key)?.publishable ? PUBLISHABLE : SECRET;
}

const isSecret = (keys, scopes) => keys.some((key) => scopeGroup(key, scopes) === SECRET);
export const isPublishable = (keys, scopes) => keys.some((key) => scopeGroup(key, scopes) === PUBLISHABLE);

// The group a selection rules out (its checkboxes are disabled), or null while nothing is ticked.
export function blockedGroup(keys, scopes) {
  if (!keys.length) return null;
  return isSecret(keys, scopes) ? PUBLISHABLE : SECRET;
}

const pad = (n) => String(n).padStart(2, "0");
export const dateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function dayFromToday(days, now) {
  return dateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

export const minExpiryDate = (now = new Date()) => dayFromToday(1, now);

// "2027-10-03" → the ISO instant of that day's local start; empty → null (no expiry).
export function expiryInstant(date) {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toISOString();
}

// The client-side check of an expiry field ("" = no expiry; `pending`: "On a date" without a day): null when fine, else
// the issue code.
export function expiryIssue({ date, pending }, now = new Date()) {
  if (pending) return DATE_MISSING;
  return date && date < minExpiryDate(now) ? EXPIRY_IN_PAST : null;
}

// The issue code of the server's expiry refusal (`details[].field === "expires_at"`) when it is ours, else null (the
// field then shows the server's own text).
export function refusedExpiryIssue(err) {
  const body = err?.response?.data ?? err;
  const detail = (Array.isArray(body?.details) ? body.details : []).find((d) => d?.field === "expires_at");
  return detail?.issue === EXPIRY_IN_PAST ? EXPIRY_IN_PAST : null;
}

// The local date of an ISO expiry, for a dialog that edits it.
export const isoToDate = (iso) => (iso ? dateString(new Date(iso)) : "");

// "in 364 days" / "3 days ago" in the UI language.
export function relativeDays(iso, lang, now = new Date()) {
  const days = Math.round((new Date(iso).getTime() - now.getTime()) / DAY_MS);
  return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(days, "day");
}

// A token's `age_days` (whole days since issue or import): "today" / "1 day" / "12 days" in the UI language; "—" from an
// API without it.
export function ageText(days, lang) {
  if (days == null) return "—";
  if (days === 0) return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(0, "day");
  return new Intl.NumberFormat(lang, { style: "unit", unit: "day", unitDisplay: "long" }).format(days);
}
