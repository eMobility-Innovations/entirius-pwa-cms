const { test, expect, guide, goto } = require("../support/capture");
const { ROWS, api } = require("./helpers");

// Guide "Translations": the Translate Store button of the PIM channel bar, its dialog with a cost estimate, and the
// job in Translation Jobs. The translations are written by the AI toolbox, so their text differs between runs: the
// spec waits for elements and statuses, never for translated text.
//
// A translation cannot be taken back: every run leaves one finished job and the product translations it wrote in
// the first other language of the channel. With a finished job already in the list the spec fails with
// `INFRA: translations needs a fresh make seed`.
//
// The capture needs a translator client with a provider key configured in the toolbox for the channel; without one
// it stops at Estimate cost with the service's answer.
const { shot } = guide("translations");

const SOURCE_LANGUAGE = "Source language"; // translate_dialog.source_language
const TARGET_LANGUAGES = "Target languages"; // translate_dialog.target_languages
const FORCE = "Re-translate existing translations"; // translate_dialog.force_all
const REFRESH = "Refresh"; // translation.refresh
const COMPLETED = "Completed"; // translation.completed
const FAILED = "Failed"; // translation.failed
const SOURCE = /^EN\b/; // the channel's languages read "EN - English"
const OTHER_TYPES = [1, 2, 3]; // the content types after Products: categories, attribute sets, attributes
const JOB_TIMEOUT_MS = 60000;
const POLL_MS = 2000;

const BUTTON = '[data-testid="pim-translate-store"]';
const CHANNEL_BAR = `div:has(> ${BUTTON})`;
const DIALOG = '[role="dialog"]:visible';
const ESTIMATE = '[data-testid="translate-dialog-estimate-step"]';
const JOBS = ".tj-dashboard";

const isTranslate = (dryRun) => (response) =>
  /\/bulk\/translate\/$/.test(response.url()) && response.request().postDataJSON()?.dry_run === dryRun;

async function assertFreshSeed(page) {
  await goto(page, "/translation-jobs", { ready: JOBS });
  const finished = page.locator(ROWS).filter({ hasText: new RegExp(`${COMPLETED}|${FAILED}`) });
  if (await finished.count()) throw new Error("INFRA: translations needs a fresh make seed");
}

// English to the first other language of the channel, products only, existing translations kept.
async function fillDialog(page) {
  const dialog = page.locator(DIALOG);
  await dialog.getByRole("combobox", { name: SOURCE_LANGUAGE }).click();
  await page.getByRole("option", { name: SOURCE }).click();
  await dialog.getByRole("combobox", { name: TARGET_LANGUAGES }).click();
  await page.getByRole("option").first().click();
  await dialog.getByText(TARGET_LANGUAGES, { exact: true }).click(); // closes the list of a multiple select
  for (const type of OTHER_TYPES) await dialog.getByRole("checkbox").nth(type).uncheck();
  await expect(dialog.getByLabel(FORCE)).not.toBeChecked();
}

// The dialog shows a failed estimate as a toast and stays on its first step: the answer itself is checked, so a
// refused estimate fails here with the reason the service gave.
async function estimate(page) {
  const estimated = page.waitForResponse(isTranslate(true));
  await page.getByTestId("translate-dialog-estimate").click();
  const response = await estimated;
  if (!response.ok()) throw new Error(`estimate failed: ${response.status()} ${await response.text()}`);
  await page.locator(`${ESTIMATE} ${ROWS}`).first().waitFor();
}

// The job the dialog created, read from its own answer: the path of the job and the channel it belongs to.
async function confirm(page) {
  const executed = page.waitForResponse(isTranslate(false));
  await page.getByTestId("translate-dialog-confirm").click();
  const response = await executed;
  const [jobId] = (await response.json()).job_ids;
  return `${new URL(response.url()).pathname.slice(1).replace(/translate\/$/, "jobs/")}${jobId}/`;
}

async function finishedJob(page, jobPath) {
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  for (;;) {
    const job = await api(page, "GET", jobPath);
    if (job.status === "failed") throw new Error(`translation job failed: ${JSON.stringify(job)}`);
    if (job.status === "completed") return job;
    if (Date.now() > deadline) throw new Error(`translation job still ${job.status} after ${JOB_TIMEOUT_MS} ms`);
    await page.waitForTimeout(POLL_MS);
  }
}

test("translations", async ({ page }) => {
  await assertFreshSeed(page);

  await test.step("Translate Store in the channel bar", async () => {
    await goto(page, "/pim/products", { ready: BUTTON });
    await shot(page, "01-translate-store-button", { element: CHANNEL_BAR, callouts: [{ target: BUTTON, label: "1" }] });
  });

  await test.step("The dialog with its cost estimate", async () => {
    await page.click(BUTTON);
    await fillDialog(page);
    await estimate(page);
    await shot(page, "02-translate-dialog", { element: DIALOG, callouts: [{ target: ESTIMATE, label: "1" }] });
  });

  await test.step("The finished job in Translation Jobs", async () => {
    const jobPath = await confirm(page);
    await finishedJob(page, jobPath);
    await goto(page, "/translation-jobs", { ready: ROWS });
    await page.getByRole("button", { name: REFRESH, exact: true }).click();
    const job = page.locator(ROWS).first();
    await expect(job).toContainText(COMPLETED);
    await shot(page, "03-translation-jobs", { callouts: [{ target: ROWS, label: "1" }] });
  });
});
