import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(ROOT, "scripts/tokens/build-theme.mjs");
const GENERATED = path.join(ROOT, "src/assets/scss/themes/_semantic.generated.scss");
const CONTRAST = path.join(ROOT, "scripts/tokens/contrast-light.mjs");

describe("semantic token layer", () => {
  it("the committed theme matches semantic.json (regenerate: node scripts/tokens/build-theme.mjs)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cms-semantic-"));
    try {
      const fresh = path.join(dir, "_semantic.generated.scss");
      execFileSync(process.execPath, [SCRIPT, fresh]);
      expect(readFileSync(GENERATED, "utf8")).toBe(readFileSync(fresh, "utf8"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("every light text/background and control-border pair meets its WCAG minimum (node scripts/tokens/contrast-light.mjs)", () => {
    const result = spawnSync(process.execPath, [CONTRAST], { encoding: "utf8" });
    const failing = result.stdout.split("\n").filter((row) => row.includes("| FAIL |"));
    expect(failing).toEqual([]);
    expect(result.status).toBe(0);
  });
});
