import { describe, it, expect } from "vitest";
import { withStoredOption } from "@/utils/options";

describe("withStoredOption", () => {
  const options = [{ label: "Translate", value: "translate" }];

  it("appends a stored value the options do not offer", () => {
    expect(withStoredOption(options, "lookup_link", "Link duplicate")).toEqual([
      ...options,
      { label: "Link duplicate", value: "lookup_link" },
    ]);
  });

  it("labels the appended option with the value by default", () => {
    expect(withStoredOption([], "duplicate_in_pim")).toEqual([
      { label: "duplicate_in_pim", value: "duplicate_in_pim" },
    ]);
  });

  it("keeps the options as they are when the value is offered or empty", () => {
    expect(withStoredOption(options, "translate")).toBe(options);
    expect(withStoredOption(options, "")).toBe(options);
    expect(withStoredOption(options, null)).toBe(options);
  });
});
