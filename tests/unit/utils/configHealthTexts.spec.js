// The configuration-health rows of django-agreements (storefront URL) and django-checkout (discount codes that clash
// in a channel and currency, PayPal methods without a webhook ID) read in the UI language, never as the backend's
// English title; the passing grid names each check.
import { describe, it, expect, afterEach } from "vitest";
import { setLang } from "@/i18n";
import { checkName, checkText } from "@/utils/configHealth";

const ROWS = [
  { code: "agreements.storefront_url", state: "unconfigured", scope: "", title: "Storefront URL not set" },
  {
    code: "checkout.discount_codes",
    state: "unconfigured",
    scope: "default-europe",
    title: "Discount codes shared by rules of one channel and currency",
  },
  {
    code: "django_checkout.W002",
    state: "unconfigured",
    scope: "",
    title: "PayPal payment methods without 'webhook_id' in additional_data: [default-europe] paypal.",
  },
];

describe("configuration health — agreements and checkout checks", () => {
  afterEach(() => setLang("EN"));

  describe.each(["EN", "PL"])("%s", (lang) => {
    it.each(ROWS)("$code has its own text and name", (row) => {
      setLang(lang);
      const text = checkText(row);
      expect(text).not.toBe(row.title);
      expect(text).not.toMatch(/[{}]/);
      expect(checkName(row.code)).not.toBe(row.code);
    });

    it("the discount-code row names its channel", () => {
      setLang(lang);
      expect(checkText(ROWS[1])).toContain("default-europe");
    });
  });

  it.each(ROWS)("$code is translated, not the English text again", (row) => {
    const en = checkText(row);
    setLang("PL");
    expect(checkText(row)).not.toBe(en);
  });
});
