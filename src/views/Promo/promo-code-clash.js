// A discount code is unique per channel and currency (django-checkout): the v2 admin API refuses a clash with 400
// VALIDATION_ERROR, issue UNIQUE, on the request field that would clash: `code` (a new or renamed code),
// `codes.<i>.code` (the codes of a new rule) or `currencies` / `channels` (a rule's new scope). Its `description` names
// the other rule, the channel and the currencies.
const CLASH_ISSUE = "UNIQUE";
const CLASH_FIELDS = ["code", "currencies", "channels"];

// The form key useFormErrors gives a field (its last segment: `codes.0.code` → `code`).
const fieldKey = (field) => String(field ?? "").split(".").pop();

// `{ field, description }` of a code-clash refusal, `field` as the form keys it; null for any other error.
export function codeClash(err) {
  const body = err?.response?.data ?? err;
  const details = Array.isArray(body?.details) ? body.details : [];
  const detail = details.find((d) => d?.issue === CLASH_ISSUE && CLASH_FIELDS.includes(fieldKey(d.field)));
  return detail ? { field: fieldKey(detail.field), description: detail.description || "" } : null;
}
