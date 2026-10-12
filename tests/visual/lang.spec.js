const { test, expect, prepareContext, openScreen, LANG, LOCALE } = require("./support/state");

// The harness language is a parameter (CMS_LANG / CMS_LOCALE, default Polish): this probe proves the mode that is set
// reached the page, the browser and the date picker, which takes its month and weekday names from the UI language.
const SCREEN = { id: "lang-probe", route: "/pricing/prices/1C01%2FN", resolver: "fixed", state: "default" };
const FIRST_WEEKDAY = { PL: "Pn", EN: "Sun" };

test.use({ colorScheme: "dark" });

test("lang-probe", { tag: ["@lang", "@desktop"] }, async ({ context, page }) => {
  await prepareContext(context, { theme: "dark" });
  await openScreen(page, SCREEN);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(LANG.toLowerCase());
  expect(await page.evaluate(() => navigator.language)).toBe(LOCALE);
  await page.locator(".basic-date-picker__trigger").first().click();
  await expect(page.locator(".flatpickr-weekday").first()).toHaveText(FIRST_WEEKDAY[LANG]);
});
