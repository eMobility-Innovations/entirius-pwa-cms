const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const { either } = require('./helpers/text');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * PIM Quality Rules — soft-compat OFF (etap-06).
 *
 * Hard requirement: an old PIM without the gaps API must behave exactly as before.
 * We simulate that backend by 404-ing the gaps endpoints, then assert:
 *   - the "Quality Rules" nav item is hidden (capability probe → unavailable),
 *   - a direct visit to /pim/gap-definitions self-redirects to products (no screen),
 *   - the product list still renders with ZERO console errors.
 *
 * Run: `npx playwright test tests/e2e/15-pim-quality-rules-offcompat.spec.js`
 */

// The OFF scenario deliberately 404s the gaps endpoints — those network/console 404s are
// the expected "old backend" noise. We still assert zero uncaught JS exceptions (pageerror).
const FONT_WHITELIST = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'gaps/status',
  'gap-definitions',
  'Failed to load resource',
];

async function stubGapsOff(page) {
  // gaps/status/ drives the capability probe + alert; gap-definitions/ drives the screen.
  await page.route(/\/gaps\/status\//, (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not found"}' })
  );
  await page.route(/\/gap-definitions\//, (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not found"}' })
  );
}

test.describe('PIM Quality Rules — soft-compat OFF', () => {
  test('nav item hidden and product list clean when gaps API is absent', async ({ page }) => {
    await login(page);
    await stubGapsOff(page);
    const collector = createErrorCollector(page, { whitelist: FONT_WHITELIST });

    await page.goto('/pim/products');
    await page.waitForLoadState('networkidle');

    // The quality-rules nav entry must not be offered, in the sidebar nor in the tab bar.
    const navItem = page.getByRole('navigation').getByRole('link', {
      name: either(en.nav.pim_gap_definitions, pl.nav.pim_gap_definitions),
    });
    await expect(page.getByRole('navigation', { name: either(en.shell.panels, pl.shell.panels) })).toBeVisible();
    expect(await navItem.count()).toBe(0);

    collector.assertNoErrors(expect, 'soft-compat OFF — product list');
  });

  test('direct visit to the rules screen redirects to products (no screen)', async ({ page }) => {
    await login(page);
    await stubGapsOff(page);
    const collector = createErrorCollector(page, { whitelist: FONT_WHITELIST });

    await page.goto('/pim/gap-definitions');
    await page.waitForLoadState('networkidle');

    // Self-guard: the list 404s and replaces the route with products.
    await expect.poll(() => page.url(), { timeout: 8000 }).toContain('/pim/products');

    const onLogin = await page
      .locator('input[type="password"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(onLogin).toBeFalsy();

    collector.assertNoErrors(expect, 'soft-compat OFF — rules screen redirect');
  });
});
