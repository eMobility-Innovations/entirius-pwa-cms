#!/usr/bin/env node
// Layer 2 input: named landmark boxes per Figma frame S1–S10, relative to the frame.
// Usage: node tests/visual/scripts/figma-landmarks.mjs <cms.json> [out.json]
// Reads the frozen Figma node JSON of the CMS page; writes tests/visual/figma/figma-landmarks.json by default.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "figma", "figma-landmarks.json");

// Screen map (roadmap sources/extracted/screen-map.md): S-id → frame node, viewport.
const FRAMES = {
  S1: { node: "36:1707", viewport: "desktop" },
  S2: { node: "46:4073", viewport: "mobile" },
  S3: { node: "46:4237", viewport: "mobile" },
  S4: { node: "38:2999", viewport: "desktop" },
  S5: { node: "46:4665", viewport: "mobile" },
  S6: { node: "46:6008", viewport: "desktop" },
  S7: { node: "52:516", viewport: "mobile" },
  S8: { node: "52:1746", viewport: "mobile" },
  S9: { node: "52:2139", viewport: "desktop" },
  S10: { node: "53:3270", viewport: "mobile" },
};

// Landmark id → predicate over a visible node (box relative to the frame, depth 1 = direct child).
// First match in document order wins. The code marks the same element with data-fid="<id>" (P3/P4).
const LANDMARKS = {
  header: (n, box, depth) => depth === 1 && n.name === "nav",
  logo: (n) => n.name === "Logo cms",
  "user-button": (n, box) => n.type === "INSTANCE" && n.name === "Button" && box.y < 88,
  sidebar: (n, box) => n.name === "Nav" && box.width === 300,
  content: (n, box, depth) => depth === 2 && n.name === "Container" && box.x === 300,
  "page-title": (n) => n.name.startsWith("Heading") && hasTitleText(n),
  "panel-card": (n) => n.name.startsWith("Button - ") && n.cornerRadius === 24,
  "sticky-header": (n, box, depth) => depth === 1 && n.name === "Frame 51",
  "mobile-menu": (n, box, depth) => depth === 1 && n.name === "Nav" && box.height > 400,
  "tab-bar": (n, box, depth) => depth === 1 && n.name === "Nav" && box.height === 72,
  fab: (n) => n.name === "Button menu - Toggle menu",
};

const TITLE_MIN_FONT_SIZE = 20; // editor frames name the breadcrumbs "Heading 1" and the H1 "Heading 2"

function hasTitleText(node) {
  if (node.type === "TEXT") return (node.style?.fontSize || 0) >= TITLE_MIN_FONT_SIZE;
  return (node.children || []).some(hasTitleText);
}

const round = (value) => Math.round(value * 100) / 100;

function relativeBox(node, origin) {
  const { x, y, width, height } = node.absoluteBoundingBox;
  return { x: round(x - origin.x), y: round(y - origin.y), width: round(width), height: round(height) };
}

function* visibleNodes(node, origin, depth = 0) {
  for (const child of node.children || []) {
    if (child.visible === false || !child.absoluteBoundingBox) continue;
    yield { node: child, box: relativeBox(child, origin), depth: depth + 1 };
    yield* visibleNodes(child, origin, depth + 1);
  }
}

function frameLandmarks(frame) {
  const landmarks = {};
  for (const { node, box, depth } of visibleNodes(frame, frame.absoluteBoundingBox)) {
    for (const [id, matches] of Object.entries(LANDMARKS)) {
      if (landmarks[id] || !matches(node, box, depth)) continue;
      landmarks[id] = { ...box, radius: node.cornerRadius || 0, figmaNode: node.id, figmaName: node.name };
    }
  }
  return landmarks;
}

function main([source, out = OUT]) {
  if (!source) throw new Error("usage: figma-landmarks.mjs <cms.json> [out.json]");
  const figma = JSON.parse(readFileSync(source, "utf8"));
  const frames = new Map(figma.document.children.map((node) => [node.id, node]));
  const screens = {};
  for (const [screen, { node, viewport }] of Object.entries(FRAMES)) {
    const frame = frames.get(node);
    if (!frame) throw new Error(`frame ${node} (${screen}) not found in ${source}`);
    const { width, height } = frame.absoluteBoundingBox;
    screens[screen] = { node, viewport, width, height, landmarks: frameLandmarks(frame) };
  }
  writeFileSync(out, `${JSON.stringify({ tolerancePx: 2, screens }, null, 2)}\n`);
  console.log(`${Object.keys(screens).length} frames → ${out}`);
}

main(process.argv.slice(2));
