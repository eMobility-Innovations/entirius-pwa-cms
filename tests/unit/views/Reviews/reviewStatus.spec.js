import { describe, it, expect } from "vitest";

import {
  REVIEW_STATUSES,
  statusVariant,
  formatStars,
} from "@/views/Reviews/reviewStatus";

describe("reviewStatus", () => {
  it("maps every known status to a badge variant", () => {
    // The queue and the detail view share this map — an unmapped status would
    // render an empty badge instead of a readable state.
    for (const status of REVIEW_STATUSES) {
      expect(statusVariant(status)).toBeTruthy();
    }
    expect(statusVariant("accepted")).toBe("positive");
    expect(statusVariant("not_accepted")).toBe("negative");
  });

  it("falls back to neutral for an unknown status", () => {
    expect(statusVariant("something-new")).toBe("neutral");
  });

  it("renders stars with the numeric rate and a dash when unrated", () => {
    expect(formatStars(null)).toBe("—");
    expect(formatStars(5)).toBe("★★★★★ 5.0");
    expect(formatStars(3.4)).toBe("★★★☆☆ 3.4");
  });
});
