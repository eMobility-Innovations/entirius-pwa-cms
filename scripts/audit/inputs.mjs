#!/usr/bin/env node
// Input format audit (plan 61a): every text/number input of src/views, src/functionals and src/components, joined to
// the OpenAPI property it edits, classified (money, ean, slug, …) and checked against it. Code + schema only: no page
// is opened. The join follows the v-model path (last segment, plus the payload keys it is copied into) to the
// write calls of the `@/api` functions the file imports — the panel's imports when the file has none that fit — and
// to the GET query parameters for filters. Several fields that disagree are an unresolved join, never a guess.
// Usage: node scripts/audit/inputs.mjs --schema <url|file> --out <json> [--report <md>]
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { extractInputs } from "./inputs-sfc.mjs";
import { catalogOf, matchPath, operationFields } from "./inputs-api.mjs";
import { classify, isFlagOn, mismatches, PROPOSED } from "./inputs-classify.mjs";
import { renderReport } from "./inputs-report.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const SCANNED = ["src/views", "src/functionals", "src/components"];
const WRITES = new Set(["post", "put", "patch"]);
// A wrapper input bound to its own v-model prop: the field is decided by whoever uses the wrapper.
const PASS_THROUGH = /^(props\.)?(modelValue|value|__value)$/;
// Create and update of one resource differ in required-ness only (minLength 1, a nullable PATCH): not a disagreement.
const IGNORED_KEYS = new Set(["description", "examples", "minLength"]);

function vueFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith(".vue") ? [path] : [];
  });
}

/** views/<Panel>/… → Panel; components/<dir>/… → components/<dir>; functionals/<dir>/… → functionals/<dir>. */
export function panelOf(file) {
  const [top, first, second] = file.split("/").slice(1);
  if (top === "views") return second ? first : first.replace(/\.vue$/, "");
  return second ? `${top}/${first}` : top;
}

function apiCatalog() {
  const catalog = {};
  const api = join(ROOT, "src/api");
  for (const entry of readdirSync(api, { withFileTypes: true })) {
    const file = entry.isDirectory() ? join(api, entry.name, "api.js") : join(api, entry.name);
    const module = entry.isDirectory() ? entry.name : entry.name.replace(/\.js$/, "");
    if (file.endsWith(".js") && !file.endsWith("createClient.js") && existsSync(file)) catalog[module] = catalogOf(readFileSync(file, "utf8"));
  }
  return catalog;
}

function endpointsOf(imports, catalog, schema, unmatched) {
  return imports.flatMap(({ name, module }) => {
    if (!catalog[module]) unmatched.set(`${module}.${name}`, "module not read by the audit (no src/api/<module>/api.js)");
    const call = catalog[module]?.[name];
    if (!call) return [];
    const apiPath = matchPath(call.path, call.method, schema);
    if (!apiPath) {
      unmatched.set(`${module}.${name}`, `${call.method.toUpperCase()} ${call.path}`);
      return [];
    }
    return [{ name, method: call.method, apiPath }];
  });
}

/** Field names a model path can land on: its last segment and its payload keys; [] for a dynamic path. */
/**
 * Field names a model path can land on: its last segment and its payload keys; [] for a dynamic path. A display
 * fallback (`x || ''`, `x ?? '—'`) is dropped, a per-key dict (`form.name_t9n[lang]`) is its own field, and a getter
 * called with a field name (`getDirtyField(key, 'value', …)`) edits that field.
 */
export function candidateNames(input) {
  if (!input.model) return [];
  const literalArg = input.model.match(/^\w+\([^"'`]*["'](\w+)["']/)?.[1];
  if (literalArg) return [literalArg];
  let path = input.model.replace(/\s*(\|\||\?\?).*$/, "").replace(/\[\s*["'](\w+)["']\s*\]/g, ".$1");
  if (/^[\w.]+\.\w+(\[[\w.]+\])+$/.test(path)) path = path.replace(/\[.*$/, "");
  if (/[[`(]/.test(path)) return [];
  const last = path.split(".").pop();
  return /^\w+$/.test(last) ? [...new Set([last, ...input.payloadKeys])] : [];
}

const constraintKey = (c) =>
  JSON.stringify(Object.entries(c).filter(([k]) => !IGNORED_KEYS.has(k)).sort(([a], [b]) => a.localeCompare(b)));

function matchesIn(endpoints, names, schema) {
  const hits = endpoints.flatMap((ep) =>
    operationFields(schema, ep.apiPath, ep.method)
      .filter((field) => names.includes(field.name))
      .map((field) => ({ endpoint: `${ep.method.toUpperCase()} ${ep.apiPath}`, via: ep.name, ...field })),
  );
  const topLevel = hits.filter((hit) => hit.path === hit.name);
  return topLevel.length ? topLevel : hits;
}

const resourceOf = (hit) => `${hit.endpoint.split(" ")[1].replace(/\{[^}]+\}\/$/, "")} ${hit.path}`;

/** POST and PATCH of one resource are one field: their constraints merge, the create side (listed first) wins. */
function mergeResource(hits) {
  const merged = new Map();
  for (const hit of hits) {
    const seen = merged.get(resourceOf(hit));
    merged.set(resourceOf(hit), seen ? { ...seen, constraint: { ...hit.constraint, ...seen.constraint } } : hit);
  }
  return [...merged.values()];
}

function verdictOf(hits, scope) {
  const endpoints = [...new Set(hits.map((hit) => `${hit.endpoint} → ${hit.path}`))];
  const fields = mergeResource(hits);
  if (new Set(fields.map((hit) => constraintKey(hit.constraint))).size > 1) {
    return { status: "unresolved", kind: "ambiguous", scope, reason: "candidate fields disagree", candidates: endpoints };
  }
  return { status: "resolved", scope, field: fields[0].path, endpoints, api: fields[0].constraint };
}

function unjoinable(input) {
  if (!input.model) return { kind: "no model", reason: "no v-model or value binding" };
  if (PASS_THROUGH.test(input.model)) return { kind: "pass-through", reason: `wrapper input bound to its own ${input.model}` };
  return { kind: "dynamic path", reason: `dynamic model path ${input.model}` };
}

// Only the file's own write calls explain a miss: an upload or recompute action elsewhere in the panel never does.
function missReason(input, tiers, names, schema) {
  const tried = tiers.reduce((n, [, endpoints]) => n + endpoints.length, 0);
  if (!tried) return { kind: "no API call", reason: "no API call imported by the file or its panel" };
  if (isFlagOn(input.constraints.readonly)) return { kind: "read-only", reason: `read-only display, no field ${names.join("/")}` };
  const bare = tiers[0][1].filter((ep) => !operationFields(schema, ep.apiPath, ep.method).length);
  if (bare.length) {
    const calls = [...new Set(bare.map((ep) => `${ep.method.toUpperCase()} ${ep.apiPath}`))];
    return { kind: "undocumented body", reason: `no field ${names.join("/")}; the schema documents no request body for ${calls.join(", ")}`, calls };
  }
  return { kind: "no field", reason: `no field ${names.join("/")} in ${tried} imported calls` };
}

function joinInput(input, tiers, schema) {
  const names = candidateNames(input);
  if (!names.length || PASS_THROUGH.test(input.model)) return { status: "unresolved", ...unjoinable(input) };
  for (const [scope, endpoints] of tiers) {
    const hits = matchesIn(endpoints, names, schema);
    if (hits.length) return verdictOf(hits, scope);
  }
  return { status: "unresolved", ...missReason(input, tiers, names, schema) };
}

function tiersOf(file, panel) {
  const split = (eps) => [eps.filter((ep) => WRITES.has(ep.method)), eps.filter((ep) => ep.method === "get")];
  const [fileWrite, fileRead] = split(file);
  const [panelWrite, panelRead] = split(panel);
  return [["file", fileWrite], ["panel", panelWrite], ["file query", fileRead], ["panel query", panelRead]];
}

function labelText(input) {
  const label = [input.label, input.placeholder, input.ariaLabel].find((l) => l && (l.text || l.key || l.expr));
  if (!label) return null;
  return label.text || label.key || `{${label.expr}}`;
}

function record(file, panel, input, join, required) {
  const field = join.field || candidateNames(input)[0];
  const cls = classify(input, field, join.api);
  const last = candidateNames(input)[0];
  return {
    panel, file, line: input.line, component: input.component, label: labelText(input), labelKey: input.label?.key || null,
    model: input.model, cms: { ...input.constraints, required: input.required || required.includes(last), serverErrors: input.serverErrors },
    join, class: cls, mismatches: mismatches(input, cls, join.api), proposed: PROPOSED[cls],
  };
}

function scanFiles(messages) {
  return SCANNED.flatMap((dir) => vueFiles(join(ROOT, dir))).map((path) => {
    const source = readFileSync(path, "utf8");
    const file = relative(ROOT, path);
    return { file, panel: panelOf(file), ...extractInputs(source, messages) };
  });
}

/** The whole audit: { inputs, unmatchedEndpoints }. */
export function audit(schema) {
  const messages = JSON.parse(readFileSync(join(ROOT, "src/i18n/locales/en.json"), "utf8"));
  const catalog = apiCatalog();
  const unmatched = new Map();
  const files = scanFiles(messages);
  const panelImports = {};
  for (const f of files) (panelImports[f.panel] ??= []).push(...f.imports);
  const inputs = files.flatMap((f) => {
    const tiers = tiersOf(endpointsOf(f.imports, catalog, schema, unmatched), endpointsOf(panelImports[f.panel], catalog, schema, unmatched));
    return f.inputs.map((input) => record(f.file, f.panel, input, joinInput(input, tiers, schema), f.required));
  });
  return { inputs, unmatchedEndpoints: Object.fromEntries(unmatched) };
}

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  if (!out.schema || !out.out) throw new Error("usage: inputs.mjs --schema <url|file> --out <json> [--report <md>]");
  return out;
}

async function loadSchema(source) {
  if (!/^https?:/.test(source)) return JSON.parse(readFileSync(source, "utf8"));
  const response = await fetch(source);
  if (!response.ok) throw new Error(`schema ${source}: HTTP ${response.status}`);
  return response.json();
}

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const schema = await loadSchema(args.schema);
  const result = { schema: args.schema, openapi: schema.openapi, ...audit(schema) };
  write(args.out, `${JSON.stringify(result, null, 2)}\n`);
  if (args.report) write(args.report, renderReport(result));
  const resolved = result.inputs.filter((i) => i.join.status === "resolved").length;
  console.log(`${result.inputs.length} inputs, ${resolved} joined, ${result.inputs.length - resolved} unresolved → ${args.out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
