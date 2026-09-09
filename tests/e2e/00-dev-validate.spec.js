const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');

/**
 * Dev Validation Sweep
 *
 * Visits every panel landing page and reports errors.
 * Run after any CMS change: `npm run test:validate`
 *
 * Catches: console errors, uncaught exceptions, HTTP 4xx/5xx,
 * CORS failures, auth redirects, blank pages.
 */

const PANEL_PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Content List', path: '/pages/content?lg=pl' },
  { name: 'Gallery', path: '/pages/gallery' },
  { name: 'Content Sets', path: '/pages/content-sets' },
  { name: 'PIM Products', path: '/pim/products' },
  { name: 'PIM Categories', path: '/pim/categories' },
  { name: 'PIM Feature Sets', path: '/pim/feature-sets' },
  { name: 'PIM Features', path: '/pim/features' },
  { name: 'Suppliers', path: '/suppliers/list' },
  { name: 'Supplier Review', path: '/suppliers/review' },
  { name: 'Reviews Queue', path: '/reviews/queue' },
];

test.describe('Dev Validation Sweep', () => {
  let collector;
  const results = [];

  test('All panel pages load without errors', async ({ page }) => {
    await login(page);
    collector = createErrorCollector(page);

    for (const { name, path } of PANEL_PAGES) {
      collector.reset();

      await page.goto(path);
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // Check page rendered (not blank)
      const bodyText = await page.textContent('body').catch(() => '');
      const rendered = bodyText.length > 100;

      // Check not redirected to login
      const onLogin = await page
        .locator('input[type="password"]')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      const hasErrors = collector.hasErrors();
      const passed = rendered && !onLogin && !hasErrors;

      results.push({
        name,
        path,
        passed,
        onLogin,
        rendered,
        summary: hasErrors ? collector.getSummary() : null,
      });
    }

    // Print structured summary
    const passCount = results.filter((r) => r.passed).length;
    const failCount = results.length - passCount;

    const lines = ['', '=== DEV VALIDATION SUMMARY ==='];
    lines.push(`Passed: ${passCount}/${results.length}`);

    results
      .filter((r) => r.passed)
      .forEach((r) => lines.push(`  OK  ${r.name}`));

    if (failCount > 0) {
      lines.push(`Failed: ${failCount}/${results.length}`);
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          lines.push(`  FAIL ${r.name} (${r.path})`);
          if (r.onLogin) lines.push('    - Redirected to login (auth failed)');
          if (!r.rendered) lines.push('    - Page appears blank');
          if (r.summary) {
            r.summary.split('\n').forEach((l) => lines.push(`    ${l}`));
          }
        });
    }

    lines.push('==============================', '');
    console.log(lines.join('\n'));

    // Fail the test if any page failed
    expect(failCount, `${failCount} page(s) failed validation`).toBe(0);
  });
});
