const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { SUPERUSER } = require('./helpers/users');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');
const snapshot = require('../fixtures/access-catalogue.json');

/**
 * BG-24: the live django-access catalogue against the CMS. The unit key test pins the area and scope labels to the
 * committed snapshot (`tests/fixtures/access-catalogue.json`); this diffs `GET /api/access/v2/admin/catalogue/` against
 * that snapshot and against the `access.areas` / `access.scopes` labels of both locales, so a new catalogue area or
 * scope fails here instead of shipping unlabeled. Read-only.
 */

const API = process.env.VUE_APP_API_URL || 'http://localhost:8100';
const CATALOGUE = `${API}/api/access/v2/admin/catalogue/`;

async function bearer(page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'token');
  return { Authorization: `Bearer ${cookie.value}` };
}

const sorted = (keys) => [...keys].sort();
// `access.areas` nests by the key's dots (`pim.products` → `pim: { products }`): the dotted keys back.
const leaves = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );

test('the live catalogue matches the snapshot and every key has a label in EN and PL', async ({ page }) => {
  await login(page, ...SUPERUSER);
  const response = await page.request.get(CATALOGUE, { headers: await bearer(page) });
  expect(response.status()).toBe(200);
  const catalogue = await response.json();
  const areas = catalogue.modules.flatMap((group) => group.areas.map((area) => area.key));
  const scopes = catalogue.scopes.map((scope) => scope.key);

  expect(sorted(areas)).toEqual(sorted(snapshot.areas));
  expect(sorted(scopes)).toEqual(sorted(snapshot.scopes));
  for (const locale of [en, pl]) {
    expect(sorted(leaves(locale.access.areas))).toEqual(sorted(areas));
    expect(sorted(leaves(locale.access.scopes))).toEqual(sorted(scopes));
  }
});
