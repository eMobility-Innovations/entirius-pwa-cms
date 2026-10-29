const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { SUPERUSER } = require('./helpers/users');
const { createErrorCollector } = require('../helpers/error-collector');

/**
 * Access plan 23: a token's value never leaves the SecretReveal dialog. The admin creates a run-unique application and
 * a token with one secret scope; the value is read from the dialog's field into a local variable only, the dialog is
 * confirmed and closed; then the value must be in no console message, web storage entry, cookie, visited URL, the page
 * (text and fields, before and after a reload), page error, or any API response but the create's own (the token
 * list after the create, the reloaded application detail and token list). Cleanup revokes
 * the token and deactivates the application — the API deletes neither, so every run leaves an inactive
 * `e2e-secret-<run>` application with one revoked token until the next `make seed`; ApplicationList reads one token
 * list per application, so many runs on one seed make that page slower (docs/testing.md). The value is never printed: every assertion is a yes/no named by the
 * token id, and trace, screenshot and video are off (they would keep the field's content on disk).
 * One of the two access specs that write (with access-staff-create).
 */

const API = process.env.VUE_APP_API_URL || 'http://localhost:8100';
const ADMIN = `${API}/api/access/v2/admin`;
// A server-to-server scope with the least reach (review moderation); like every token it gets no expiry by default (D31).
const SECRET_SCOPE = 'reviews.moderate';
const TOKEN_CREATE = /\/api\/access\/v2\/admin\/applications\/\d+\/tokens\/$/;

const created = { applicationId: null, tokenId: null };

// Top level: a trace, screenshot or video would keep the dialog's field on disk.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function bearer(page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'token');
  return { Authorization: `Bearer ${cookie.value}` };
}

const isTokenCreate = (response) => response.request().method() === 'POST' && TOKEN_CREATE.test(response.url());

// Every console message, visited URL and API response body from now on — but the token create's own answer, the one
// response that carries the value.
function recordTraces(page) {
  const traces = { console: [], urls: [page.url()], bodies: [] };
  page.on('console', (msg) => traces.console.push(msg.text()));
  page.on('framenavigated', (frame) => frame === page.mainFrame() && traces.urls.push(frame.url()));
  page.on('response', (response) => {
    if (response.url().startsWith(API) && !isTokenCreate(response)) traces.bodies.push(response.text().catch(() => ''));
  });
  return traces;
}

// What the page shows and holds right now: its text and every field's value (a DOM property, not in the HTML).
const liveText = (page) =>
  page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('input, textarea')].map((f) => f.value)]);

async function webStorage(page) {
  return page.evaluate(() =>
    [localStorage, sessionStorage].flatMap((store) => Object.keys(store).map((key) => `${key}=${store.getItem(key)}`))
  );
}

// BasicCheckbox: the test id lands on its label (attribute fallthrough) or on the native input inside it.
const checkbox = (page, testid) => page.locator(`label[data-testid="${testid}"], label:has([data-testid="${testid}"])`);

async function createApplication(page, name) {
  await page.goto('/access/applications/new');
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="application-name"] input').fill(name);
  await page.locator('[data-testid="application-save"]').click();
  await page.waitForURL(/\/access\/applications\/\d+$/);
  await page.waitForLoadState('networkidle');
  created.applicationId = Number(page.url().match(/(\d+)$/)[1]);
}

async function createToken(page, name) {
  await page.locator('[data-testid="token-create"]').click();
  await page.locator('[data-testid="token-name"] input').fill(name);
  await checkbox(page, `token-scope-${SECRET_SCOPE}`).click();
  const [response] = await Promise.all([
    page.waitForResponse(isTokenCreate),
    page.locator('[data-testid="token-create-save"]').click(),
  ]);
  expect(response.status(), 'token create').toBe(201);
  const body = await response.json();
  created.tokenId = body.id;
  expect(body.expires_at, `token ${body.id}: no expiry by default`).toBeNull();
}

// Reads the shown-once value into a local variable, confirms it was stored and closes the dialog.
async function takeSecret(page) {
  const field = page.locator('[data-testid="secret-reveal-value"]');
  await expect(field).toBeVisible();
  const secret = await field.inputValue();
  await checkbox(page, 'secret-reveal-stored').click();
  await page.locator('[data-testid="secret-reveal-close"]').click();
  await expect(page.locator('[data-testid="secret-reveal"]')).toHaveCount(0);
  return secret;
}

test.describe('Access: a token value stays in SecretReveal (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.afterEach(async ({ page }) => {
    const headers = await bearer(page);
    if (created.tokenId) {
      const revoked = await page.request.post(`${ADMIN}/tokens/${created.tokenId}/revoke/`, { headers });
      expect(revoked.ok(), `cleanup: revoke token ${created.tokenId}`).toBe(true);
    }
    if (created.applicationId) {
      const url = `${ADMIN}/applications/${created.applicationId}/`;
      const deactivated = await page.request.patch(url, { headers, data: { is_active: false } });
      expect(deactivated.ok(), `cleanup: deactivate application ${created.applicationId}`).toBe(true);
    }
  });

  test('the value is shown once and found nowhere after close', async ({ page }) => {
    await login(page, ...SUPERUSER);
    const collector = createErrorCollector(page);
    const traces = recordTraces(page);
    const run = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    await createApplication(page, `e2e-secret-${run}`);
    await createToken(page, `e2e secret ${run}`);

    const secret = await takeSecret(page);
    const id = `token ${created.tokenId}`;
    const holds = (text) => String(text).includes(secret);
    expect(secret.startsWith('ent_api_') && secret.length > 20, `${id}: the dialog showed a token value`).toBe(true);
    // The page that showed it: the closed dialog left the value in no text, no field and no attribute.
    expect((await liveText(page)).some(holds), `${id} on the page after close`).toBe(false);
    expect(holds(await page.content()), `${id} in the page HTML after close`).toBe(false);

    // A fresh load of the application detail and its token list.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`[data-testid="token-row-${created.tokenId}"]`)).toBeVisible();

    expect(traces.console.some(holds), `${id} in a console message`).toBe(false);
    expect((await webStorage(page)).some(holds), `${id} in web storage`).toBe(false);
    expect((await page.context().cookies()).some((c) => holds(c.value)), `${id} in a cookie`).toBe(false);
    expect([...traces.urls, page.url()].some(holds), `${id} in a visited URL`).toBe(false);
    expect(holds(await page.content()), `${id} in the page HTML`).toBe(false);
    const bodies = await Promise.all(traces.bodies);
    expect(bodies.length, 'API responses recorded').toBeGreaterThan(0);
    expect(bodies.some(holds), `${id} in an API response other than the create`).toBe(false);

    // Checked before the collector prints its page errors.
    expect(collector.getErrors().exceptions.some(holds), `${id} in a page error`).toBe(false);
    collector.assertNoErrors(expect, 'Access secret');
  });
});
