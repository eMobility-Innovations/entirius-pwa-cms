#!/usr/bin/env node
// P2 colour codemod: every old palette use — var(--c-<colour>-<shade>) and the t-/bg-/b-/bb-/bt-/bl-/br-/o-/stroke-
// utility classes — moves to the semantic layer by the role the use plays, never by the shade number.
// Role: the CSS property of the declaration (var) or the class prefix (class). Map: p2-colour-map.json (r01).
// `basic-100` as text is decided by the fill next to it (class string / rule block); a class is written only when
// the semantic layer generates it. Whatever the rules cannot decide is listed as undecided and left for a person.
// Usage: node scripts/codemods/p2-colours.mjs [--write | --check]
//   (none)   dry run: report every rewrite and every undecided use
//   --write  apply the rewrites
//   --check  exit 1 while anything is left to rewrite or decide
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const SKIP_DIRS = [join(SRC, "assets/scss/themes")];
const EXTENSIONS = /\.(vue|scss|css|js)$/;
const MAP = JSON.parse(readFileSync(new URL("p2-colour-map.json", import.meta.url), "utf8")).color;
const PALETTE = "basic|support|primary|positive|negative|warning|informative|notice";
const VAR_RE = new RegExp(`var\\(--c-((?:${PALETTE})-\\d+)\\b`, "g");
const CLASS_RE = new RegExp(`(?<![\\w-])(t|bg|b|bb|bt|bl|br|o|stroke)-((?:${PALETTE})-\\d+)(-hover)?(?![\\w-])`, "g");
const CLASS_ROLES = { t: "text", bg: "surface", b: "border", bb: "border", bt: "border", bl: "border", br: "border", o: "border", stroke: "text" };
const BORDER_SIDES = ["bb", "bt", "bl", "br"];
const PROPERTY_ROLES = [
  [/^(color|fill|stroke|caret-color|-webkit-text-fill-color|text-decoration-color)$/, "text"],
  [/^background/, "surface"],
  [/^(border|outline|column-rule)/, "border"],
  [/^box-shadow$/, "shadow"],
  [/^accent-color$/, "other:accent-color"],
];
// What `basic-100` text sits on → its token, by the fill's old or semantic name (a re-run after a partial write
// reads the semantic one). Tints (`-100`, `-subtle`) are not fills: text on them stays undecided.
const FILLS = [
  [/(bg-|--c-)(support-[34]00|primary-[12]00)\b|(bg-|--)accent-fill\b/, "text-on-accent-fill"],
  [/(bg-|--c-)(positive|negative|warning|informative)-[23]00\b|(bg-|--)(positive|negative|warning|info)-fill\b/, "text-on-status-fill"],
  [/(bg-|--c-)basic-[6-9]00\b|(bg-|--surface-)inverse\b/, "text-inverse"],
];

function semanticClasses() {
  const scss = readFileSync(join(SRC, "assets/scss/themes/_semantic.generated.scss"), "utf8");
  const rows = scss.matchAll(/"([\w-]+)": \(name: "([\w-]+)", families: ([\w ]+), hover: (true|false)/g);
  return new Map([...rows].map(([, token, name, families, hover]) => [token, { name, families: families.split(" "), hover: hover === "true" }]));
}
const CLASSES = semanticClasses();

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !SKIP_DIRS.includes(path)) yield* sourceFiles(path);
    else if (entry.isFile() && EXTENSIONS.test(entry.name)) yield path;
  }
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// The property whose value holds offset i: the last `name:` since the previous `;`, `{` or `}`.
function propertyAt(text, i) {
  const start = Math.max(text.lastIndexOf(";", i), text.lastIndexOf("{", i), text.lastIndexOf("}", i));
  const match = text.slice(start + 1, i).match(/([\w-]+)\s*:[^:]*$/);
  return match ? kebab(match[1]) : null;
}

const roleOfProperty = (property) => PROPERTY_ROLES.find(([re]) => re.test(property ?? ""))?.[1] ?? null;

// The background values of the rule block around offset i (between the enclosing braces, comments dropped).
function backgroundsAt(text, i) {
  const end = text.indexOf("}", i);
  const block = text.slice(text.lastIndexOf("{", i) + 1, end < 0 ? text.length : end).replace(/\/\/.*$/gm, "");
  return [...block.matchAll(/background(?:-color)?\s*:([^;]+)/g)].map((m) => m[1]).join(" ");
}

// The innermost quoted string holding offset i, then the whole start tag (class + :class of one element).
function classContexts(text, i) {
  const quote = Math.max(...["'", '"', "`"].map((q) => text.lastIndexOf(q, i)));
  const close = quote < 0 ? -1 : text.indexOf(text[quote], i);
  const string = close < 0 ? "" : text.slice(quote + 1, close);
  return [string, tagAt(text, i)];
}

function tagAt(text, i) {
  const start = text.lastIndexOf("<", i);
  let inValue = false;
  for (let j = start + 1; j < text.length; j += 1) {
    if (text[j] === '"') inValue = !inValue;
    else if (text[j] === ">" && !inValue) return text.slice(start, j);
  }
  return "";
}

// basic-100 as text: the one fill kind found in the narrowest context decides; none or two kinds → undecided.
function textOnFill(contexts) {
  for (const context of contexts) {
    const kinds = FILLS.filter(([re]) => re.test(context)).map(([, token]) => token);
    if (kinds.length === 1) return { token: kinds[0] };
    if (kinds.length > 1) return { reason: `sits on several fills (${kinds.join(", ")})` };
  }
  return { reason: "text with no fill next to it: read the background" };
}

function tokenFor(old, role, contexts) {
  if (!role) return { reason: "no colour role (not a colour property / attribute)" };
  if (old === "basic-100" && role === "text") return textOnFill(contexts);
  const token = MAP[old]?.[role];
  return token ? { token } : { reason: `no ${role} target for ${old} in the map` };
}

// A semantic class exists only for the families (t/bg/b) and hover variants the generator emits.
function classFor(prefix, token, hover) {
  const entry = CLASSES.get(token);
  const family = BORDER_SIDES.includes(prefix) ? "b" : prefix;
  if (!entry?.families.includes(family)) return null;
  if (hover && (!entry.hover || family !== prefix)) return null;
  return `${prefix}-${entry.name}${hover ? "-hover" : ""}`;
}

function rewriteVar(text, offset, old) {
  const role = roleOfProperty(propertyAt(text, offset));
  const decided = tokenFor(old, role, [backgroundsAt(text, offset)]);
  return decided.token ? { value: `var(--${decided.token}` } : decided;
}

function rewriteClass(text, offset, [prefix, old, hover]) {
  const decided = tokenFor(old, CLASS_ROLES[prefix], classContexts(text, offset));
  if (!decided.token) return decided;
  const value = classFor(prefix, decided.token, Boolean(hover));
  return value ? { value } : { reason: `${decided.token} has no ${prefix}-${hover ? " -hover" : ""} class` };
}

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

function pass(text, re, rewrite, log) {
  return text.replace(re, (match, ...args) => {
    const offset = args.at(-2);
    const result = rewrite(text, offset, args.slice(0, -2));
    const line = lineOf(text, offset);
    if (!result.value) log.undecided.push({ line, match, reason: result.reason });
    else log.rewrites.push({ line, match, value: result.value });
    return result.value ?? match;
  });
}

function migrate(text) {
  const log = { rewrites: [], undecided: [] };
  const vars = pass(text, VAR_RE, (t, offset, [old]) => rewriteVar(t, offset, old), log);
  const output = pass(vars, CLASS_RE, (t, offset, groups) => rewriteClass(t, offset, groups), log);
  return { output, log };
}

function report(file, { rewrites, undecided }) {
  rewrites.forEach((r) => console.log(`  ${file}:${r.line}  ${r.match} -> ${r.value}`));
  undecided.forEach((u) => console.log(`  UNDECIDED ${file}:${u.line}  ${u.match}  (${u.reason})`));
}

function main(mode) {
  const totals = { files: 0, rewrites: 0, undecided: 0 };
  for (const path of sourceFiles(SRC)) {
    const text = readFileSync(path, "utf8");
    const { output, log } = migrate(text);
    if (!log.rewrites.length && !log.undecided.length) continue;
    report(relative(ROOT, path), log);
    if (mode === "--write" && output !== text) writeFileSync(path, output);
    totals.files += 1;
    totals.rewrites += log.rewrites.length;
    totals.undecided += log.undecided.length;
  }
  const verb = mode === "--write" ? "rewritten" : "to rewrite";
  console.log(`\n${totals.rewrites} ${verb}, ${totals.undecided} undecided, in ${totals.files} files`);
  return mode === "--check" && totals.rewrites + totals.undecided > 0 ? 1 : 0;
}

process.exitCode = main(process.argv[2]);
