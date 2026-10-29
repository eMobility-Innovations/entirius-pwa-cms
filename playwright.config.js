const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

// CMS_BASE_URL points the suite at an already running CMS (zeno :8180) and skips the dev server.
const CMS_BASE_URL = process.env.CMS_BASE_URL;

/**
 * Playwright Test Configuration
 * For Vue 2 CMS - Critical Smoke Tests
 */
module.exports = defineConfig({
  testDir: './tests/e2e',

  // Timeout for each test (first test takes ~40s to warm up)
  timeout: 60000,

  // Test execution settings
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Shared settings for all tests
  use: {
    baseURL: CMS_BASE_URL || 'http://localhost:8080',

    // Browser settings
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors (if self-signed certs)
    ignoreHTTPSErrors: true,

    // Action timeout
    actionTimeout: 10000,
  },

  // Development server (skipped when CMS_BASE_URL targets a running CMS)
  webServer: CMS_BASE_URL ? undefined : {
    command: 'npm run serve',
    port: 8080,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
