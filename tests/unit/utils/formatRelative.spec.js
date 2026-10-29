import { describe, it, expect, afterEach } from "vitest";
import { setLang } from "@/i18n";
import { formatRelative } from "@/utils/format";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const ago = (s) => new Date(NOW - s * 1000).toISOString();

describe("formatRelative", () => {
  afterEach(() => setLang("EN"));

  it("says how long ago in the UI language", () => {
    expect(formatRelative(ago(120), NOW)).toBe("2 min ago");
    expect(formatRelative(ago(3 * 3600), NOW)).toMatch(/^3 hr\.? ago$/);
    expect(formatRelative(ago(10), NOW)).toBe("now");
    setLang("PL");
    expect(formatRelative(ago(120), NOW)).toBe("2 min temu");
  });

  it("is empty for a missing or invalid date", () => {
    expect(formatRelative(null, NOW)).toBe("");
    expect(formatRelative("nope", NOW)).toBe("");
  });
});
