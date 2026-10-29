import { describe, it, expect, afterEach } from "vitest";
import { setLang, uiLocale } from "@/i18n";
import { formatDate, formatDay } from "@/utils/format";
import { numberLocale } from "@/utils/taxRate";

const ISO = "2026-09-26T10:05:00+02:00";
// What the order views rendered before they shared `formatDate`.
const FORMER_PL = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };
const inWarsaw = (locale, options) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "Europe/Warsaw" });

// Dates and numbers follow the UI language, never the browser locale.
describe("UI locale", () => {
  afterEach(() => setLang("EN"));

  it.each([
    ["EN", "en-GB"],
    ["PL", "pl-PL"],
    ["DE", "en-GB"],
  ])("%s formats as %s", (lang, locale) => {
    setLang(lang);
    expect(uiLocale()).toBe(locale);
    expect(numberLocale()).toBe(locale);
  });

  it("formatDate under PL equals the former pl-PL two-digit string", () => {
    setLang("PL");
    const former = new Date(ISO).toLocaleDateString("pl-PL", { ...FORMER_PL, timeZone: "Europe/Warsaw" });
    expect(former).toBe("26.09.2026, 10:05");
    expect(formatDate(ISO, { timeZone: "Europe/Warsaw" })).toBe(former);
  });

  it("formatDate under EN is the en-GB short date and time, whatever the browser locale", () => {
    const short = { dateStyle: "short", timeStyle: "short" };
    expect(formatDate(ISO, { timeZone: "Europe/Warsaw" })).toBe(inWarsaw("en-GB", short).format(new Date(ISO)));
    expect(formatDate(ISO, { timeZone: "Europe/Warsaw" })).toContain("26/09/2026");
  });

  it("formatDay is the short date of the UI language", () => {
    const day = "2026-09-26T12:00:00Z";
    expect(formatDay(day)).toBe("26/09/2026");
    setLang("PL");
    expect(formatDay(day)).toBe("26.09.2026");
  });

  it.each([null, undefined, "", "not a date"])("an empty or invalid value (%j) formats as an empty string", (value) => {
    expect(formatDate(value)).toBe("");
    expect(formatDay(value)).toBe("");
  });
});
