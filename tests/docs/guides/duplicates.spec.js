const { test, expect, guide, goto } = require("../support/capture");

// Guide "Duplicates": the product search by text, its exact matches, the duplicate groups and the merge dialog.
// Writes nothing: the merge dialog is opened and closed with Cancel. A merge deletes the losing product and cannot
// be undone, so this spec never confirms one. The duplicate group it shows is gone once somebody merges it; the spec
// then fails with `INFRA: duplicates needs a fresh make seed`.
const { shot } = guide("duplicates");

const QUERY = "5900010000005"; // the EAN a seeded product and a seeded supplier offer share
const EAN = "5902000000905";
const CANCEL = "Cancel"; // atlas.duplicates.merge_modal.cancel
const SEARCH_INPUT = '[data-testid="dedup-search-input"] input';
const EXACT = '[data-testid="atlas-find-group-exact"]';
const SUGGESTION = `[data-testid="duplicates-suggestion-${EAN}"]`;
const GROUP = `.duplicates-group:has(${SUGGESTION})`;
const MERGE = '[data-testid="duplicates-merge-FRWSKL2001-to-FRW-SKL-2001"]';
const DIALOG = '[role="dialog"]:visible';

async function assertGroup(page) {
  if (await page.locator(SUGGESTION).count()) return;
  throw new Error("INFRA: duplicates needs a fresh make seed");
}

test("duplicates", async ({ page }) => {
  await test.step("Find product", async () => {
    await goto(page, "/atlas/find", { ready: SEARCH_INPUT });
    await shot(page, "01-find");
  });

  await test.step("Exact matches of an EAN", async () => {
    await page.fill(SEARCH_INPUT, QUERY);
    await page.getByTestId("dedup-search-submit").click();
    await page.locator(EXACT).waitFor();
    await shot(page, "02-find-results", { callouts: [{ target: EXACT, label: "1" }] });
  });

  await test.step("Duplicate groups", async () => {
    await goto(page, "/atlas/duplicates", { ready: ".duplicates-group, .empty-state" });
    await assertGroup(page);
    // The group sits half below the fold: the shot is the page scrolled down to its last row.
    await page.locator(GROUP).evaluate((card) => card.scrollIntoView({ block: "end" }));
    await shot(page, "03-duplicates", { callouts: [{ target: SUGGESTION, label: "1" }] });
  });

  await test.step("Merge dialog, opened and cancelled", async () => {
    const dialog = page.locator(DIALOG);
    await page.click(MERGE);
    await dialog.waitFor();
    await shot(page, "04-merge-dialog", { element: DIALOG });
    await dialog.getByRole("button", { name: CANCEL }).click();
    await expect(dialog).toHaveCount(0);
    await assertGroup(page);
  });
});
