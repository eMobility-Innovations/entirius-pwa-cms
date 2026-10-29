import { describe, it, expect } from "vitest";
import { blockingIssues } from "../../visual/support/ux-allow";

const issue = (kind, selector, severity = "high") => ({ kind, selector, severity });
const report = (issues, screen = "pim-product", viewport = "mobile") => ({ screen, viewport, issues });
const entry = (fields) => ({ kind: "nonFocusable", selector: "div.dropdown-wrapper", reason: "r", owner: "P3 plan 15", ...fields });

describe("@ux guard allow-list", () => {
  it("blocks every high issue and never a medium one when the list is empty", () => {
    const issues = [issue("zeroSize", "button.a"), issue("overlap", "div.b", "medium")];
    expect(blockingIssues(report(issues), [])).toEqual([issues[0]]);
  });

  it("allows an issue of the entry's kind whose selector contains the entry's selector", () => {
    const issues = [issue("nonFocusable", "div.field > div.dropdown-wrapper"), issue("zeroSize", "div.dropdown-wrapper")];
    expect(blockingIssues(report(issues), [entry({ screen: "pim-product" })])).toEqual([issues[1]]);
  });

  it("matches the element itself, never an ancestor", () => {
    const issues = [issue("nonFocusable", "div.dropdown-wrapper > span.chip")];
    expect(blockingIssues(report(issues), [entry({ screen: "*" })])).toEqual(issues);
  });

  it("matches the entry's screen ('*' = every screen) and viewport (omitted = both)", () => {
    const issues = [issue("nonFocusable", "div.dropdown-wrapper")];
    expect(blockingIssues(report(issues), [entry({ screen: "other" })])).toHaveLength(1);
    expect(blockingIssues(report(issues), [entry({ screen: "*" })])).toHaveLength(0);
    expect(blockingIssues(report(issues), [entry({ screen: "*", viewport: "desktop" })])).toHaveLength(1);
  });

  it("refuses an entry without an owning plan or a reason", () => {
    expect(() => blockingIssues(report([]), [entry({ screen: "*", owner: "" })])).toThrow(/owner/);
    expect(() => blockingIssues(report([]), [entry({ screen: "*", reason: undefined })])).toThrow(/reason/);
  });
});
