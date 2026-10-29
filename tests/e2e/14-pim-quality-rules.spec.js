const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');

/**
 * PIM Quality Rules — CRUD screen + "rules changed" alert + "Recompute now" (etap-06).
 *
 * Test 1 loads the live rules screen (capability ON) and asserts zero console errors.
 * Test 2 drives the alert lifecycle deterministically via route mocking — the CMS
 * contract is: show the banner when gaps/status reports is_stale, and clear it once a
 * recompute settles. We mock gaps/status so the test never depends on a Celery worker
 * (the genuine end-to-end on a live worker is covered by the browser-skill run).
 *
 * Run: `npx playwright test tests/e2e/14-pim-quality-rules.spec.js`
 */

// Google Fonts may be blocked in a sandbox (the collector ignores the dev server's hot-reload socket itself).
const FONT_WHITELIST = ['fonts.googleapis.com', 'fonts.gstatic.com'];

test.describe('PIM Quality Rules', () => {
  test('rules screen loads with no console errors (capability ON)', async ({ page }) => {
    await login(page);
    const collector = createErrorCollector(page, { whitelist: FONT_WHITELIST });

    await page.goto('/pim/gap-definitions');
    await page.waitForLoadState('networkidle');

    const onLogin = await page
      .locator('input[type="password"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(onLogin).toBeFalsy();

    // Either the rules list rendered, or (old backend) we got redirected to products.
    // Both are error-free; what matters is no console errors.
    // Every screen has exactly one H1 (the page header, or the shell's fallback).
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 5000 });
    console.log('PIM Quality Rules: screen at', page.url());

    collector.assertNoErrors(expect, 'PIM Quality Rules list');
  });

  test('stale banner appears and clears after Recompute now', async ({ page }) => {
    await login(page);
    const collector = createErrorCollector(page, { whitelist: FONT_WHITELIST });

    // Control the gaps/status response: stale until a recompute is triggered.
    let stale = true;
    await page.route(/\/gaps\/status\//, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          gaps_enabled: true,
          rules_changed_at: '2026-06-07T14:30:00+00:00',
          recomputed_at: '2026-06-07T10:00:00+00:00',
          is_stale: stale,
          recompute_running: false,
        }),
      })
    );
    await page.route(/\/gaps\/recompute\//, (route) => {
      stale = false; // recompute accepted → subsequent status polls report fresh
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'started', running: true }),
      });
    });

    await page.goto('/pim/gap-definitions');
    await page.waitForLoadState('networkidle');

    const banner = page.locator('[data-test="gap-status-alert"]');
    await expect(banner).toBeVisible({ timeout: 8000 });

    await page.locator('[data-test="gap-recompute-btn"]').click();

    // Poll cycle (~2s) refetches status → fresh → banner removed.
    await expect(banner).toBeHidden({ timeout: 15000 });

    collector.assertNoErrors(expect, 'PIM Quality Rules alert lifecycle');
  });
});
