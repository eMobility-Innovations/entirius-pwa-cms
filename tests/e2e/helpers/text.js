/**
 * Shared P5 smoke helper: match either locale's text for a label/name lookup.
 * `either(...strings)` builds one anchored RegExp from its arguments, each regex-escaped
 * first so a translation containing `(`, `?`, `.` or `|` cannot change or break the match.
 */

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function either(...strings) {
  return new RegExp(`^(${strings.map(escapeRegExp).join('|')})$`);
}

module.exports = { either, escapeRegExp };
