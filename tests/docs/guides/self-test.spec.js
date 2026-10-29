const { test, expect, guide, goto } = require("../support/capture");

// Not a guide: proves the capture helpers on the home screen (a page shot, an element crop, a callout). The default
// run leaves it out by its tag.
const { shot } = guide("self-test");

test("self-test", { tag: "@self-test" }, async ({ page }) => {
  await test.step("Home", async () => {
    await goto(page, "/");
    await shot(page, "01-home");
  });
  await test.step("Header crop with a callout", async () => {
    await shot(page, "02-header-callout", {
      element: '[data-fid="header"]',
      padding: 8,
      callouts: [{ target: '[data-fid="user-button"]', label: "1" }],
    });
    await expect(page.locator("[data-docs-callout]")).toHaveCount(0);
  });
});
