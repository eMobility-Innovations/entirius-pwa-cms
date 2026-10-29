// Task templates (contract A3 § 4) as the CMS writes them: a key made from the name, the params of a run without
// its channel (a template serves every channel), the next position, the rules one per line.

const KEY_MAX = 64;
const POSITION_STEP = 10;

/** "Meta opisy" → "meta-opisy": the template key (`^[a-z0-9][a-z0-9_.-]*$`), unique among `taken`. */
export function templateKey(label, taken = []) {
  const base = (label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, KEY_MAX - 3) || "template";
  const used = new Set(taken);
  let key = base;
  for (let n = 2; used.has(key); n += 1) key = `${base}-${n}`;
  return key;
}

/** The position after the last template. */
export function nextPosition(templates = []) {
  return Math.max(0, ...templates.map((t) => t.position || 0)) + POSITION_STEP;
}

/** A run's params as a template keeps them: the channel left out. */
export function templateParams(params = {}) {
  const { channel: _channel, ...rest } = params;
  return rest;
}

/**
 * POST templates/ body for the run set up in the dialog ("Save as template"). `templates` must be every template
 * (keys are unique across all of them, hidden and other modules included); `rules` are carried over from the template
 * the run started from.
 */
export function newTemplateBody({ label, worker, params, rules = [], templates = [] }) {
  return {
    key: templateKey(label, templates.map((t) => t.key)),
    label: label.trim(),
    worker_key: worker.key,
    params: templateParams(params),
    rules: [...rules],
    position: nextPosition(templates),
    active: true,
  };
}

/** Rules typed one per line → the list (blank lines dropped). */
export function parseRules(text) {
  return (text || "").split("\n").map((line) => line.trim()).filter(Boolean);
}
