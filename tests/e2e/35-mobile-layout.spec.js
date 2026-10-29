// @ts-check
/**
 * Phone layout: the shell fits the visible viewport (the bottom tab bar is never cut off) and a list page's header and
 * toolbar keep their controls on clean lines. Android report 2026-10-01: the tab bar disappeared under the system bar;
 * the PIM header's title, channel select and translate button sat at three different heights.
 */
const { test, expect, devices } = require('@playwright/test');
const { login } = require('../helpers/auth');

test.use({ ...devices['Pixel 7'] });

const centerY = (box) => box.y + box.height / 2;

test.describe('Phone layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('the app box is the dynamic viewport and the tab bar fits inside it', async ({ page }) => {
    await page.goto('/pim/products');
    const tabBar = page.locator('.bottom-tab-bar');
    await expect(tabBar).toBeVisible();

    const { innerHeight, appHeight, barBottom, appRule } = await page.evaluate(() => {
      // Headless Chromium has no collapsing toolbar, so 100vh and the visible height match here: the rule itself is
      // checked too — 100vh is taller than the visible area whenever Android's browser toolbar shows.
      const rules = [...document.styleSheets].flatMap((sheet) => {
        try {
          return [...sheet.cssRules];
        } catch {
          return [];
        }
      });
      const appRule = rules.filter((r) => r.selectorText === '#app').map((r) => r.cssText).join(' ');
      return {
        innerHeight: window.innerHeight,
        appHeight: document.getElementById('app').getBoundingClientRect().height,
        barBottom: document.querySelector('.bottom-tab-bar').getBoundingClientRect().bottom,
        appRule,
      };
    });
    expect(appRule).toContain('100dvh');
    expect(appHeight).toBe(innerHeight);
    expect(barBottom).toBeLessThanOrEqual(innerHeight);
  });

  test('the PIM header keeps title and channel select on one line', async ({ page }) => {
    await page.goto('/pim/products');
    // The select's box itself (a label above it would sit inside the test id's wrapper and fake the alignment).
    const select = page.getByTestId('pim-channel-select').locator('.basic-select__control');
    await expect(select).toBeVisible();
    await expect(select).toHaveAccessibleName(/channel/i);
    const title = page.locator('.page-header__title');

    const selectBox = await select.boundingBox();
    const titleBox = await title.boundingBox();
    expect(Math.abs(centerY(titleBox) - centerY(selectBox))).toBeLessThanOrEqual(2);
  });

  for (const path of ['/pim/products', '/pim/categories', '/points']) {
    test(`the search takes the toolbar's whole row on ${path}`, async ({ page }) => {
      await page.goto(path);
      const toolbar = page.locator('.page-layout__toolbar');
      const search = toolbar.locator('.input-basic-wrapper').first();
      await expect(search).toBeVisible();

      const toolbarBox = await toolbar.boundingBox();
      const searchBox = await search.boundingBox();
      expect(Math.abs(searchBox.width - toolbarBox.width)).toBeLessThanOrEqual(1);
    });
  }
});
