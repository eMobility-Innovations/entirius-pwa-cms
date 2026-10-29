const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { SUPERUSER } = require('./helpers/users');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');
const { either: escapedEither } = require('./helpers/text');

/**
 * Access plan 20 smoke: the admin opens Access → Roles, sees the four built-in roles and opens Viewer — a read-only
 * matrix with the built-in notice and Duplicate, no Save. Read-only: never saves, duplicates or deletes.
 */

const BUILTIN_ROLES = ['administrator', 'manager', 'editor', 'viewer'];
const either = (pick) => escapedEither(pick(en), pick(pl));

test.describe('Access roles (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await login(page, ...SUPERUSER);
  });

  test('roles list shows the built-ins; Viewer opens read-only', async ({ page }) => {
    const collector = createErrorCollector(page);
    await page.goto('/access');
    await page.waitForURL(/\/access\/roles$/);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.access.roles.title));
    for (const key of BUILTIN_ROLES) {
      await expect(page.locator(`[data-testid="role-row-${key}"]`)).toBeVisible();
    }

    await page.locator('[data-testid="role-row-viewer"] a').click();
    await page.waitForURL(/\/access\/roles\/viewer$/);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="builtin-notice"]')).toBeVisible();
    const matrix = page.locator('[data-testid="permission-matrix"]');
    await expect(matrix.locator('[role="radiogroup"]').first()).toBeVisible();
    await expect(matrix.locator('input[type="radio"]:not([disabled])')).toHaveCount(0);
    await expect(matrix.locator('[data-testid="matrix-set-all"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: either((t) => t.access.roles.duplicate) })).toBeVisible();
    await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toHaveCount(0);

    collector.assertNoErrors(expect, 'Access roles');
  });
});
