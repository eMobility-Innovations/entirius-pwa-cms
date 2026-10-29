const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

/**
 * Theme & Layout Tests
 *
 * Covers the theme item of the user menu, the sidebar (collapse rail,
 * group navigation, Home current), notifications, and loading overlay. All tests verify
 * user-visible UI outcomes.
 */

// The theme item sits in the user menu (the header's user button) and names its target state.
const THEME_ITEM = /Tryb (jasny|ciemny)|(Light|Dark) mode/;
const sidebar = (page) => page.getByRole('navigation', { name: /^(Panele|Panels)$/ });

async function toggleTheme(page) {
  await page.locator('[data-fid="user-button"]').click();
  await page.getByRole('menuitem', { name: THEME_ITEM }).click();
}

test.describe('Theme', () => {

  test('toggle switches between dark and light', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    const initialTheme = await page.getAttribute('html', 'data-theme');
    await toggleTheme(page);
    const newTheme = await page.getAttribute('html', 'data-theme');
    expect(newTheme).not.toEqual(initialTheme);

    // Toggle back to restore original
    await toggleTheme(page);
    const restoredTheme = await page.getAttribute('html', 'data-theme');
    expect(restoredTheme).toEqual(initialTheme);
  });

  test('persists after page reload', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    const initialTheme = await page.getAttribute('html', 'data-theme');
    await toggleTheme(page);
    const toggledTheme = await page.getAttribute('html', 'data-theme');
    expect(toggledTheme).not.toEqual(initialTheme);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    const persistedTheme = await page.getAttribute('html', 'data-theme');
    expect(persistedTheme).toEqual(toggledTheme);

    // Restore original theme
    await toggleTheme(page);
  });

});

test.describe('Sidebar', () => {

  test('collapses and expands', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    const nav = sidebar(page);
    await expect(nav).toBeVisible({ timeout: 5000 });
    const toggleBtn = nav.locator('.sidebar-nav__footer button[aria-expanded]');
    const wasExpanded = await toggleBtn.getAttribute('aria-expanded');

    await toggleBtn.click();
    await expect(toggleBtn).not.toHaveAttribute('aria-expanded', wasExpanded);

    // Second click restores
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', wasExpanded);
  });

  test('the rail shows icons named by aria-label, not text labels', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    const nav = sidebar(page);
    const toggleBtn = nav.locator('.sidebar-nav__footer button[aria-expanded]');
    if ((await toggleBtn.getAttribute('aria-expanded')) === 'false') await toggleBtn.click();
    await expect(nav.locator('.sidebar-nav-item__label').first()).toBeVisible({ timeout: 5000 });

    // Collapse
    await toggleBtn.click();
    await expect(nav.locator('a .sidebar-nav-item__label')).toHaveCount(0);
    await expect(nav.getByRole('link').first()).toHaveAttribute('aria-label', /.+/);

    // Expand to restore
    await toggleBtn.click();
    await expect(nav.locator('.sidebar-nav-item__label').first()).toBeVisible();
  });

});

test.describe('Panel Switching', () => {

  test('a sidebar group navigates to PIM', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    const nav = sidebar(page);
    const pimGroup = nav.getByRole('button', { name: 'PIM' });
    await pimGroup.click();
    await expect(pimGroup).toHaveAttribute('aria-expanded', 'true');

    await page.locator(`#${await pimGroup.getAttribute('aria-controls')}`).getByRole('link').first().click();
    // networkidle resolves before the lazy route chunk lands: wait for the URL itself.
    await expect(page).toHaveURL(/\/pim\//);
  });

  test('home cards navigate to correct panel', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const panelCards = page.getByRole('main').locator('.panel-card');
    await expect(panelCards.first()).toBeVisible({ timeout: 5000 });

    // Click first card (Pages panel)
    await panelCards.first().click();
    await page.waitForLoadState('networkidle');

    // Should be on a pages route with sidebar visible
    expect(page.url()).toContain('/pages/');
    await expect(sidebar(page)).toBeVisible({ timeout: 5000 });
  });

  test('home page has the sidebar with Home current', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = sidebar(page);
    await expect(nav).toBeVisible();
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', '/');
    await expect(page.getByRole('banner')).toBeVisible();
  });

});

test.describe('Notifications', () => {

  test('notification container is rendered in DOM', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    // The .notifications container is always in DOM (rendered in App.vue)
    const container = page.locator('.notifications');
    await expect(container).toBeAttached();
  });

});

test.describe('Loading Overlay', () => {

  test('loader is not stuck after page load', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    // After full load, the loading overlay should not be visible
    const loader = page.locator('.loading');
    const isVisible = await loader.isVisible().catch(() => false);
    expect(isVisible).toBeFalsy();
  });

});
