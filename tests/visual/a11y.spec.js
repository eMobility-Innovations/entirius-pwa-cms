const { AxeBuilder } = require("@axe-core/playwright");
const { test, expect, openPinned } = require("./support/state");

// Accessibility baseline of the shell (P4, r05 §8), gate: axe finds no serious or critical violation on Home, a list
// and a detail screen at both viewports; the keyboard reaches the content through the skip link, walks the sidebar
// and opens a group with Enter (desktop), and the mobile menu keeps Tab inside and gives focus back on Esc. Nothing
// here touches the theme toggle or the language switch (they PATCH the shared admin profile).
const SCREENS = ["g-home", "faq-groups-list", "faq-group-detail"];
const BLOCKING = ["serious", "critical"];

const activeInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return { id: el?.id, inSidebar: Boolean(el?.closest('[data-testid="app-sidebar"]')), expanded: el?.getAttribute("aria-expanded") };
  });

test.describe(() => {
  test.use({ colorScheme: "dark" });

  for (const id of SCREENS) {
    test(`axe ${id}`, { tag: "@a11y" }, async ({ context, page }) => {
      await openPinned({ context, page }, id, "dark");
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations
        .filter((violation) => BLOCKING.includes(violation.impact))
        .map(({ id: rule, impact, nodes }) => ({ rule, impact, targets: nodes.map((node) => node.target.join(" ")) }));
      expect(blocking).toEqual([]);
    });
  }

  test("skip link → main; Tab walks the sidebar, Enter opens a group", { tag: ["@a11y", "@desktop"] }, async ({ context, page }) => {
    await openPinned({ context, page }, "faq-groups-list", "dark");
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();

    await page.locator(".skip-link").focus();
    let info = await activeInfo(page);
    for (let presses = 0; presses < 40 && !(info.inSidebar && info.expanded === "false"); presses += 1) {
      await page.keyboard.press("Tab");
      info = await activeInfo(page);
    }
    expect(info, "a closed sidebar group reached by Tab").toMatchObject({ inSidebar: true, expanded: "false" });
    const group = page.locator(":focus");
    await page.keyboard.press("Enter");
    await expect(group).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#${await group.getAttribute("aria-controls")}`)).toBeVisible();
  });

  test("mobile menu: Tab cycles inside, Esc returns focus to the menu button", { tag: ["@a11y", "@mobile"] }, async ({ context, page }) => {
    await openPinned({ context, page }, "faq-groups-list", "dark");
    const button = page.locator('[aria-controls="app-mobile-menu"]');
    await button.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /menu/i });
    await expect(dialog).toBeVisible();
    const focusables = await dialog.locator("a[href], button:not([disabled])").count();
    for (let presses = 0; presses <= focusables; presses += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });
});
