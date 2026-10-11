// A URL that came from the server (a supplier's product page, a meeting link, a subject or fix URL) is bound to
// `href` only as http, https or mailto; anything else (`javascript:`, `data:`) gives `undefined`, so Vue renders the
// link without an href.
const SAFE_SCHEME = /^(?:https?|mailto):/i;

export function safeHref(url) {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  return SAFE_SCHEME.test(trimmed) ? trimmed : undefined;
}
