#!/usr/bin/env node
// Read-only audit (plan 19, FIX-09): the mutating controls of a panel's views that the read-only mode does not reach.
// A finding is a template handler — `@click`, `@update:model-value`, `@change`, `@end`, `@drop` — that calls, directly
// or through the file's own functions, a POST, PUT, PATCH or DELETE function imported from `@/api`, on an element the
// mode does not reach: a click needs a `BasicButton`/`IconButton` marked `mutates` (those hide themselves under a
// read-only PageLayout); a value event needs a control boot that follows the mode (it reads the FormField contract,
// whose standalone default is the page's read-only flag); any other element (a `draggable`, a drop zone, a file
// input) binds the flag itself — `:disabled="…readonly…"` or `v-if="!readonly…"` (`v-else-if` too) — or its handler's
// function returns early on it (`if (readonly.value) return`). ActionBar,
// FloatingActions and BulkActionBar take their actions as data, so they never show up here. Code only, no page is
// opened; a heuristic, not a proof. A button whose POST only reads (a lookup, a preview, a validation) says so with
// `:mutates="false"`: it stays on a read-only page and the audit takes the declaration. `npm run audit:readonly` (part
// of `lint:ui`) fails on any finding.
// Usage: node scripts/audit/readonly.mjs [--panels pages,pim] [--fail-on-findings]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ROUTER = "src/router/index.js";
const VIEWS = "src/views";
const WRITE_API = /^(POST|PUT|PATCH|DELETE)_/;
const BOOTS = "src/boots";
const FORM_FIELD = "src/composables/formField.js";
// The boots that honour `mutates` (they inject the PageLayout flag).
const AWARE = new Set(["BasicButton", "IconButton"]);
const TAG = /<([A-Za-z][\w.-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/g;
const EVENT = /(?:@|v-on:)(click|update:model-value|update:modelValue|change|end|drop)(?=[.\s=])(?:\.[\w.]+)?\s*=\s*"([^"]*)"/g;
const VALUE_EVENTS = new Set(["update:model-value", "update:modelValue", "change"]);
const FUNCTION = /(?:function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>|^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{)/gm;

const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "function", "return"]);

const read = (file) => readFileSync(join(ROOT, file), "utf8");

function vueFiles(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith(".vue") ? [path] : [];
  });
}

/** [{ panel, file }] of every routed view: the component's file and the `panel` of its route's meta. */
export function routedViews(source) {
  const statics = Object.fromEntries(
    [...source.matchAll(/^import (\w+) from "\.\.\/views\/([^"]+)"/gm)].map(([, name, path]) => [name, path])
  );
  const components = [...source.matchAll(/component:\s*(?:\(\)\s*=>\s*import\((?:\/\*.*?\*\/\s*)?"\.\.\/views\/([^"]+)"\)|(\w+))/g)];
  return components.flatMap((match, index) => {
    const path = match[1] ?? statics[match[2]];
    const end = components[index + 1]?.index ?? source.length;
    const panel = source.slice(match.index, end).match(/panel:\s*"([\w-]+)"/)?.[1];
    return path && panel ? [{ panel, file: join(VIEWS, path) }] : [];
  });
}

/** The .vue files of a panel: the directory of each routed view (a view at the views root alone). */
export function panelFiles(views, panel) {
  const files = views
    .filter((view) => view.panel === panel)
    .flatMap(({ file }) => (dirname(file) === VIEWS ? [file] : vueFiles(dirname(file))));
  return [...new Set(files)].sort();
}

// A function that returns early on the page's read-only flag: `if (readonly.value) return`, `if (this.readonly) return`.
const READONLY_GUARD = /\bif\s*\(\s*(?:this\.|props\.)?readonly(?:\.value)?\s*\)\s*return\b/;

/** The file's functions (sliced up to the next function), by name. */
function functionBodies(script) {
  const starts = [...script.matchAll(FUNCTION)]
    .map((m) => ({ name: m[1] ?? m[2] ?? m[3], at: m.index }))
    .filter(({ name }) => !KEYWORDS.has(name));
  return starts.map((fn, i) => ({ name: fn.name, body: script.slice(fn.at, starts[i + 1]?.at) }));
}

/** The file's functions that return early on the read-only flag: their callers need no other guard. */
export function guardedNames(script) {
  return new Set(functionBodies(script).filter(({ body }) => READONLY_GUARD.test(body)).map(({ name }) => name));
}

/** The file's functions whose body (sliced up to the next function) calls a write API, directly or transitively. */
export function mutatingNames(script) {
  const imported = [...script.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/api\/[^"]+"/g)]
    .flatMap(([, names]) => names.split(","))
    .map((spec) => spec.trim().split(/\s+as\s+/))
    .filter(([name]) => WRITE_API.test(name))
    .map((parts) => parts.at(-1));
  const bodies = functionBodies(script);
  const names = new Set(imported);
  let grew = true;
  while (grew) {
    const found = bodies.filter(({ name, body }) => !names.has(name) && callsAny(body, names));
    found.forEach(({ name }) => names.add(name));
    grew = found.length > 0;
  }
  return names;
}

const callsAny = (code, names) => (code.match(/[A-Za-z_$][\w$]*(?=\s*\()/g) ?? []).some((id) => names.has(id));

const sfcPart = (source, tag) =>
  [...source.matchAll(new RegExp(`^<${tag}[^>]*>([\\s\\S]*?)^</${tag}>`, "gm"))].map((m) => m[1]).join("\n");

/** The control boots that follow the read-only mode: they read the FormField contract, whose standalone default is
 * the page's flag. None while that default is not wired to `useReadonly`. */
export function readonlyControls() {
  if (!/disabled:\s*useReadonly\(\)/.test(read(FORM_FIELD))) return new Set();
  const boots = readdirSync(join(ROOT, BOOTS), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const file = (name) => join(BOOTS, name, "index.vue");
  const reads = ({ name }) => existsSync(join(ROOT, file(name))) && /useControlAttrs|useFormFieldControl/.test(read(file(name)));
  return new Set(boots.filter(reads).map(({ name }) => name));
}

// An element that takes the page's read-only flag itself: disabled by it, or not rendered under it.
const BINDS_READONLY = /\s(?::disabled="[^"]*\breadonly\b|v-(?:else-)?if="!readonly\b)/;

/** True when the read-only mode reaches `event` on this element. */
function reached(tag, attrs, event, controls) {
  if (event === "click") return AWARE.has(tag) && /\s:?mutates\b/.test(attrs);
  if (VALUE_EVENTS.has(event) && controls.has(tag)) return true;
  return BINDS_READONLY.test(attrs);
}

/** [{ line, tag, event, handler }] of one SFC. */
export function auditSource(source, controls = readonlyControls()) {
  const script = sfcPart(source, "script");
  const names = mutatingNames(script);
  if (!names.size) return [];
  // A guard is enough where nothing is shown (a drop, a change); a button that silently does nothing is still shown.
  const guarded = guardedNames(script);
  const writes = (handler, event) =>
    (handler.match(/[A-Za-z_$][\w$]*/g) ?? []).some(
      (id) => names.has(id) && (event === "click" || !guarded.has(id))
    );
  return [...source.matchAll(TAG)].flatMap((match) => {
    const [, tag, attrs] = match;
    const line = source.slice(0, match.index).split("\n").length;
    return [...attrs.matchAll(EVENT)]
      .filter(([, event, handler]) => writes(handler, event) && !reached(tag, attrs, event, controls))
      .map(([, event, handler]) => ({ line, tag, event, handler }));
  });
}

/** [{ panel, file, line, tag, handler }] over the routed views of `panels` (every panel when null). */
export function audit(panels = null) {
  const views = routedViews(read(ROUTER));
  const wanted = panels ?? [...new Set(views.map((view) => view.panel))].sort();
  const controls = readonlyControls();
  return wanted.flatMap((panel) =>
    panelFiles(views, panel).flatMap((file) =>
      auditSource(read(file), controls).map((finding) => ({ panel, file, ...finding }))
    )
  );
}

function main(argv) {
  const panelsArg = argv[argv.indexOf("--panels") + 1];
  const panels = argv.includes("--panels") ? panelsArg.split(",").map((p) => p.trim()) : null;
  const findings = audit(panels);
  for (const { panel, file, line, tag, event, handler } of findings) {
    console.log(`${panel}\t${relative(ROOT, join(ROOT, file))}:${line}\t<${tag}> @${event}="${handler}"`);
  }
  console.log(`readonly audit: ${findings.length} finding(s) in ${panels ? panels.join(", ") : "every panel"}`);
  return argv.includes("--fail-on-findings") && findings.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
