const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

/**
 * AI actions follow the AI toolbox state. The configuration-health answer is replaced with one `toolbox.status` row
 * per state; the store translate dialog of the Translation panel then shows the one shared hint, keeps Estimate off
 * while the toolbox is switched off or not set up, and the header warning stays away for a toolbox switched off on
 * purpose.
 * Read-only: opens the dialog, never estimates or translates.
 */

const STATES = [
  { state: 'disabled', severity: '', blocked: true, warned: false },
  { state: 'unconfigured', severity: 'medium', blocked: true, warned: true },
  { state: 'unreachable', severity: 'high', blocked: false, warned: true },
];

const healthBody = ({ state, severity }) => ({
  checked_at: new Date().toISOString(),
  checks: [
    { code: 'toolbox.status', module: 'utils', state, severity, title: `AI toolbox ${state}`, detail: '', fix_url: '', scope: '' },
  ],
});

test.use({ viewport: { width: 1440, height: 900 } });

for (const row of STATES) {
  test(`toolbox ${row.state}: the translate dialog shows the hint and follows the state`, async ({ page }) => {
    await page.route('**/api/munin/v2/health/', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: healthBody(row) }) : route.continue()
    );
    await login(page);
    await page.goto('/translation-jobs');
    await page.getByTestId('translation-translate-store').click();

    await expect(page.locator(`[data-testid="ai-toolbox-hint"][data-state="${row.state}"]`)).toBeVisible();
    if (row.blocked) await expect(page.getByTestId('translate-dialog-estimate')).toBeDisabled();
    await expect(page.getByTestId('config-health-button')).toHaveCount(row.warned ? 1 : 0);
  });
}
