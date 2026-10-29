const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webpack = require('webpack');
const { EnvCheckPlugin, BuildInfoPlugin, buildInfo } = require('../../scripts/build-config.cjs');

async function compile(mode, env) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-env-'));
  const entry = path.join(directory, 'entry.js');
  fs.writeFileSync(entry, 'module.exports = 1;');
  const compiler = webpack({ mode, entry, output: { path: path.join(directory, 'dist') },
    plugins: [new EnvCheckPlugin(env), new BuildInfoPlugin()] });
  try {
    const stats = await new Promise((resolve, reject) => compiler.run((error, stats) => error ? reject(error) : resolve(stats)));
    const metadataPath = path.join(directory, 'dist', 'build-info.json');
    if (fs.existsSync(metadataPath)) stats.buildInfo = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    return stats;
  } finally {
    await new Promise(resolve => compiler.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('production compilation rejects each missing or blank deployment variable', async () => {
  for (const key of ['VUE_APP_API_URL', 'VUE_APP_CHANNEL']) {
    for (const value of [undefined, '', '   ']) {
      const stats = await compile('production', { VUE_APP_API_URL: 'https://api.example.test', VUE_APP_CHANNEL: 'main', [key]: value });
      assert.equal(stats.hasErrors(), true);
      assert.match(stats.toString({ all: false, errors: true }), new RegExp(key));
    }
  }
});

test('production permits optional panels and development retains warning fallback', async () => {
  assert.equal((await compile('production', { VUE_APP_API_URL: 'https://api.example.test', VUE_APP_CHANNEL: 'main' })).hasErrors(), false);
  const development = await compile('development', {});
  assert.equal(development.hasErrors(), false);
  assert.equal(development.hasWarnings(), true);
});


test('build emits only public deployment metadata with source identity', async () => {
  const stats = await compile('production', { VUE_APP_API_URL: 'https://api.example.test', VUE_APP_CHANNEL: 'main' });
  const info = stats.buildInfo;
  assert.deepEqual(Object.keys(info).sort(), ['accessPanelEnabled', 'apiUrl', 'channel', 'sourceSha', 'ssoEnabled', 'ssoOnly', 'version']);
  assert.match(info.sourceSha, /^[a-f0-9]{40}$/);
  assert.equal(info.version, require('../../package.json').version);
  assert.equal(typeof info.ssoEnabled, 'boolean');
  assert.equal(typeof info.ssoOnly, 'boolean');
});


test('metadata records public settings and SSO flag semantics without credentials', () => {
  const info = buildInfo({ VUE_APP_API_URL: 'https://api.example.test', VUE_APP_CHANNEL: 'main',
    VUE_APP_SSO_ENABLED: 'TRUE', VUE_APP_SSO_ONLY: 'false', VUE_APP_PASSWORD: 'secret' });
  assert.equal(info.apiUrl, 'https://api.example.test');
  assert.equal(info.channel, 'main');
  assert.equal(info.ssoEnabled, true);
  assert.equal(info.ssoOnly, false);
  assert.equal(JSON.stringify(info).includes('secret'), false);
});

test('metadata follows upstream SSO base fallback and explicit fork enablement', () => {
  for (const [env, enabled, only] of [
    [{ VUE_APP_SSO_API_BASE: '/api/staff', VUE_APP_SSO_ONLY: 'TRUE' }, true, true],
    [{ VUE_APP_SSO_API_BASE: '/api/staff', VUE_APP_SSO_ENABLED: 'false', VUE_APP_SSO_ONLY: 'true' }, false, false],
    [{ VUE_APP_SSO_API_BASE: '/api/staff', VUE_APP_SSO_ENABLED: '', VUE_APP_SSO_ONLY: 'true' }, false, false],
    [{ VUE_APP_SSO_ONLY: 'true' }, false, false],
    [{ VUE_APP_SSO_ENABLED: 'TRUE', VUE_APP_SSO_ONLY: 'TRUE' }, true, true],
  ]) {
    const info = buildInfo(env);
    assert.equal(info.ssoEnabled, enabled, JSON.stringify(env));
    assert.equal(info.ssoOnly, only, JSON.stringify(env));
  }
});

test('metadata records the effective optional organization access panel flag', () => {
  for (const [flag, expected] of [[undefined, false], ['', false], ['false', false], ['TRUE', true]]) {
    assert.equal(buildInfo({ VUE_APP_ACCESS_PANEL_ENABLED: flag }).accessPanelEnabled, expected);
  }
});
