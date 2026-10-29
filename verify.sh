#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

npm ci
npm run test:unit
npm run test:build-config

# Compile a public fixture unless the caller supplied deployment settings.
export VUE_APP_API_URL="${VUE_APP_API_URL:-https://api.cms-build.example.test}"
export VUE_APP_CHANNEL="${VUE_APP_CHANNEL:-build-fixture}"
export VUE_APP_SSO_ENABLED="${VUE_APP_SSO_ENABLED:-true}"
export VUE_APP_SSO_ONLY="${VUE_APP_SSO_ONLY:-true}"
build_directory="$(mktemp -d "${TMPDIR:-/tmp}/cms-verify.XXXXXX")"
trap 'rm -rf -- "$build_directory"' EXIT
npm run build -- --dest "$build_directory"

node - "$build_directory/build-info.json" <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const info = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const expected = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  version: require('./package.json').version,
  apiUrl: process.env.VUE_APP_API_URL,
  channel: process.env.VUE_APP_CHANNEL,
  ssoEnabled: process.env.VUE_APP_SSO_ENABLED.toLowerCase() === 'true',
  ssoOnly: process.env.VUE_APP_SSO_ONLY.toLowerCase() === 'true',
};
assert.deepEqual(info, expected);
console.log('Production build metadata matches the source and fixture configuration.');
JS
