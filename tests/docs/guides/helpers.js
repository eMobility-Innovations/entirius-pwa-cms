// Not a guide: what the guide specs share. Scenario runs add rows to the shared database; a list shot must show
// seeded rows only.
const { expect } = require("../support/capture");

const ROWS = ".data-table__row";

// Runs in the browser: the trimmed text of every cell, row by row.
const cellTexts = (rows) =>
  rows.map((row) => [...row.querySelectorAll('[role="gridcell"]')].map((cell) => cell.innerText.trim()));

/**
 * Throws when the table on screen is empty or shows a row the seed did not create.
 * @param {import("@playwright/test").Page} page
 * @param {string} list the list's name in the error message
 * @param {{ column: number, isSeed: (text: string) => boolean }} rule the cell that names a row, and its test
 */
async function assertSeedRows(page, list, { column, isSeed }) {
  await page
    .locator(ROWS)
    .first()
    .waitFor()
    .catch(() => {});
  const rows = await page.locator(ROWS).evaluateAll(cellTexts);
  if (rows.length && rows.every((cells) => isSeed(cells[column] ?? ""))) return;
  throw new Error(`INFRA: ${list} shows rows outside the seed (run make seed)`);
}

/** Waits for the toast of a save or delete to show and to go, so it is in no shot. */
async function toastGone(page) {
  const toast = page.locator(".notification");
  await page.mouse.move(0, 0); // a pointer resting on the toast holds it
  await toast.first().waitFor();
  await expect(toast).toHaveCount(0, { timeout: 10000 });
}

module.exports = { ROWS, assertSeedRows, toastGone };
