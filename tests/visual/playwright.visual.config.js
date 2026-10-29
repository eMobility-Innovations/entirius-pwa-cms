const path = require("path");
const { defineConfig } = require("@playwright/test");
const { REPORT_DIR } = require("./support/report");
const { loopbackUrl } = require("../helpers/loopback");

/**
 * Visual fidelity harness (docs/testing.md → "Visual fidelity harness").
 * Runs against an already running CMS (zeno :8180), never starts one.
 * Baselines are written only by `npm run visual:approve` (operator).
 */
module.exports = defineConfig({
  testDir: __dirname,
  outputDir: path.join(__dirname, "test-results"),
  globalSetup: require.resolve("./support/global-setup"),
  globalTeardown: require.resolve("./support/global-teardown"),
  // Specs name the folder: screens.spec.js `<project>/<file>`, catalogue.spec.js `components/<file>`.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  updateSnapshots: "none",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(REPORT_DIR, "html"), open: "never" }],
  ],
  expect: {
    toHaveScreenshot: { threshold: 0.1, maxDiffPixels: 20 },
  },
  use: {
    baseURL: loopbackUrl("CMS_BASE_URL", "http://localhost:8180"),
    headless: true,
    deviceScaleFactor: 1,
    locale: process.env.CMS_LOCALE || "pl-PL", // the default is repeated in support/state.js (LOCALE)
    timezoneId: "Europe/Warsaw",
    reducedMotion: "reduce",
    actionTimeout: 10000,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      grepInvert: /@mobile\b/,
      use: { viewport: { width: 1680, height: 1168 } },
    },
    {
      name: "mobile",
      grepInvert: /@desktop\b/,
      use: {
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
