import { describe, it, expect } from "vitest";
import {
  costStopped, eventName, triesText, unitError, unitProgress, workerAlertText, workerAlerts,
} from "@/views/EnrichmentReview/workQueue";

describe("workQueue", () => {
  it("reads the batches of a run in plain words, leaving out the counts that are zero", () => {
    expect(unitProgress({ queued: 4, leased: 2, done: 12, failed: 2, cancelled: 0 })).toBe(
      "12 of 20 batches done · 4 waiting · 2 working · 2 failed"
    );
    expect(unitProgress({ queued: 0, leased: 0, done: 1, failed: 0, cancelled: 0 })).toBe("1 of 1 batch done");
    expect(unitProgress({ done: 3, cancelled: 2 })).toBe("3 of 5 batches done · 2 cancelled");
  });

  it("an older run without batches has no batch line", () => {
    expect(unitProgress(undefined)).toBe("");
    expect(unitProgress({ queued: 0, leased: 0, done: 0, failed: 0, cancelled: 0 })).toBe("");
  });

  it("knows a run its cost guard stopped", () => {
    expect(costStopped({ errors: [{ code: "COST_LIMIT", message: "Stopped" }] })).toBe(true);
    expect(costStopped({ errors: [{ code: "TIMEOUT" }] })).toBe(false);
    expect(costStopped(null)).toBe(false);
  });

  it("says why a batch failed: the CMS's words for a known code, else the worker's message, never the code", () => {
    expect(unitError({ code: "LEASE_EXPIRED", message: "lease expired" })).toBe("The worker stopped answering before it finished");
    expect(unitError({ code: "BUDGET_EXCEEDED", message: "x" })).toBe("The AI budget is used up");
    expect(unitError({ code: "SHOP_DOWN", message: "The shop did not answer" })).toBe("The shop did not answer");
    expect(unitError({ code: "SHOP_DOWN" })).toBe("The AI service reported an error");
    expect(unitError(null)).toBe("The AI service reported an error");
  });

  it("names queue events in plain words; one the CMS does not know reads as a queue update", () => {
    expect(eventName("claimed")).toBe("Picked up by a worker");
    expect(eventName("requeued")).toBe("Put back in the queue to try again");
    expect(eventName("something_new")).toBe("Queue update");
  });

  it("counts the tries", () => {
    expect(triesText(1)).toBe("after 1 try");
    expect(triesText(3)).toBe("after 3 tries");
  });

  it("raises a worker that is paused or has nobody taking its work, never a fine one", () => {
    const rows = [
      { key: "a", state: "running", nobody_taking: false },
      { key: "b", state: "paused", nobody_taking: false },
      { key: "c", state: "running", nobody_taking: true },
    ];
    expect(workerAlerts(rows).map((row) => row.key)).toEqual(["b", "c"]);
    expect(workerAlerts(undefined)).toEqual([]);
  });

  it("words a worker alert: the pause reason, or how much waits and for how long", () => {
    expect(workerAlertText({ label: "Product texts", state: "paused", paused_reason: "5 work units failed in a row." })).toBe(
      "Product texts is paused: 5 work units failed in a row."
    );
    expect(workerAlertText({ label: "Product texts", state: "running", nobody_taking: true, queued_units: 4, oldest_queued_age_s: 1200 })).toBe(
      "Nobody is taking Product texts work — 4 waiting for 20 min"
    );
    expect(workerAlertText({ label: "X", state: "running", queued_units: 1, oldest_queued_age_s: 5 })).toMatch(/for 1 min$/);
  });
});
