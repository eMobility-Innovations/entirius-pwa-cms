import { describe, it, expect, afterEach } from "vitest";
import { getLang, setLang } from "@/i18n";

// `<html lang>` follows the UI language: set at start-up and on every switch (screen readers pick the voice from it).
describe("document language", () => {
  const initial = getLang();
  afterEach(() => setLang(initial));

  it("is the UI language from the start", () => {
    expect(document.documentElement.getAttribute("lang")).toBe(initial.toLowerCase());
  });

  it("follows a switch", () => {
    setLang("pl");
    expect(document.documentElement.getAttribute("lang")).toBe("pl");
    setLang("EN");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
  });
});
