import { describe, it, expect, afterEach } from "vitest";
import { setLang } from "@/i18n";
import { rateToPercent, percentToRate, formatTaxRate } from "@/utils/taxRate";

describe("tax rate conversions", () => {
  afterEach(() => setLang("EN"));

  it("reads the stored fraction as percent", () => {
    expect(rateToPercent("0.2300")).toBe(23);
    expect(rateToPercent("0.0850")).toBe(8.5);
    expect(rateToPercent("0.0700")).toBe(7);
  });

  it("stores typed percent as a 4-place fraction", () => {
    expect(percentToRate(23)).toBe("0.2300");
    expect(percentToRate("8.5")).toBe("0.0850");
    expect(percentToRate(0)).toBe("0.0000");
  });

  it("rounds to two percent decimals both ways", () => {
    expect(percentToRate(8.555)).toBe("0.0856");
    expect(rateToPercent("0.12345")).toBe(12.35);
  });

  it("round-trips entry and display", () => {
    for (const percent of [0, 5, 8.5, 19, 23, 99.99]) {
      expect(rateToPercent(percentToRate(percent))).toBe(percent);
    }
  });

  it("formats percent with the UI language decimal mark", () => {
    setLang("PL");
    expect(formatTaxRate("0.2300")).toBe("23 %");
    expect(formatTaxRate("0.0850")).toBe("8,5 %");
    setLang("EN");
    expect(formatTaxRate("0.0850")).toBe("8.5 %");
  });

  it("shows nothing for a missing rate", () => {
    expect(rateToPercent(null)).toBeNull();
    expect(formatTaxRate("")).toBe("");
    expect(formatTaxRate("abc")).toBe("");
  });

  it("takes nothing that is not a number, never a silent zero", () => {
    for (const input of [".", "-", "", "  ", null, undefined, "abc", "1.2.3"]) {
      expect(percentToRate(input)).toBeNull();
    }
    expect(rateToPercent(".")).toBeNull();
  });
});
