import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// The report folder is resolved when ux-report loads, so point it at a temp dir before the import.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ux-report-"));
const uxDir = path.join(dir, "ux");
let finishRun;
let writeScreenReport;

const measured = { issues: [], buttons: [], bottomBar: null };
const write = (runId, screen) => writeScreenReport({ runId, screen, viewport: "desktop", measured });
const files = (sub = "") => fs.readdirSync(path.join(uxDir, sub)).sort();
const summaryOf = (file) => JSON.parse(fs.readFileSync(path.join(uxDir, file), "utf8"));

describe("@ux finishRun (global teardown)", () => {
  beforeAll(async () => {
    process.env.VISUAL_REPORT_DIR = dir;
    ({ finishRun, writeScreenReport } = await import("../../visual/support/ux-report"));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.VISUAL_REPORT_DIR;
  });

  beforeEach(() => {
    fs.rmSync(uxDir, { recursive: true, force: true });
    fs.mkdirSync(uxDir, { recursive: true });
  });

  it("leaves the folder untouched when the run measured no @ux screen", () => {
    fs.writeFileSync(path.join(uxDir, "a__desktop.json"), "{}");
    expect(finishRun("parity-run", ["a__desktop"])).toEqual({ measured: false, full: false });
    expect(files()).toEqual(["a__desktop.json"]);
  });

  it("a full run replaces the report in ux/ and prunes every run folder", () => {
    write("partial", "a");
    ["a", "b"].forEach((screen) => write("full", screen));
    expect(finishRun("full", ["a__desktop", "b__desktop"])).toEqual({ measured: true, full: true });
    expect(files()).toEqual(["a__desktop.json", "b__desktop.json", "ux-summary.json"]);
    expect(Object.keys(summaryOf("ux-summary.json").screens)).toEqual(["a__desktop", "b__desktop"]);
  });

  it("a partial run keeps its own folder and never wipes the last full report", () => {
    ["a", "b"].forEach((screen) => write("full", screen));
    finishRun("full", ["a__desktop", "b__desktop"]);
    write("partial", "a");
    expect(finishRun("partial", ["a__desktop", "b__desktop"])).toEqual({ measured: true, full: false });
    expect(Object.keys(summaryOf("ux-summary.json").screens)).toEqual(["a__desktop", "b__desktop"]);
    expect(Object.keys(summaryOf("runs/partial/ux-summary.json").screens)).toEqual(["a__desktop"]);
  });

  it("a skipped screen counts towards a full run and lands under skipped, not screens", () => {
    write("full", "a");
    writeScreenReport({ runId: "full", screen: "b", viewport: "desktop", measured: { skipReason: "no data" } });
    expect(finishRun("full", ["a__desktop", "b__desktop"]).full).toBe(true);
    const summary = summaryOf("ux-summary.json");
    expect(Object.keys(summary.screens)).toEqual(["a__desktop"]);
    expect(summary.skipped).toEqual({ b__desktop: "no data" });
  });
});
