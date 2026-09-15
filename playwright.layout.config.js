const { defineConfig, devices } = require("@playwright/test");

/**
 * The layout-contract spec measures the compiled stylesheet in a browser
 * engine against a fixture. It needs no dev server and no backend, so it gets
 * its own config rather than paying for (and depending on) the app server the
 * main config starts.
 */
module.exports = defineConfig({
  testDir: "./tests/e2e",
  testMatch: /17-layout-scroll-contract\.spec\.js/,
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    headless: true,
    // Defaults to the browser Playwright downloads, as the rest of the suite
    // does. A machine that cannot fetch that build can point this spec at a
    // locally installed one instead: PW_CHANNEL=chrome npm run test:scroll
    channel: process.env.PW_CHANNEL || undefined,
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
