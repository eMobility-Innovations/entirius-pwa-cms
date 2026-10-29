#!/usr/bin/env node
// P2 scale codemod: spacing, radius and type move onto the brand scales under the brand names (r01, plan 08).
// Passes run in order, radius first: `.br-50`, `.br-100` and `border-radius: var(--space-50)` are radii taken from
// the spacing map, so they move to the radius scale before the spacing rename could turn them into spacing again.
//   1. radius   var(--radius-sm|md), radius var(--space-50|100), .br-<n> / .radius-<name> classes → rounded-*
//   2. spacing  --space-50…700 and the p/m/gap class families → brand step numbers (space-1 = 4 px …)
//   3. weight   .fw-100 → .fw-300, .fw-700 → .fw-600 (Inter carries 300–600 in the CMS)
//   4. raw      margin/padding/gap, border-radius, font-size and font-weight values in CSS (style blocks, .scss,
//               static style="") → tokens; off-grid values snap to the nearest step (ties round down, r01 names
//               the exceptions); 1–3 px hairlines, negatives, % and out-of-range values stay raw and are listed;
//               em values are relative and skipped. <script> is never touched (mail HTML in template literals).
// Usage: node scripts/codemods/p2-scales.mjs [--write | --check]
//   (none)   dry run: report every rewrite, every snap and every value left raw
//   --write  apply the rewrites
//   --check  exit 1 while anything is left to rewrite
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const SCSS = join(SRC, "assets/scss");
// Token definitions and third-party icon fonts: the generators are rewritten by hand.
const SKIP = ["themes", "variables", "main.scss", "typo/font-icons", "typo/wysiwyg-icons"].map((p) => join(SCSS, p));
const EXTENSIONS = /\.(vue|scss|css|js)$/;

const SPACE = { 50: 1, 100: 2, 200: 5, 300: 8, 400: 10, 500: 12, 600: 16, 700: 30 };
const SPACE_STEPS = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 120]; // px of --space-0 … --space-30
const RADIUS_CLASS = { 50: "", 25: "", sm: "", md: "", base: "", 100: "-lg", lg: "-lg" };
const RADIUS_RAW = {
  "2px": "base", "3px": "base", "4px": "base", "5px": "base", "6px": "base", "8px": "lg", "9px": "lg",
  "10px": "xl", "11px": "xl", "12px": "xl", "0.125rem": "base", "0.75rem": "xl", "1rem": "2xl", "50%": "full", "50px": "full",
  "999px": "full",
};
const FONT_SIZES = { 10: 100, 11: 150, 12: 200, 13: 250, 14: 300, 16: 400, 20: 500, 24: 600, 30: 700 };
const OLD_FS_500 = 18; // the old --fs-500: raw 18 px follows it to 20, not down to 16
const FS_MAX = 32; // the deleted --fs-800 snaps to 30; larger sizes are icon glyphs
const FONT_WEIGHT = { 100: "300", 200: "300", 700: "600", 800: "600", 900: "600", bold: "600" };

const RADIUS_VAR_RE = /var\(--(space-(?:50|100)|radius-(?:sm|md))\)/g;
const RADIUS_CLASS_RE = /(?<![\w$-])(?:br|radius)-(?:(tl|tr|bl|br)-)?(50|25|100|sm|md|lg|base|xl|2xl|3xl|4xl|full)(?![\w-])/g;
const SPACE_VAR_RE = /--space-(50|100|200|300|400|500|600|700)(?![\w-])/g;
const SPACE_CLASS_RE = /(?<![\w$-])(p|pt|pr|pb|pl|pv|ph|m|mt|mr|mb|ml|mv|mh|gap)-(50|100|200|300|400|500|600|700)(?![\w-])/g;
const WEIGHT_CLASS_RE = /(?<![\w-])fw-(100|700)(?![\w-])/g;
const DECLARATION_RE =
  /(?<![\w$@.#-])((?:margin|padding)(?:-[a-z]+){0,2}|gap|row-gap|column-gap|border(?:-[a-z]+-[a-z]+)?-radius|font-size|font-weight)(\s*:\s*)([^;{}"\n]+)/g;
const NUMBER_RE = /^(-?)(\d*\.?\d+)(px|rem|%)$/;

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (SKIP.includes(path)) continue;
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (entry.isFile() && EXTENSIONS.test(entry.name)) yield path;
  }
}

// The property whose value holds offset i: the last `name:` since the previous `;`, `{` or `}`.
function propertyAt(text, i) {
  const start = Math.max(text.lastIndexOf(";", i), text.lastIndexOf("{", i), text.lastIndexOf("}", i));
  return text.slice(start + 1, i).match(/([\w-]+)\s*:[^:]*$/)?.[1] ?? "";
}

// The selector of the rule block around offset i (text between the previous block edge and its `{`).
function selectorAt(text, i) {
  const open = text.lastIndexOf("{", i);
  const start = Math.max(text.lastIndexOf("}", open), text.lastIndexOf(";", open));
  return text.slice(start + 1, open);
}

function radiusVar(text, offset, [name]) {
  if (name.startsWith("radius-")) return "var(--radius-base)";
  if (!/radius$/.test(propertyAt(text, offset))) return null; // a spacing use: pass 2 renames it
  return name === "space-50" ? "var(--radius-base)" : "var(--radius-lg)";
}

function radiusClass(corner, name) {
  const size = RADIUS_CLASS[name] ?? `-${name}`;
  return `rounded${corner ? `-${corner}` : ""}${size}`;
}

// ---- raw values ------------------------------------------------------------------------------------------------

const px = (number, unit) => (unit === "rem" ? number * 16 : number);

// Nearest entry of `steps` (sorted), ties to the smaller one.
function nearest(value, steps) {
  return steps.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best));
}

function spacingValue(token, [sign, number, unit], selector, property) {
  if (unit === "%") return { keep: "percentage" };
  const value = px(Number(number), unit);
  if (sign) return { keep: "negative offset" };
  if (value <= 3) return { keep: "hairline (1–3 px)" };
  if (value > 120) return { keep: "above the scale" };
  const step = value === 6 && property === "gap" && /btn|button/i.test(selector) ? 8 : nearest(value, SPACE_STEPS);
  return { value: `var(--space-${step / 4})`, snap: step !== value };
}

function radiusValue(token) {
  const name = RADIUS_RAW[token];
  return name ? { value: `var(--radius-${name})`, snap: !["4px", "8px", "12px", "1rem", "999px"].includes(token) } : { keep: "no radius step" };
}

function fontSizeValue(token, [sign, number, unit]) {
  const value = px(Number(number), unit);
  if (sign || unit === "%" || value < 10 || value > FS_MAX) return { keep: "outside the type scale" };
  const size = value === OLD_FS_500 ? 20 : nearest(value, Object.keys(FONT_SIZES).map(Number));
  return { value: `var(--fs-${FONT_SIZES[size]})`, snap: size !== value };
}

function tokenValue(token, property, selector) {
  if (property === "font-weight") return FONT_WEIGHT[token] ? { value: FONT_WEIGHT[token], snap: true } : null;
  const number = token.match(NUMBER_RE);
  if (!number || Number(number[2]) === 0) return null;
  if (property.endsWith("radius")) return radiusValue(token);
  if (property === "font-size") return fontSizeValue(token, number.slice(1));
  return spacingValue(token, number.slice(1), selector, property);
}

// Rewrites the top-level tokens of a declaration value (tokens inside calc()/var() are left alone).
function rewriteValue(value, property, selector, found) {
  let depth = 0;
  return value.replace(/[()]|[^\s()]+/g, (token) => {
    if (token === "(" || token === ")") depth += token === "(" ? 1 : -1;
    if (depth > 0) return token;
    const result = tokenValue(token, property, selector);
    if (result) found.push({ token, property, ...result });
    return result?.value ?? token;
  });
}

// ---- passes ----------------------------------------------------------------------------------------------------

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

function pass(text, re, rewrite, log) {
  return text.replace(re, (match, ...args) => {
    const offset = args.find((arg) => typeof arg === "number");
    const value = rewrite(text, offset, args.slice(0, args.indexOf(offset)));
    if (value && value !== match) log.rewrites.push({ line: lineOf(text, offset), match, value });
    return value ?? match;
  });
}

function declarations(text, offset, [property, colon, value], { log, lineBase }) {
  if (property === "font-weight" && /\s/.test(value.trim())) return `${property}${colon}${value}`; // @font-face range
  const found = [];
  const output = rewriteValue(value, property, selectorAt(text, offset), found);
  const line = lineBase + lineOf(text, offset) - 1;
  found.filter((f) => f.keep).forEach((f) => log.kept.push({ line, match: `${property}: ${f.token}`, reason: f.keep }));
  found.filter((f) => f.value).forEach((f) => (f.snap ? log.snaps : log.rewrites).push({ line, match: `${property}: ${f.token}`, value: f.value }));
  return `${property}${colon}${output}`;
}

// The CSS of a file: all of a .scss/.css, the <style> blocks and static style="" attributes of a .vue.
// <script> blocks match first and pass through: a style="" there is a string (mail HTML), not CMS CSS.
const CSS_PARTS = /<script[^>]*>[\s\S]*?<\/script>|(<style[^>]*>)([\s\S]*?)(<\/style>)|((?<![:\w-])style=")([^"]*)(")/g;

function rawValues(text, path, log) {
  const rewrite = (css, lineBase) =>
    css.replace(DECLARATION_RE, (m, ...args) => declarations(css, args[3], args.slice(0, 3), { log, lineBase }));
  if (!path.endsWith(".vue")) return path.endsWith(".js") ? text : rewrite(text, 1);
  return text.replace(CSS_PARTS, (m, open, body, close, attrOpen, attr, attrClose, offset) => {
    if (!open && !attrOpen) return m;
    const lineBase = lineOf(text, offset);
    return open ? `${open}${rewrite(body, lineBase)}${close}` : `${attrOpen}${rewrite(attr, lineBase)}${attrClose}`;
  });
}

function migrate(text, path) {
  const log = { rewrites: [], snaps: [], kept: [] };
  let output = pass(text, RADIUS_VAR_RE, radiusVar, log);
  output = pass(output, RADIUS_CLASS_RE, (t, o, [corner, name]) => radiusClass(corner, name), log);
  output = pass(output, SPACE_VAR_RE, (t, o, [n]) => `--space-${SPACE[n]}`, log);
  output = pass(output, SPACE_CLASS_RE, (t, o, [prefix, n]) => `${prefix}-${SPACE[n]}`, log);
  output = pass(output, WEIGHT_CLASS_RE, (t, o, [n]) => `fw-${n === "100" ? 300 : 600}`, log);
  return { output: rawValues(output, path, log), log };
}

function report(file, { rewrites, snaps, kept }, mode) {
  if (mode === "--check") return;
  rewrites.forEach((r) => console.log(`  ${file}:${r.line}  ${r.match} -> ${r.value}`));
  snaps.forEach((r) => console.log(`  SNAP ${file}:${r.line}  ${r.match} -> ${r.value}`));
  kept.forEach((k) => console.log(`  RAW ${file}:${k.line}  ${k.match}  (${k.reason})`));
}

function main(mode) {
  const totals = { files: 0, rewrites: 0, snaps: 0, kept: 0 };
  for (const path of sourceFiles(SRC)) {
    const text = readFileSync(path, "utf8");
    const { output, log } = migrate(text, path);
    if (!log.rewrites.length && !log.snaps.length && !log.kept.length) continue;
    report(relative(ROOT, path), log, mode);
    if (mode === "--write" && output !== text) writeFileSync(path, output);
    totals.files += 1;
    Object.keys(log).forEach((key) => (totals[key] += log[key].length));
  }
  const verb = mode === "--write" ? "rewritten" : "to rewrite";
  console.log(`\n${totals.rewrites} ${verb}, ${totals.snaps} snapped, ${totals.kept} left raw, in ${totals.files} files`);
  return mode === "--check" && totals.rewrites + totals.snaps > 0 ? 1 : 0;
}

process.exitCode = main(process.argv[2]);
