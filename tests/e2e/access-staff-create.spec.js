const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');
const { either: escapedEither } = require('./helpers/text');

/**
 * FIX-14 (D1): New staff member. `accessadmin` creates a run-unique `e2e-staff-<ts>` with the Viewer role and a
 * generated password; the password shows once in SecretReveal (read into a local variable only, never printed); the
 * new row carries the Viewer tag; the generated password signs the new account in to the CMS in a fresh context and it
 * reads a page read-only. `manager` does not see the Access panel. Writes: every run leaves one account (generated
 * password only, so no known password lingers) until the next `make seed`. Trace, screenshot and video are off — they
 * would keep the dialog's field on disk.
 */

// Seeded users (todo/access README § Contract) — dev defaults, never real.
const USERS = {
  accessadmin: [process.env.ACCESS_ADMIN_USERNAME || 'accessadmin', process.env.ACCESS_ADMIN_PASSWORD || 'accessadmin123'],
  manager: [process.env.ACCESS_MANAGER_USERNAME || 'manager', process.env.ACCESS_MANAGER_PASSWORD || 'manager123'],
};
const STAFF_CREATE = /\/api\/access\/v2\/admin\/staff\/$/;

const either = (pick) => escapedEither(pick(en), pick(pl));
const sidebar = (page) => page.locator('[data-testid="app-sidebar"]');
const accessEntry = (page) => sidebar(page).getByText(either((t) => t.panels.access), { exact: true });
// BasicCheckbox: the test id lands on its label (attribute fallthrough) or on the native input inside it.
const checkbox = (page, testid) => page.locator(`label[data-testid="${testid}"], label:has([data-testid="${testid}"])`);

test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1280, height: 720 } });

async function createStaff(page, username) {
  await page.locator('[data-testid="staff-create"]').click();
  const dialog = page.locator('[data-testid="staff-create-dialog"]');
  await dialog.locator('[data-testid="staff-create-username"] input').fill(username);
  await dialog.locator('[data-testid="staff-create-email"] input').fill(`${username}@example.test`);
  await dialog.locator('[data-testid="staff-create-role"]').click();
  await page.getByRole('option', { name: 'Viewer', exact: true }).click();
  await expect(dialog.locator('[data-testid="staff-create-password"]')).toHaveCount(0);
  const isCreate = (r) => r.request().method() === 'POST' && STAFF_CREATE.test(r.url());
  const [response] = await Promise.all([page.waitForResponse(isCreate), page.locator('[data-testid="staff-create-save"]').click()]);
  expect(response.status(), 'staff create').toBe(201);
}

// The value leaves the field into a local variable only; the dialog closes after "I have stored it".
async function takeSecret(page) {
  const field = page.locator('[data-testid="secret-reveal-value"]');
  await expect(field).toBeVisible();
  const password = await field.inputValue();
  expect(password.length > 0, 'a generated password is shown').toBe(true);
  await checkbox(page, 'secret-reveal-stored').click();
  await page.locator('[data-testid="secret-reveal-close"]').click();
  await expect(page.locator('[data-testid="secret-reveal"]')).toHaveCount(0);
  expect(await field.count(), 'the field is gone').toBe(0);
  return password;
}

test('accessadmin creates a Viewer with a generated password that signs in read-only', async ({ page, browser }) => {
  const username = `e2e-staff-${Date.now()}`;
  await login(page, ...USERS.accessadmin);
  const collector = createErrorCollector(page);
  await page.goto('/access/staff');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.page-header').getByText(either((t) => t.access.staff.help))).toBeVisible();

  await createStaff(page, username);
  const password = await takeSecret(page);
  await expect(page.locator('[data-testid="staff-created-open"]')).toBeVisible();

  const search = page.waitForResponse((r) => r.url().includes('/admin/staff/') && r.url().includes(`search=${username}`));
  await page.locator('[data-testid="staff-search"] input').fill(username);
  await search;
  const row = page.locator(`[data-testid="staff-row-${username}"]`);
  await expect(row.locator('.tag', { hasText: /^Viewer$/ })).toBeVisible();
  await page.locator('[data-testid="staff-created-open"]').click();
  await page.waitForURL(/\/access\/staff\/\d+$/);
  await expect(page.locator('[data-testid="grant-row-viewer"]')).toBeVisible();
  collector.assertNoErrors(expect, 'New staff member');

  const fresh = await browser.newContext();
  const newcomer = await fresh.newPage();
  await login(newcomer, username, password);
  await expect(sidebar(newcomer)).toBeVisible();
  await expect(accessEntry(newcomer)).toHaveCount(0);
  await newcomer.goto('/pim/products');
  await newcomer.waitForLoadState('networkidle');
  await expect(newcomer.locator('[data-testid="readonly-notice"]')).toBeVisible();
  await fresh.close();
});

test('manager does not see the Access panel', async ({ page }) => {
  await login(page, ...USERS.manager);
  await expect(sidebar(page)).toBeVisible();
  await expect(accessEntry(page)).toHaveCount(0);
  await page.goto('/access/staff');
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/access/);
});
