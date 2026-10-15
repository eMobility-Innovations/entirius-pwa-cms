import { describe, it, expect } from "vitest";
import { needsRefresh, opensDrawer, orderedCounts, taskStatusTone } from "@/views/EnrichmentReview/taskProgress";

describe("orderedCounts", () => {
  it("puts proposed and failed first", () => {
    expect(orderedCounts({ skipped: 2, failed: 1, proposed: 5 })).toEqual([
      ["proposed", 5],
      ["failed", 1],
      ["skipped", 2],
    ]);
    expect(orderedCounts(null)).toEqual([]);
  });
});

describe("needsRefresh", () => {
  it("while a task runs", () => {
    expect(needsRefresh([{ status: "done" }, { status: "in_progress" }])).toBe(true);
    expect(needsRefresh([{ status: "open" }, { status: "done" }])).toBe(false);
  });

  it("while a task waits in the queue", () => {
    expect(needsRefresh([{ status: "open", queued_ahead: 0 }])).toBe(true);
    expect(needsRefresh([{ status: "open", queued_ahead: null }])).toBe(false);
  });

  it("a single open task (just created) refreshes too", () => {
    expect(needsRefresh([{ status: "open" }], true)).toBe(true);
    expect(needsRefresh([{ status: "failed" }], true)).toBe(false);
  });
});

describe("taskStatusTone", () => {
  it("maps each task status to a badge tone, unknown ones to neutral", () => {
    expect(["open", "in_progress", "done", "failed", "cancelled", "weird"].map(taskStatusTone)).toEqual([
      "info", "warning", "positive", "negative", "neutral", "neutral",
    ]);
  });
});

describe("opensDrawer", () => {
  it("a run still going or failed opens its drawer; a done or cancelled one shows its proposals in place", () => {
    expect(["open", "in_progress", "failed", "done", "cancelled"].map((status) => opensDrawer({ status }))).toEqual([
      true, true, true, false, false,
    ]);
    expect(opensDrawer(null)).toBe(false);
  });
});
