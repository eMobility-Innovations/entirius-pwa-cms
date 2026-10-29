import { describe, it, expect, afterEach } from "vitest";
import { setLang } from "@/i18n";
import { FORMATS, INT_MAX, displayFormat, formatError, gtinCheckDigit, parseFormat } from "@/utils/formats";

const check = (format, value, rules) => FORMATS[format].check(value, rules);

describe("formats", () => {
  afterEach(() => setLang("EN"));

  describe("money", () => {
    it.each([
      ["232", "232.00"],
      ["232,5", "232.50"],
      ["232.5", "232.50"],
      [" 1 234,56 ", "1234.56"],
      ["0232", "232.00"],
      ["0", "0.00"],
      [232, "232.00"],
    ])("parses %j as %j", (typed, model) => {
      expect(parseFormat("money", typed)).toBe(model);
    });

    it("never rounds: a third decimal place stays as typed and is an error", () => {
      expect(parseFormat("money", "2,345")).toBe("2.345");
      expect(check("money", "2.345")).toBe("formats.money");
    });

    it.each(["abc", "12.", ".5", "1.2.3", "12,5 zł", "12 5", "1 23 456", "1234 567"])("rejects %j", (typed) => {
      expect(check("money", typed)).toBe("formats.money");
    });

    it("keeps an inner space outside thousands groups as typed: 12 5 is never 125", () => {
      expect(parseFormat("money", "12 5")).toBe("12 5");
      expect(parseFormat("integer", "12 5")).toBe("12 5");
      expect(check("integer", "12 5")).toBe("formats.integer");
      expect(parseFormat("integer", "12 345 678")).toBe("12345678");
    });

    it("takes no negative amount unless the rules allow it; an unset rule keeps the limit", () => {
      expect(formatError("money", "-1.00")).toBe("Enter 0 or more");
      expect(formatError("money", "-1.00", { min: null, max: null })).toBe("Enter 0 or more");
      expect(formatError("money", "-1.00", { min: -100 })).toBe("");
    });

    it("shows the model with the UI language's decimal separator", () => {
      expect(displayFormat("money", "232.00")).toBe("232.00");
      expect(displayFormat("money", "232")).toBe("232.00");
      expect(displayFormat("money", "2.345")).toBe("2.345");
      setLang("PL");
      expect(displayFormat("money", "232.00")).toBe("232,00");
      expect(parseFormat("money", displayFormat("money", "232.00"))).toBe("232.00");
    });
  });

  describe("percent", () => {
    it("reads a comma, keeps the value, checks 0–100 with two places", () => {
      expect(parseFormat("percent", "8,5")).toBe("8.5");
      expect(parseFormat("percent", "23.00")).toBe("23");
      expect(check("percent", "8.5")).toBe("");
      expect(formatError("percent", "100.5")).toBe("Enter 100 or less");
      expect(formatError("percent", "-1")).toBe("Enter 0 or more");
      expect(check("percent", "8.555")).toBe("formats.percent");
    });

    it("shows the locale separator", () => {
      setLang("PL");
      expect(displayFormat("percent", "8.5")).toBe("8,5");
    });
  });

  describe("integer", () => {
    it("parses whole numbers and checks the range", () => {
      expect(parseFormat("integer", " 007 ")).toBe("7");
      expect(check("integer", "12")).toBe("");
      expect(check("integer", "1.5")).toBe("formats.integer");
      expect(check("integer", "0", { min: 1 })).toBe("formats.min");
      expect(check("integer", String(INT_MAX + 1), { max: INT_MAX })).toBe("formats.max");
    });
  });

  describe("ean", () => {
    it("computes the GS1 check digit", () => {
      expect(gtinCheckDigit("590123412345")).toBe(7);
      expect(gtinCheckDigit("9638507")).toBe(4);
    });

    it.each(["96385074", "036000291452", "5901234123457", "15901234123454"])("accepts the valid GTIN %s", (ean) => {
      expect(check("ean", ean)).toBe("");
    });

    it("strips spaces and dashes, keeps the digits", () => {
      expect(parseFormat("ean", "590 1234-123457")).toBe("5901234123457");
    });

    it("rejects a wrong length, letters and a wrong check digit", () => {
      expect(check("ean", "590123412345")).toBe("formats.ean_checksum");
      expect(check("ean", "5901234123")).toBe("formats.ean");
      expect(check("ean", "59012341234A7")).toBe("formats.ean");
      expect(check("ean", "5901234123458")).toBe("formats.ean_checksum");
    });
  });

  describe("code and key", () => {
    it("upper-cases a code and checks the API pattern", () => {
      expect(parseFormat("code", " new_lead ")).toBe("NEW_LEAD");
      expect(check("code", "NEW_LEAD", { pattern: "^[A-Z0-9_]+$" })).toBe("");
      expect(check("code", "NEW-LEAD", { pattern: "^[A-Z0-9_]+$" })).toBe("formats.code");
    });

    it("keeps a key as typed: no spaces, the pattern when there is one", () => {
      expect(parseFormat("key", " Summer-10 ")).toBe("Summer-10");
      expect(check("key", "1C01/N")).toBe("");
      expect(check("key", "summer sale")).toBe("formats.key");
      expect(check("key", "Summer", { pattern: "^[a-z0-9][a-z0-9_-]*$" })).toBe("formats.key");
    });
  });

  describe("slug, email, url, iso codes", () => {
    it("slug: lower-case, spaces become '-'", () => {
      expect(parseFormat("slug", " Summer Sale ")).toBe("summer-sale");
      expect(check("slug", "summer-sale")).toBe("");
      expect(check("slug", "summer_sale")).toBe("formats.slug");
      expect(check("slug", "-sale")).toBe("formats.slug");
    });

    it("email", () => {
      expect(parseFormat("email", " a@b.pl ")).toBe("a@b.pl");
      expect(check("email", "a@b.pl")).toBe("");
      expect(check("email", "a@b")).toBe("formats.email");
    });

    it("url: absolute http(s) only", () => {
      expect(check("url", "https://example.com/a.jpg")).toBe("");
      expect(check("url", "example.com/a.jpg")).toBe("formats.url");
      expect(check("url", "ftp://example.com")).toBe("formats.url");
    });

    it("iso2 / iso4217: upper-cased letters of the right length", () => {
      expect(parseFormat("iso2", "pl")).toBe("PL");
      expect(check("iso2", "POL")).toBe("formats.iso2");
      expect(parseFormat("iso4217", "eur")).toBe("EUR");
      expect(check("iso4217", "EU")).toBe("formats.iso4217");
    });
  });

  describe("formatError", () => {
    it("is empty for an empty value: required is not a format", () => {
      expect(formatError("money", "")).toBe("");
      expect(formatError("ean", null)).toBe("");
    });

    it("says the expected format with an example, in the UI language", () => {
      expect(formatError("money", "2.345")).toBe("Enter an amount with at most two decimal places, e.g. 232.00");
      setLang("PL");
      expect(formatError("money", "2.345")).toBe("Podaj kwotę z najwyżej dwoma miejscami po przecinku, np. 232,00");
      expect(formatError("integer", "0", { min: 1 })).toBe("Podaj 1 lub więcej");
    });
  });
});
