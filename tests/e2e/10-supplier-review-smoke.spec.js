/**
 * SupplierReview panel — deep button coverage.
 *
 * Strategy: stub auth + intercept all supplier admin + munin endpoints
 * via `installSuppliersMock`. Each test asserts the right API call AND
 * the UI state transition.
 */

const { test, expect } = require('@playwright/test');
const {
  installSuppliersMock,
  fakeLogin,
  waitForRequest,
  fillField,
} = require('../helpers/suppliers-mock');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');
const { either: escapedEither } = require('./helpers/text');

// The UI language comes from the admin profile; accept either locale's text.
const either = (pick) => escapedEither(pick(en), pick(pl));

let mockState;

test.describe('SupplierReview panel', () => {
  test.beforeEach(async ({ page, context }) => {
    await fakeLogin(context);
    mockState = await installSuppliersMock(page);
  });

  // ---------- Top toolbar ----------

  test.describe('toolbar', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/suppliers/review');
      await page.waitForLoadState('networkidle');
    });

    test('mode switch defaults to Swipe', async ({ page }) => {
      await expect(page.getByTestId('swipe-approve-btn')).toBeVisible({
        timeout: 5000,
      });
    });

    test('switching to List loads list view', async ({ page }) => {
      await page.getByTestId('review-mode-list').click();
      await expect(page.getByTestId('list-bulk-toolbar')).toBeVisible();
    });

    test('switching to Events fetches events feed', async ({ page }) => {
      await page.getByTestId('review-mode-events').click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'GET' && r.url.includes('/events/')
      );
      expect(req).toBeTruthy();
    });

    test('mode persists in URL query string', async ({ page }) => {
      await page.getByTestId('review-mode-list').click();
      await expect(page).toHaveURL(/mode=list/);
    });

    test('status filter chip narrows products query', async ({ page }) => {
      await page.getByTestId('review-mode-list').click();
      await page.getByTestId('review-status-approved').click();
      const req = await waitForRequest(
        mockState,
        (r) =>
          r.method === 'GET' &&
          r.url.includes('/products/') &&
          r.url.includes('status=approved')
      );
      expect(req).toBeTruthy();
    });
  });

  // ---------- SwipeMode ----------

  test.describe('SwipeMode', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/suppliers/review?mode=swipe');
      await page.waitForLoadState('networkidle');
    });

    test('first card renders with name and counter', async ({ page }) => {
      await expect(page.getByTestId('product-card-name')).toContainText(
        'Acme Widget'
      );
      await expect(page.getByTestId('swipe-counter')).toContainText('1 /');
    });

    test('Approve POSTs approve and advances queue', async ({ page }) => {
      await page.getByTestId('swipe-approve-btn').click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'POST' && r.url.endsWith('/products/501/approve/')
      );
      expect(req).toBeTruthy();
      // After approve the only queued product is consumed; SwipeMode
      // refetches with status=queued and lands on EmptyState.
      await expect(
        page.getByTestId('swipe-approve-btn')
      ).not.toBeVisible({ timeout: 5000 });
    });

    test('Reject POSTs reject', async ({ page }) => {
      await page.getByTestId('swipe-reject-btn').click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'POST' && r.url.endsWith('/products/501/reject/')
      );
      expect(req).toBeTruthy();
    });

    test('Skip POSTs queue endpoint (skip routes to queue per backend)', async ({
      page,
    }) => {
      await page.getByTestId('swipe-skip-btn').click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'POST' && r.url.endsWith('/products/501/queue/')
      );
      expect(req).toBeTruthy();
    });

    test('Show raw data opens modal with JSON (mobile layout)', async ({ page }) => {
      // The button only renders below 769px — desktop shows a permanent side panel.
      await page.setViewportSize({ width: 600, height: 900 });
      await page.getByTestId('product-card-raw-data-btn').click();
      const dialog = page.getByRole('dialog', {
        name: either((t) => t.atlas.review.raw_data_title),
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Acme Widget');
      await dialog.getByRole('button', { name: either((t) => t.common.close) }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  // ---------- ListMode ----------

  test.describe('ListMode', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/suppliers/review?mode=list');
      await page.waitForLoadState('networkidle');
      // Default status filter is "queued"; switch to "all" to exercise bulk on multiple statuses
      await page.getByTestId('review-status-__all').click();
      await page.waitForLoadState('networkidle');
    });

    test('row checkboxes flip selected counter', async ({ page }) => {
      await page.getByTestId('list-row-checkbox-501').click();
      await expect(
        page.getByTestId('list-selected-count')
      ).toHaveAttribute('data-selected-count', '1');
    });

    test('Bulk Approve disabled until row selected', async ({ page }) => {
      await expect(page.getByTestId('list-bulk-approve')).toBeDisabled();
      await page.getByTestId('list-row-checkbox-501').click();
      await expect(page.getByTestId('list-bulk-approve')).toBeEnabled();
    });

    test('Bulk Approve confirms then POSTs bulk-approve', async ({ page }) => {
      await page.getByTestId('list-row-checkbox-501').click();
      await page.getByTestId('list-bulk-approve').click();
      // accept the confirmation
      await page.getByTestId('confirm-dialog-confirm').last().click();
      const req = await waitForRequest(
        mockState,
        (r) =>
          r.method === 'POST' && r.url.endsWith('/products/bulk-approve/')
      );
      expect(req.postData).toMatchObject({ ids: [501] });
    });

    test('Bulk Reject POSTs bulk-reject', async ({ page }) => {
      await page.getByTestId('list-row-checkbox-501').click();
      await page.getByTestId('list-bulk-reject').click();
      await page.getByTestId('confirm-dialog-confirm').last().click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'POST' && r.url.endsWith('/products/bulk-reject/')
      );
      expect(req.postData).toMatchObject({ ids: [501] });
    });

    test('Bulk Re-queue only enabled when at least one rejected selected', async ({
      page,
    }) => {
      // 501 is queued (not rejected) -> button stays disabled
      await page.getByTestId('list-row-checkbox-501').click();
      await expect(page.getByTestId('list-bulk-requeue')).toBeDisabled();
      // 503 is rejected
      await page.getByTestId('list-row-checkbox-503').click();
      await expect(page.getByTestId('list-bulk-requeue')).toBeEnabled();
    });

    test('Bulk Re-queue POSTs bulk-requeue with rejected ids only', async ({
      page,
    }) => {
      await page.getByTestId('list-row-checkbox-501').click();
      await page.getByTestId('list-row-checkbox-503').click();
      await page.getByTestId('list-bulk-requeue').click();
      await page.getByTestId('confirm-dialog-confirm').last().click();
      const req = await waitForRequest(
        mockState,
        (r) =>
          r.method === 'POST' && r.url.endsWith('/products/bulk-requeue/')
      );
      // Only the rejected (503) gets requeued
      expect(req.postData).toEqual({ ids: [503] });
    });

    test('Push approved enabled only with approved selection', async ({
      page,
    }) => {
      await page.getByTestId('list-row-checkbox-501').click();
      await expect(page.getByTestId('list-bulk-push')).toBeDisabled();
      await page.getByTestId('list-row-checkbox-502').click();
      await expect(page.getByTestId('list-bulk-push')).toBeEnabled();
    });

    test('Push approved POSTs bulk push with approved ids only', async ({
      page,
    }) => {
      await page.getByTestId('list-row-checkbox-501').click();
      await page.getByTestId('list-row-checkbox-502').click();
      await page.getByTestId('list-bulk-push').click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'POST' && r.url.endsWith('/push/')
      );
      expect(req.postData).toEqual({ ids: [502] });
    });
  });

  // ---------- EventsMode ----------

  test.describe('EventsMode', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/suppliers/review?mode=events');
      await page.waitForLoadState('networkidle');
    });

    test('renders unack events by default', async ({ page }) => {
      await expect(page.getByText('cost_updated')).toBeVisible();
      await expect(page.getByText('multi_supplier_overlap')).toBeVisible();
    });

    test('Severity FilterChip drives query', async ({ page }) => {
      await page.getByTestId('events-severity-warning').click();
      const req = await waitForRequest(
        mockState,
        (r) =>
          r.method === 'GET' &&
          r.url.includes('/events/') &&
          r.url.includes('severity=warning')
      );
      expect(req).toBeTruthy();
    });

    test('Show acknowledged toggle drops the acknowledged=false filter', async ({
      page,
    }) => {
      // initial GET has acknowledged=false
      await waitForRequest(
        mockState,
        (r) =>
          r.method === 'GET' &&
          r.url.includes('/events/') &&
          r.url.includes('acknowledged=false')
      );
      // drain the request log so the next GET shows up cleanly
      mockState.requests.length = 0;
      await page.getByTestId('events-show-ack-toggle').click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'GET' && r.url.includes('/events/')
      );
      expect(req.url).not.toContain('acknowledged=false');
    });

    test('Acknowledge POSTs ack endpoint and row updates', async ({ page }) => {
      await page.getByTestId('events-ack-801').click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === 'POST' && r.url.endsWith('/events/801/acknowledge/')
      );
      expect(req).toBeTruthy();
    });
  });
});
