import { t } from "@/i18n";

// One text source for the header panel and the in-view banner: `config_health.checks.<code>.<state>` (code dots →
// underscores); a code this CMS does not know yet falls back to the backend's English title.
export function checkKey(code) {
  return code.replace(/\./g, "_");
}

export function checkText(row) {
  const key = `config_health.checks.${checkKey(row.code)}.${row.state}`;
  const text = t(key, { scope: row.scope });
  return text === key ? row.title || row.code : text;
}

export function checkName(code) {
  const key = `config_health.names.${checkKey(code)}`;
  const text = t(key);
  return text === key ? code : text;
}

// `/…` is a CMS route, anything else an external page (module docs).
export function isInternalFix(url) {
  return typeof url === "string" && url.startsWith("/");
}

// Env-var names (EMAIL_HOST) and URLs are the only parts of a check's text that may break mid-word: split them out so
// the panel sets them in the mono font. `[{ text, code }]`, in order; `code` marks a name or a URL.
const CODE_TOKEN = /(https?:\/\/[^\s)]*[^\s).,;:]|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b)/;

export function textTokens(text) {
  return String(text ?? "")
    .split(CODE_TOKEN)
    .filter(Boolean)
    .map((part) => ({ text: part, code: CODE_TOKEN.test(part) }));
}
