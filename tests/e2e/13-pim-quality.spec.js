const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const { either } = require('./helpers/text');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * PIM Quality Gaps Highlighter Smoke Tests (etap-05)
 *
 * Soft-compat is the hard requirement: the product list must load with ZERO console
 * errors whether or not the backend exposes the gap_* fields. When the column is
 * present (backend supports gaps), it should render. When absent (old backend), the
 * page renders exactly as before.
 *
 * Run: `npx playwright test tests/e2e/13-pim-quality.spec.js`
 */

test.describe('PIM Quality Gaps', () => {
  test('product list loads with no console errors (soft-compat)', async ({ page }) => {
    await login(page);
    // Whitelist the Google Fonts CDN — some sandboxes block it (ERR_BLOCKED_BY_ORB);
    // that third-party failure is unrelated to the quality highlighter's correctness.
    const collector = createErrorCollector(page, {
      whitelist: ["fonts.googleapis.com", "fonts.gstatic.com"],
    });

    await page.goto('/pim/products');
    await page.waitForLoadState('networkidle');

    const onLogin = await page
      .locator('input[type="password"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(onLogin).toBeFalsy();

    // Either the Quality column is present (gaps backend) or it isn't (old backend).
    // Both are acceptable; what matters is the page rendered without errors.
    const qualityHeader = page.getByRole('columnheader', {
      name: either(en.pim.quality_column, pl.pim.quality_column),
    });
    if (await qualityHeader.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('PIM Quality: column present — gaps backend active');
    } else {
      console.log('PIM Quality: no column — soft-compat (backend without gap_* fields)');
    }

    collector.assertNoErrors(expect, 'PIM Quality list');
  });

  test('product detail loads with no console errors', async ({ page }) => {
    await login(page);
    // Whitelist the Google Fonts CDN — some sandboxes block it (ERR_BLOCKED_BY_ORB);
    // that third-party failure is unrelated to the quality highlighter's correctness.
    const collector = createErrorCollector(page, {
      whitelist: ["fonts.googleapis.com", "fonts.gstatic.com"],
    });

    await page.goto('/pim/products');
    await page.waitForLoadState('networkidle');

    // The first data row of the list grid (the header row holds column headers, no grid cells).
    const firstRow = page.getByRole('row').filter({ has: page.getByRole('gridcell') }).first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      const onLogin = await page
        .locator('input[type="password"]')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(onLogin).toBeFalsy();
    } else {
      console.log('PIM Quality: no products to open (empty catalog)');
    }

    collector.assertNoErrors(expect, 'PIM Quality detail');
  });
});
