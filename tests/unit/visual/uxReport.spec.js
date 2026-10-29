import { describe, it, expect } from "vitest";
import { KINDS, screenReport, buildSummary } from "../../visual/support/ux-report";

const button = (role, height, paddingX = "16px") => ({ role, height, paddingX, radius: "4px", fontSize: "14px", border: "0px" });
const measured = (issues, buttons = []) => ({ issues, buttons, bottomBar: null });
const report = (screen, viewport, issues, buttons) =>
  screenReport({ screen, viewport, runId: "run-1", measured: measured(issues, buttons) });

describe("@ux report", () => {
  it("classifies broken actions as high and layout defects as medium", () => {
    const { issues, counts } = report("faq", "mobile", [{ kind: "zeroSize" }, { kind: "overlap" }, { kind: "overlap" }]);
    expect(issues.map((i) => i.severity)).toEqual(["high", "medium", "medium"]);
    expect(counts).toMatchObject({ zeroSize: 1, overlap: 2, tapTarget: 0 });
  });

  it("totals every kind for both viewports, even when nothing was found", () => {
    const summary = buildSummary([report("a", "desktop", [{ kind: "overflow" }]), report("a", "mobile", [])], "run-1");
    expect(Object.keys(summary.totals)).toEqual(KINDS);
    expect(summary.totals.overflow).toEqual({ desktop: 1, mobile: 0 });
    expect(summary.totals.underBottomBar).toEqual({ desktop: 0, mobile: 0 });
    expect(Object.keys(summary.screens)).toEqual(["a__desktop", "a__mobile"]);
  });

  it("lists distinct button metrics per role, sorted", () => {
    const buttons = [button("primary", 36), button("primary", 31), button("primary", 36, "32px"), button("danger", 0)];
    const { buttonMetrics } = buildSummary([report("a", "desktop", [], buttons)], "run-1");
    expect(buttonMetrics.primary.height).toEqual([31, 36]);
    expect(buttonMetrics.primary.paddingX).toEqual(["16px", "32px"]);
    expect(Object.keys(buttonMetrics)).toEqual(["danger", "primary"]);
  });

  it("counts on how many screens each label style and card padding appears", () => {
    const labelled = (style) => ({ style, text: "Nazwa" });
    const a = { ...measured([]), labels: [labelled("12px 600"), labelled("12px 600")], cards: [{ padding: "24px" }] };
    const b = { ...measured([]), labels: [labelled("12px 500")], cards: [{ padding: "24px" }] };
    const reports = [a, b].map((m, i) => screenReport({ screen: `s${i}`, viewport: "desktop", runId: "run-1", measured: m }));
    const { labelStyles, cardPaddings } = buildSummary(reports, "run-1");
    expect(labelStyles).toEqual({ "12px 500": { desktop: 1, mobile: 0 }, "12px 600": { desktop: 1, mobile: 0 } });
    expect(cardPaddings).toEqual({ "24px": { desktop: 2, mobile: 0 } });
  });

  it("records a screen that did not open under errors, with zero counts", () => {
    const failed = screenReport({ screen: "b", viewport: "mobile", runId: "run-1", measured: { error: "INFRA: down" } });
    const summary = buildSummary([failed], "run-1");
    expect(summary.errors).toEqual({ b__mobile: "INFRA: down" });
    expect(summary.totals.zeroSize.mobile).toBe(0);
  });
});
