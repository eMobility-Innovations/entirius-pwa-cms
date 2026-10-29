// Input audit, verdicts (plan 61a): the format class of a field, where the CMS and the API disagree about it, and the
// format plan 61 should give it.
const NAME_CLASSES = [
  ["email", /(^|_)e?mail(_|$)|email/],
  ["url", /(^|_)(url|link|href|website|domain|webhook)(_|$)/],
  ["ean", /(^|_)(ean|gtin|barcode)(_|$)/],
  ["slug", /(^|_)(slug|url_key)(_|$)/],
  ["iso4217", /(^|_)currency(_code)?(_|$)/],
  ["iso2", /(^|_)country(_code)?(_|$)/],
  ["language", /(^|_)(lang|language|locale)(_code)?(_|$)/],
  ["phone", /(^|_)(phone|tel|mobile)(_|$)/],
  ["postal", /(^|_)(postal|post_code|postcode|zip(_code)?)(_|$)/],
  ["percent", /(^|_)(percent|percentage|pct|rate|discount_value)(_|$)/],
  ["money", /(^|_)(price|amount|cost|budget|deal_value|total|special_value|net|gross|floor|ceiling)(_|$)/],
  ["integer", /(^|_)(qty|quantity|stock|count|priority|order|position|limit|days|hours|minutes|max_\w+|min_\w+|cap|delay\w*)(_|$)/],
  ["sku", /(^|_)(sku|mpn|code|idx|key|identifier|ref)(_|$)/],
];
const NUMERIC = new Set(["money", "percent", "integer", "decimal"]);
// The BasicInput `format` prop (plan 61, src/utils/formats.js) names its class; `code` and `key` are identifiers.
const FORMAT_CLASS = { code: "sku", key: "sku" };

export const PROPOSED = {
  money: "decimal with 2 places: NumberInput step 0.01, shown and sent as 232.00, ',' accepted as '.'",
  percent: "0–100 with up to 2 places, '%' suffix; converted to the API unit (a fraction for tax rates, src/utils/taxRate.js)",
  integer: "whole number: NumberInput step 1, min/max taken from the API",
  decimal: "decimal with the API's places: NumberInput step = 10^-places",
  ean: "digits only, length 8/12/13/14, GTIN check digit verified before save",
  sku: "trimmed code, no spaces; the API pattern and maxLength checked inline",
  slug: "lowercase a-z, 0-9 and '-', derived from the name until edited",
  email: "type=email, trimmed, checked inline before save",
  url: "type=url, absolute http(s) URL checked inline",
  iso2: "select of ISO 3166-1 alpha-2 codes (uppercase), not free text",
  iso4217: "select of ISO 4217 codes (the channel currencies), not free text",
  language: "select of the channel languages (ISO 639-1), not free text",
  phone: "type=tel, E.164 (+48…) normalised on blur",
  postal: "per-country pattern (PL NN-NNN), checked inline",
  date: "BasicDatePicker, ISO date / date-time in the payload",
  "free text": "trimmed; the API maxLength as maxlength",
};

const numberish = (value) => (value === undefined || value === null ? null : Number(String(value).split(" ")[0]));
// A static flag: `readonly`, `readonly=""`, `:readonly="true"`; a bound expression is not known to be on.
export const isFlagOn = (value) => value !== undefined && value !== "false" && !isBound(value);
const isBound = (value) => String(value).startsWith("{");
const isStatic = (value) => value !== undefined && !String(value).startsWith("{");

function apiClass(api, name) {
  if (api.format === "email" || /^\^?\(?\[\^@/.test(api.pattern || "")) return "email";
  if (api.format === "uri") return "url";
  if (api.format === "date" || api.format === "date-time") return "date";
  if (api.type === "integer") return NAME_CLASSES.find(([, re]) => re.test(name))?.[0] === "percent" ? "percent" : "integer";
  if (api.format === "decimal" || api.type === "number") {
    const byName = NAME_CLASSES.find(([cls, re]) => NUMERIC.has(cls) && re.test(name))?.[0];
    return byName || (api.places === 2 ? "money" : "decimal");
  }
  return null;
}

/** The format class of one input: the API format first, then the field name, then how the CMS renders it. */
export function classify(input, field, api = {}) {
  const last = (field || input.model || "").split(/[.[\]]/).filter(Boolean).pop() || "";
  const name = last.replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
  const own = input.constraints.format;
  if (own && !isBound(own)) return FORMAT_CLASS[own] || own;
  const byApi = apiClass(api, name);
  if (byApi) return byApi;
  const byName = NAME_CLASSES.find(([, re]) => re.test(name))?.[0];
  if (byName) return byName;
  if (input.component === "BasicDatePicker" || /date/.test(input.constraints.type || "")) return "date";
  if (input.component === "NumberInput") return input.constraints.decimals ? "decimal" : "integer";
  return "free text";
}

function lengthChecks(cms, api) {
  if (api.maxLength === undefined) return [];
  if (cms.maxlength === undefined) return [["api-only", `maxLength ${api.maxLength} not enforced`]];
  const own = numberish(cms.maxlength);
  return isStatic(cms.maxlength) && own !== api.maxLength ? [["cms-different", `maxlength ${own} vs API ${api.maxLength}`]] : [];
}

function patternChecks(cms, api) {
  if (api.pattern && !cms.pattern) return [["api-only", `pattern ${api.pattern} not checked`]];
  if (api.enum && !cms.pattern) return [["api-only", `API accepts only ${api.enum.join(" | ")}`]];
  return [];
}

function rangeCheck(bound, cmsValue, apiValue) {
  const own = numberish(cmsValue);
  const defaulted = String(cmsValue ?? "").includes("default");
  if (apiValue === undefined) return defaulted && bound === "max" ? [["cms-different", `stepper caps at ${own} (default), API unbounded`]] : [];
  if (cmsValue === undefined) return [["api-only", `${bound === "max" ? "maximum" : "minimum"} ${apiValue} not enforced`]];
  return isStatic(cmsValue) && own !== apiValue ? [["cms-different", `${bound} ${own}${defaulted ? " (default)" : ""} vs API ${apiValue}`]] : [];
}

function rangeChecks(cms, api) {
  return [...rangeCheck("min", cms.min, api.minimum ?? api.exclusiveMinimum), ...rangeCheck("max", cms.max, api.maximum ?? api.exclusiveMaximum)];
}

function numericChecks(input, cls, api) {
  const cms = input.constraints;
  const numericApi = api.type === "integer" || api.type === "number" || api.format === "decimal";
  if (numericApi && input.component !== "NumberInput" && !["number"].includes(cms.type) && !NUMERIC.has(cms.format)) {
    return [["api-only", `numeric API field (${api.format || api.type}) in a free-text input`]];
  }
  if (input.component === "NumberInput" && api.places > 0 && cms.decimals === 0) {
    return [["cms-different", `integer-only stepper, API takes ${api.places} decimal places`]];
  }
  return rangeChecks(cms, api);
}

function formatChecks(input, api) {
  const type = input.constraints.type;
  const expected = { email: "email", uri: "url" }[api.format];
  if (expected && type !== expected) return [["api-only", `API format ${api.format}, input type ${type || "text"}`]];
  const isDate = input.component === "BasicDatePicker" || /date/.test(type || "");
  if (/^date/.test(api.format || "") && !isDate) return [["api-only", `API format ${api.format} in a text input`]];
  return [];
}

function displayChecks(input, cls, api) {
  if (!["money", "decimal", "percent"].includes(cls) || !api.places || input.constraints.format === cls) return [];
  return [["display-format", `shown as typed (232), stored with ${api.places} places (232.${"0".repeat(api.places)})`]];
}

/** Every disagreement between the CMS input and its API field: [{ kind, detail }]. */
export function mismatches(input, cls, api) {
  const { readonly, disabled } = input.constraints;
  if (!api || isFlagOn(readonly) || isFlagOn(disabled)) return [];
  const found = [
    ...lengthChecks(input.constraints, api),
    ...patternChecks(input.constraints, api),
    ...(NUMERIC.has(cls) ? numericChecks(input, cls, api) : []),
    ...formatChecks(input, api),
    ...displayChecks(input, cls, api),
  ];
  return found.map(([kind, detail]) => ({ kind, detail }));
}
