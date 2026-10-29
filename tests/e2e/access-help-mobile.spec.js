const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');
const { either: escapedEither } = require('./helpers/text');

/**
 * UX review B1: on a 393 px phone the help line of Staff, Applications and Groups wraps inside the screen. Logged in
 * as the seeded `accessadmin` (Administrator): the line must be visible, end inside the viewport, and the page must
 * not scroll sideways. Read-only.
 */

const ACCESS_ADMIN = [
  process.env.ACCESS_ADMIN_USERNAME || 'accessadmin',
  process.env.ACCESS_ADMIN_PASSWORD || 'accessadmin123',
];

const PAGES = [
  { path: '/access/staff', key: 'staff' },
  { path: '/access/applications', key: 'applications' },
  { path: '/access/groups', key: 'groups' },
];

test.describe('Access help line on a phone (393 px)', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test.beforeEach(async ({ page }) => {
    await login(page, ...ACCESS_ADMIN);
  });

  for (const { path, key } of PAGES) {
    test(`${key}: the help line wraps, no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(escapedEither(en.access[key].title, pl.access[key].title));

      const help = page.locator('[data-testid="page-description"]');
      await expect(help).toHaveText(escapedEither(en.access[key].help, pl.access[key].help));
      const box = await help.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(393);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
