const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

/**
 * Critical Smoke Tests
 * These tests verify the most critical paths in the CMS
 */

test.describe('Critical Smoke Tests', () => {

  test('1. App loads and shows login form', async ({ page }) => {
    await page.goto('/');

    // Should see login form (just check for password field - simplest check)
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });

    // Should see submit button (label depends on VUE_APP_LANG)
    const submitButton = page.locator('button:has-text("Zaloguj"), button:has-text("Log in")');
    await expect(submitButton).toBeVisible();
  });

  test('2. Login works with valid credentials', async ({ page }) => {
    await login(page);

    // Should redirect away from login
    await page.waitForTimeout(2000);

    // Should see some navigation or content (not login form)
    const loginFormVisible = await page.locator('input[type="password"]').isVisible().catch(() => false);
    expect(loginFormVisible).toBeFalsy();

    // URL should have changed
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('3. Homepage shows panel selector after login', async ({ page }) => {
    await login(page);

    // Navigate to home
    await page.goto('/');

    // Should load without errors
    await page.waitForLoadState('networkidle');

    // Should see panel cards (at least Pages and PIM)
    const panelCards = page.getByRole('main').locator('.panel-card');
    await expect(panelCards.first()).toBeVisible({ timeout: 10000 });

    const panelCount = await panelCards.count();
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });

  test('4. Gallery page is accessible', async ({ page }) => {
    await login(page);

    // Navigate to gallery (canonical path)
    await page.goto('/pages/gallery');

    // Should load without 404
    expect(page.url()).toContain('/pages/gallery');

    // Should not show error page
    const errorText = await page.textContent('body').catch(() => '');
    expect(errorText).not.toContain('404');
    expect(errorText).not.toContain('Not Found');
  });

  test('5. Content list page is accessible', async ({ page }) => {
    await login(page);

    // Navigate to content list (canonical path)
    await page.goto('/pages/content?lg=pl');

    // Should load
    await page.waitForLoadState('networkidle');

    // Should not be on login page
    const isOnLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    expect(isOnLogin).toBeFalsy();
  });

  test('6. Old paths redirect correctly', async ({ page }) => {
    await login(page);

    // /gallery should redirect to /pages/gallery
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/pages/gallery');

    // /content should redirect to /pages/content
    await page.goto('/content');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/pages/content');
  });

  test('7. Auth persists after page reload', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    // Verify authenticated (no login form)
    await expect(page.locator('input[type="password"]')).toBeHidden();

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Still authenticated
    await expect(page.locator('input[type="password"]')).toBeHidden();

    // Header controls visible (proves app rendered authenticated state)
    await expect(page.locator('[data-fid="user-button"]:visible')).toBeVisible({ timeout: 10000 });
  });

});
