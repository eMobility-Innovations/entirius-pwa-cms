// The products a Studio task runs on (TaskTargetPicker): a pasted SKU list, checked against the channel.

// Mirrors the backend caps: `subjects/resolve/` takes at most 500 refs, a run at most ENRICHMENT_QUEUE_MAX_SUBJECTS (500).
export const MAX_REFS = 500;
// Unknown SKUs listed by name in the summary; the rest are counted.
export const UNKNOWN_SHOWN = 10;

/** The SKUs of a paste (Excel column, comma or semicolon list, spaces): trimmed, blanks dropped, deduped, order kept. */
export function parseRefs(text) {
  return [...new Set(String(text || "").split(/[\s,;]+/).filter(Boolean))];
}
