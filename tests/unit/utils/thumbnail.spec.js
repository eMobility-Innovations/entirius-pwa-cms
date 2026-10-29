import { describe, it, expect } from "vitest";
import { thumbnailOf } from "@/utils/thumbnail";

describe("thumbnailOf", () => {
  it("takes the smallest source at least twice the tile width", () => {
    const set = [
      { source: "l.jpg", width: 1920 },
      { source: "s.jpg", width: 200 },
      { source: "m.jpg", width: 400 },
    ];
    expect(thumbnailOf(set)).toBe("m.jpg");
  });

  it("falls back to the largest source when every one is small", () => {
    expect(thumbnailOf([{ source: "a.jpg", width: 100 }, { source: "b.jpg", width: 300 }])).toBe("b.jpg");
  });

  it("gives an empty source for an empty set (the tile placeholder)", () => {
    expect(thumbnailOf([])).toBe("");
    expect(thumbnailOf()).toBe("");
  });
});
