// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { ROOT, runCodemod, templateErrors } from "../../../scripts/codemods/p3-lib.mjs";

describe("p3-lib runCodemod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("reports a missing named file as one ERROR line and exits 1, without a stack trace", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    runCodemod("test", () => ({ edits: [], flags: [] }), ["src/does-not-exist.vue"]);
    const lines = log.mock.calls.map(([line]) => line);
    expect(lines[0]).toMatch(/^src\/does-not-exist\.vue {2}ERROR ENOENT/);
    expect(lines.join("\n")).not.toMatch(/\n\s+at /);
    expect(process.exitCode).toBe(1);
  });

  it("resolves ROOT to a plain path (no URL escapes)", () => {
    expect(ROOT).not.toMatch(/%[0-9A-F]{2}/);
    expect(ROOT.endsWith("/")).toBe(true);
  });

  it("counts broken markup as a template error, a self-closing component not", () => {
    expect(templateErrors("<template><div><StatusBadge label=\"x\" /></div></template>")).toBe(0);
    expect(templateErrors("<template><div a=\"b\"c></div></template>")).toBe(1);
  });
});
