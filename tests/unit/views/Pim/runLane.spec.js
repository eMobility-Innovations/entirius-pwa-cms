import { describe, it, expect } from "vitest";
import { canRunNow, defaultLane, laneMessage, spawnToast } from "@/views/Pim/components/enrichment/runLane";

describe("runLane", () => {
  it("one product runs now, a selection goes to the queue", () => {
    expect(defaultLane(1)).toBe("now");
    expect(defaultLane(3)).toBe("queue");
  });

  it("Run now takes at most 20 products", () => {
    expect(canRunNow(20)).toBe(true);
    expect(canRunNow(21)).toBe(false);
  });

  it("says where the run went: running now, next in the queue, or how many runs wait before it", () => {
    expect(laneMessage({ lane: "now", queued_ahead: 0 })).toBe("Running now.");
    expect(laneMessage({ lane: "queue", queued_ahead: 0 })).toBe("Queued — starts next.");
    expect(laneMessage({ lane: "queue", queued_ahead: 1 })).toBe("Queued — 1 run ahead.");
    expect(laneMessage({ lane: "queue", queued_ahead: 2 })).toBe("Queued — 2 runs ahead.");
    expect(laneMessage({ lane: "now", queued_ahead: null })).toBe("Running now.");
  });

  it("the toast adds the products skipped because the same run is already going", () => {
    expect(spawnToast({ lane: "queue", queued_ahead: 2, skipped_in_flight: [] })).toEqual({
      type: "positive", msg: "Queued — 2 runs ahead.",
    });
    expect(spawnToast({ lane: "queue", queued_ahead: 0, skipped_in_flight: ["A", "B", "C"] })).toEqual({
      type: "informative", msg: "Queued — starts next. 3 products skipped, already running.",
    });
  });
});
