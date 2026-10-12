import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Every `v-html` in `src/` renders through `sanitizeHtml`, on the same line, unless its content is fixed at build
// time. A new sink of API data that skips the helper fails here.
const SRC = path.resolve(__dirname, "../../../src");
// Markdown files bundled with the app (`raw-loader`), rendered by `marked`.
const BUILD_TIME = ["views/Docs/index.vue"];

const vueFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(full);
    return entry.name.endsWith(".vue") ? [full] : [];
  });

const sinks = () =>
  vueFiles(SRC).flatMap((file) =>
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes('v-html="'))
      .map((line) => ({ file: path.relative(SRC, file), line: line.trim() }))
  );

describe("v-html audit", () => {
  it("every v-html of API data goes through sanitizeHtml", () => {
    const unsafe = sinks().filter(({ file, line }) => !BUILD_TIME.includes(file) && !line.includes('v-html="sanitizeHtml('));
    expect(unsafe).toEqual([]);
  });

  it("the build-time list names only files that still have a v-html", () => {
    const files = sinks().map(({ file }) => file);
    expect(BUILD_TIME.filter((file) => !files.includes(file))).toEqual([]);
  });
});
