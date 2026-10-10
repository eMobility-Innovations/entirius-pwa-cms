// Not a guide: what the guide specs share. Scenario runs add rows to the shared database; a list shot must show
// seeded rows only.
const { expect } = require("../support/capture");
const { API_URL } = require("../../visual/support/state");

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

/** A button of the page header (Save, Delete), by its label. */
const headerButton = (page, name) => page.locator(".page-header").getByRole("button", { name, exact: true });

// The CMS keeps its access token in the `token` cookie and refreshes it itself, so it is read on every call.
async function bearer(page) {
  const cookies = await page.context().cookies();
  const token = cookies.find((cookie) => cookie.name === "token");
  if (!token) throw new Error("no token cookie: the page is not signed in");
  return { Authorization: `Bearer ${decodeURIComponent(token.value)}` };
}

/**
 * An API call as the signed-in user, for the state a guide cannot click together. Throws on a non-2xx answer.
 * @param {import("@playwright/test").Page} page a signed-in page
 * @param {string} method HTTP method
 * @param {string} path path under the API base URL, without the leading slash
 * @param {object} [data] JSON body
 * @returns {Promise<any>} the parsed JSON answer, `null` for an empty one
 */
async function api(page, method, path, data) {
  const response = await page.request.fetch(`${API_URL}/${path}`, { method, data, headers: await bearer(page) });
  const text = await response.text();
  if (!response.ok()) throw new Error(`${method} ${path}: ${response.status()} ${text}`);
  return text ? JSON.parse(text) : null;
}

module.exports = { ROWS, assertSeedRows, toastGone, headerButton, api };
