import DOMPurify from "dompurify";

// Stored HTML is rendered in a staff session, so it is cleaned where it is rendered: an account that can save content
// can send any markup through the API, past the editor. The allowlist is what BasicWysiwyg writes.
const TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "div", "span", "blockquote", "pre", "code",
  "ul", "ol", "li", "a", "img", "strong", "b", "em", "i", "u", "s", "del", "mark", "sub", "sup",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
];
const ATTRS = [
  "href", "target", "rel", "src", "alt", "title", "width", "height", "class", "style",
  "colspan", "rowspan", "colwidth", "data-color", "data-faq-tooltip",
];
// http, https, mailto, or no scheme at all (a path or an anchor).
const URI = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;
const SCHEME = /^\s*[a-z][a-z0-9+.-]*:/i;
const HTTP = /^\s*https?:/i;
// A style may not load anything: no url(), no @import, no expression(), no escape or comment that could hide one.
const STYLE_LOADS = /url\s*\(|expression\s*\(|@import|\\|\/\*/i;

const CONFIG = { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOWED_URI_REGEXP: URI, ALLOW_DATA_ATTR: false };

const purifier = DOMPurify(window);

purifier.addHook("uponSanitizeAttribute", (node, data) => {
  const { attrName, attrValue } = data;
  if (attrName === "src" && SCHEME.test(attrValue) && !HTTP.test(attrValue)) data.keepAttr = false;
  if (attrName === "style" && STYLE_LOADS.test(attrValue)) data.keepAttr = false;
});

purifier.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("target")) node.setAttribute("rel", "noopener noreferrer");
});

/** Stored HTML made safe for `v-html`: no script, no event handler, no frame, no link or image outside http(s) and mailto. */
export function sanitizeHtml(html) {
  return purifier.sanitize(html ?? "", CONFIG);
}
