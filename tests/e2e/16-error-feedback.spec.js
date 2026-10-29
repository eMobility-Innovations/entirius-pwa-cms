const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const { escapeRegExp } = require('./helpers/text');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

// The feature set is required: FormField's marker (` *`, CSS content) is part of the combobox's accessible name.
const FEATURE_SET = new RegExp(`^(${escapeRegExp(en.pim.feature_set)}|${escapeRegExp(pl.pim.feature_set)}) \\*$`);

/**
 * Error Feedback Tests (cms-error-handling-global)
 *
 * Verifies that real backend error messages reach the operator on create/edit
 * forms — no empty red field messages, no empty toasts, no generic fallback
 * when the backend sent a concrete message. Covers:
 *  A. required-field validation (client-side on ProductCreate, backend on Points)
 *  B. uniqueness violation with a live backend message (duplicate SKU)
 *  C. mocked response shapes (v2 envelope, DRF envelope, raw DRF, {detail}, 500, abort)
 *
 * Run: `npx playwright test tests/e2e/16-error-feedback.spec.js`
 * Needs the docker dev backend on :8000 (seeded) and CMS on :8080.
 */

const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:8000';
const CHANNEL = process.env.VUE_APP_CHANNEL || 'default-europe';
const USER = process.env.VUE_APP_USERNAME || 'admin';
const PASS = process.env.VUE_APP_PASSWORD || 'admin';

const GENERIC_MSGS = ['Something went wrong', 'Save failed', 'Coś poszło nie tak'];

const negToast = (page, text) =>
  text
    ? page.locator('.notification--negative', { hasText: text })
    : page.locator('.notification--negative');

async function expectNoEmptyErrorUI(page) {
  for (const el of await page.locator('.form-field__error:visible').all()) {
    expect((await el.innerText()).trim(), 'field error must not be empty').not.toBe('');
  }
  for (const el of await page.locator('.notification__msg:visible').all()) {
    expect((await el.innerText()).trim(), 'toast msg must not be empty').not.toBe('');
  }
}

// Only toasts that are not already leaving: a leaving toast never settles, so a click on it waits out the test.
async function dismissToasts(page) {
  const open = page.locator('.notification:not(.alert-leave-active) .notification__close');
  while (await open.count()) {
    await open.first().click().catch(() => {});
    await page.waitForTimeout(150);
  }
  await expect(page.locator('.notification')).toHaveCount(0);
}

async function apiToken(page) {
  const resp = await page.request.post(`${API_URL}/api/accounts/v1/${CHANNEL}/customer/tokens/`, {
    data: { email: USER, password: PASS },
  });
  const body = await resp.json();
  return body?.data?.access || null;
}

async function firstExistingSku(page) {
  const token = await apiToken(page);
  if (!token) return null;
  const resp = await page.request.get(
    `${API_URL}/api/pim/v2/admin/${CHANNEL}/products/?page_size=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = await resp.json();
  return body?.results?.[0]?.sku || null;
}

async function selectFirstFeatureSet(page) {
  // Named by its FormField label in either UI language.
  await page.getByRole('combobox', { name: FEATURE_SET }).click();
  await page.getByRole('option').first().click();
}

test.describe('Scenario A — required-field validation', () => {
  test('ProductCreate: empty save shows non-empty field errors and invalid dropdown', async ({ page }) => {
    await login(page);
    const collector = createErrorCollector(page);

    await page.goto('/pim/products/create');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Save")');

    const skuError = page.locator('.form-field__error').first();
    await expect(skuError).toBeVisible();
    expect((await skuError.innerText()).trim()).not.toBe('');

    await expect(page.getByRole('combobox', { name: FEATURE_SET })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await expectNoEmptyErrorUI(page);

    expect(collector.getErrors().exceptions).toEqual([]);
  });

  test('Points create: backend validation error reaches the operator (Redmine #33398-2)', async ({ page }) => {
    await login(page);
    const collector = createErrorCollector(page);

    await page.goto('/points/create');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Save")');

    // The backend 400 must surface as a non-empty negative toast — the exact
    // shape (v2 envelope vs DRF) is what this asserts end-to-end.
    const toast = negToast(page);
    await expect(toast.first()).toBeVisible({ timeout: 10000 });
    const msg = (await toast.first().locator('.notification__msg').innerText()).trim();
    expect(msg).not.toBe('');
    for (const generic of GENERIC_MSGS) {
      expect(msg, `backend message expected, got generic fallback "${generic}"`).not.toBe(generic);
    }
    await expectNoEmptyErrorUI(page);

    expect(collector.getErrors().exceptions).toEqual([]);
  });
});

test.describe('Scenario B — uniqueness violation (live backend)', () => {
  test('ProductCreate: duplicate SKU surfaces the real backend message', async ({ page }) => {
    await login(page);
    const collector = createErrorCollector(page);

    const sku = await firstExistingSku(page);
    test.skip(!sku, 'no existing product SKU available (unseeded backend)');

    await page.goto('/pim/products/create');
    await page.waitForLoadState('networkidle');

    await page.fill('input[placeholder="e.g. CHAIR-001"]', sku);
    await selectFirstFeatureSet(page);
    await page.click('button:has-text("Save")');

    const toast = negToast(page);
    await expect(toast.first()).toBeVisible({ timeout: 10000 });
    const msg = (await toast.first().locator('.notification__msg').innerText()).trim();
    expect(msg).not.toBe('');
    for (const generic of GENERIC_MSGS) {
      expect(msg).not.toBe(generic);
    }
    await expectNoEmptyErrorUI(page);

    expect(collector.getErrors().exceptions).toEqual([]);
  });
});

test.describe('Scenario C — response shapes (mocked)', () => {
  const SHAPES = [
    {
      name: 'v2 envelope',
      status: 400,
      body: {
        error: 'VALIDATION_ERROR',
        message: 'V2 message from backend',
        debug_id: 'e2e00001',
        details: [{ field: 'sku', description: 'V2 field description' }],
      },
      expectToast: 'V2 message from backend',
      expectFieldError: 'V2 field description',
    },
    {
      name: 'DRF-in-envelope',
      status: 400,
      body: { meta: { message: 'Validation failed' }, data: { sku: ['Envelope SKU duplicate'] } },
      expectToast: 'Envelope SKU duplicate',
      expectFieldError: 'Envelope SKU duplicate',
    },
    {
      name: 'raw DRF field dict',
      status: 400,
      body: { sku: ['Raw DRF message'] },
      expectToast: 'Raw DRF message',
      expectFieldError: 'Raw DRF message',
    },
    {
      name: 'legacy detail string',
      status: 400,
      body: { detail: 'Plain detail string' },
      expectToast: 'Plain detail string',
    },
    {
      name: '500 html body',
      status: 500,
      raw: '<html><body>Server Error</body></html>',
      contentType: 'text/html',
      expectToast: 'Save failed', // localized fallback — but never empty
    },
    {
      name: 'network abort',
      abort: true,
      expectToast: 'Save failed',
    },
  ];

  test('ProductCreate: every backend error shape produces a concrete message', async ({ page }) => {
    await login(page);
    const collector = createErrorCollector(page);

    await page.goto('/pim/products/create');
    await page.waitForLoadState('networkidle');

    await page.fill('input[placeholder="e.g. CHAIR-001"]', 'E2E-ERRFB-MOCK');
    await selectFirstFeatureSet(page);

    for (const shape of SHAPES) {
      await page.route('**/products/', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        if (shape.abort) return route.abort('failed');
        return route.fulfill({
          status: shape.status,
          contentType: shape.contentType || 'application/json',
          body: shape.raw || JSON.stringify(shape.body),
        });
      });

      await page.click('button:has-text("Save")');

      const toast = negToast(page, shape.expectToast);
      await expect(toast.first(), `toast for shape: ${shape.name}`).toBeVisible({ timeout: 10000 });

      if (shape.expectFieldError) {
        const fieldError = page.locator('.form-field__error', { hasText: shape.expectFieldError });
        await expect(fieldError.first(), `field error for shape: ${shape.name}`).toBeVisible();
      }

      await expectNoEmptyErrorUI(page);
      await dismissToasts(page);
      await page.unroute('**/products/');
    }

    expect(collector.getErrors().exceptions).toEqual([]);
  });
});
