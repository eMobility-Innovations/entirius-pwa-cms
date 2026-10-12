import DOMPurify from "dompurify";

// Stored HTML is rendered in a staff session, so it is cleaned where it is rendered: an account that can save content
// can send any markup through the API, past the editor. The allowlist is what BasicWysiwyg writes.
const TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "div", "span", "blockquote", "pre", "code",
  "ul", "ol", "li", "a", "img", "strong", "b", "em", "i", "u", "s", "del", "mark", "sub", "sup",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
];
const ATTRS = [
  "href", "target", "rel", "src", "alt", "title", "width", "height", "style",
  "colspan", "rowspan", "colwidth", "data-color", "data-faq-tooltip",
];
// http, https, mailto, or no scheme at all (a path or an anchor).
const URI = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;
const SCHEME = /^\s*[a-z][a-z0-9+.-]*:/i;
const HTTP = /^\s*https?:/i;
// The editor styles alignment, colours and table column widths. Nothing else stays: no position or size that could
// lay stored content over the CMS, and no value that could load anything (a url needs a character outside the set).
const STYLE_PROPS = ["text-align", "color", "background-color", "width", "min-width"];
const STYLE_VALUE = /^[\w\s#.,%()-]+$/;

const CONFIG = { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOWED_URI_REGEXP: URI, ALLOW_DATA_ATTR: false };

const purifier = DOMPurify(window);

function editorStyle(style) {
  const kept = style.split(";").filter((declaration) => {
    const [prop, value = ""] = declaration.split(/:(.*)/s);
    return STYLE_PROPS.includes(prop.trim().toLowerCase()) && STYLE_VALUE.test(value.trim());
  });
  return kept.map((declaration) => declaration.trim()).join("; ");
}

purifier.addHook("uponSanitizeAttribute", (node, data) => {
  const { attrName, attrValue } = data;
  if (attrName === "src" && SCHEME.test(attrValue) && !HTTP.test(attrValue)) data.keepAttr = false;
  if (attrName !== "style") return;
  data.attrValue = editorStyle(attrValue);
  data.keepAttr = data.attrValue !== "";
});

purifier.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("target")) node.setAttribute("rel", "noopener noreferrer");
});

/** Stored HTML made safe for `v-html`: no script, no event handler, no frame, no link or image outside http(s) and mailto. */
export function sanitizeHtml(html) {
  return purifier.sanitize(html ?? "", CONFIG);
}
