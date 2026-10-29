#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

npm ci

# A separate fixture build exercises the retained browser regression without
# replacing dist/ or any bundle a developer or host may currently serve.
build_directory="$(mktemp -d "${TMPDIR:-/tmp}/cms-release-verify.XXXXXX")"
trap 'rm -rf -- "$build_directory"' EXIT
export VUE_APP_API_URL="https://api.cms-build.example.test"
export VUE_APP_CHANNEL="build-fixture"
export VUE_APP_SSO_ENABLED="true"
export VUE_APP_SSO_ONLY="true"
export VUE_APP_ACCESS_PANEL_ENABLED="true"
unset VUE_APP_USERNAME VUE_APP_PASSWORD
export LAYOUT_DIST="$build_directory"
# Use Playwright's runner-compatible Chromium rather than a workstation channel.
unset PW_CHANNEL
npm run build -- --dest "$build_directory"
npx playwright install chromium
npm run test:scroll -- --reporter=line
