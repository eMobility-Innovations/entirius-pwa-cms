const path = require("path");
const { defineConfig } = require("@playwright/test");
const { loopbackUrl } = require("../helpers/loopback");

/**
 * Docs captures (docs/testing.md → "Docs captures"): documentation screenshots from the live, seeded stack.
 * Runs against an already running CMS, never starts one. English, dark theme, one desktop viewport: the full
 * desktop layout of the CMS starts at 1280 px.
 */
module.exports = defineConfig({
  testDir: path.join(__dirname, "guides"),
  outputDir: path.join(__dirname, "test-results"),
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: loopbackUrl("CMS_BASE_URL", "http://localhost:8180"),
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "en-GB",
    timezoneId: "Europe/Warsaw",
    colorScheme: "dark",
    reducedMotion: "reduce",
    headless: true,
    actionTimeout: 10000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
});
