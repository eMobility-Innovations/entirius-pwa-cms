import { describe, it, expect } from "vitest";
import { formatUsd } from "@/utils/format";

describe("formatUsd", () => {
  it("dollars with two decimals, a sub-cent cost as <$0.01", () => {
    expect(formatUsd("0.0800")).toBe("$0.08");
    expect(formatUsd(1.5)).toBe("$1.50");
    expect(formatUsd("0")).toBe("$0.00");
    expect(formatUsd("0.0042")).toBe("<$0.01");
  });

  it("an unknown cost is empty, never $0.00", () => {
    expect(formatUsd(null)).toBe("");
    expect(formatUsd(undefined)).toBe("");
    expect(formatUsd("")).toBe("");
    expect(formatUsd("n/a")).toBe("");
  });
});
