#!/usr/bin/env node
// Proves the light theme's contrast rules (WCAG 2 relative luminance) over the final hex of each semantic role:
// semantic.json light mappings resolved through @entirius/brand-tokens brand.json.
// Prints a Markdown table; exits 1 when any pair is below its minimum.
// Usage: node scripts/tokens/contrast-light.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEMANTIC = new URL("../../src/assets/tokens/semantic.json", import.meta.url);
const BRAND = fileURLToPath(import.meta.resolve("@entirius/brand-tokens/tokens.json"));

// Every surface text sits on: the page, containers, table headers and tiles, hovered rows and nav, selected rows.
const TEXT_SURFACES = ["surface-page", "surface-base", "surface-raised", "surface-hover", "accent-subtle"];
const CONTROL_SURFACES = ["surface-sunken", "surface-base", "surface-page", "surface-raised", "surface-hover"];
const STATUS = ["positive", "negative", "warning", "info"];
const on = (fg, bgs, min) => bgs.map((bg) => [fg, bg, min]);

// [foreground role, background role, minimum ratio]
const RULES = [
  ...on("text-strong", TEXT_SURFACES, 7),
  ...on("text-body", TEXT_SURFACES, 7),
  ...on("text-secondary", TEXT_SURFACES, 4.5),
  ...on("text-muted", TEXT_SURFACES, 4.5),
  ...on("text-accent", TEXT_SURFACES, 4.5),
  ["text-on-accent-fill", "accent-fill", 4.5],
  ...STATUS.flatMap((status) => on(status, [...TEXT_SURFACES, `${status}-subtle`], 4.5)),
  ...on("border-control", CONTROL_SURFACES, 3),
];
// [hover role, resting role, minimum step]: a hover or focus edge must be darker than the resting one, never fainter.
const DARKER = [["border-strong", "border-control", 1.2]];

// "{light.neutral.150}" → "#F1F2F4", following references inside brand.json.
function resolver(brand) {
  const resolve = (value) => {
    const ref = String(value).match(/^\{(.+)\}$/);
    if (!ref) return value;
    const token = ref[1].split(".").reduce((node, key) => node?.[key], brand);
    if (token?.$value === undefined) throw new Error(`${value} is not a brand token`);
    return resolve(token.$value);
  };
  return resolve;
}

function lightRoles() {
  const map = JSON.parse(readFileSync(SEMANTIC, "utf8"));
  const resolve = resolver(JSON.parse(readFileSync(BRAND, "utf8")));
  const roles = Object.values(map.color).flatMap((group) => Object.entries(group));
  return Object.fromEntries(roles.map(([name, token]) => [name, resolve(token.light)]));
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((c) => parseInt(c, 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(fg, bg) {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function check() {
  const hex = lightRoles();
  const darker = ([fg, bg, min]) => ({ fg, bg, min, value: luminance(hex[fg]) < luminance(hex[bg]) ? ratio(hex[fg], hex[bg]) : 0 });
  const rows = [...RULES.map(([fg, bg, min]) => ({ fg, bg, min, value: ratio(hex[fg], hex[bg]) })), ...DARKER.map(darker)];
  const lines = rows.map(({ fg, bg, min, value }) =>
    `| ${fg} | ${hex[fg]} | ${bg} | ${hex[bg]} | ${value.toFixed(2)}:1 | ${min}:1 | ${value >= min ? "pass" : "FAIL"} |`
  );
  console.log(["| Foreground | Hex | Background | Hex | Ratio | Min | Result |", "|---|---|---|---|---|---|---|", ...lines].join("\n"));
  return rows.every(({ value, min }) => value >= min);
}

process.exitCode = check() ? 0 : 1;
