# Testing Documentation

Automated testing setup for the Pages CMS project.

## Quick Start

```bash
# Dev validation sweep — run after every CMS change (<30s)
npm run test:validate

# PIM-specific smoke tests
npm run test:pim

# Run only smoke tests (fastest)
npm run test:smoke

# Run all tests (build + e2e)
npm test

# Run e2e tests with visible browser
npm run test:e2e:headed

# Debug tests step-by-step
npm run test:e2e:debug
```

## Test Structure

```
tests/
├── e2e/                           # End-to-end Playwright tests
│   ├── 00-dev-validate.spec.js   # Dev validation sweep (all pages)
│   ├── 01-smoke.spec.js          # Critical smoke tests (7 tests)
│   ├── 02-api.spec.js            # API health checks
│   ├── 03-content-builder.spec.js
│   ├── 04-gallery-upload.spec.js
│   ├── 05-theme-and-layout.spec.js
│   ├── 06-content-list.spec.js
│   └── 07-pim-smoke.spec.js      # PIM panel smoke tests (6 tests)
├── build/                         # Build verification tests
│   └── build-test.js             # Build output validation
├── helpers/                       # Test utilities
│   ├── auth.js                   # Login/logout helpers
│   └── error-collector.js        # Console/network error capture
├── chrome-mcp-setup.md           # Chrome MCP setup guide
└── README.md                     # This file
```

## Test Categories

### 1. Build Tests (`npm run test:build`)

Verifies that the application builds successfully:
- ✓ Build completes without errors
- ✓ Dist folder is created
- ✓ index.html is generated
- ✓ JavaScript bundles exist
- ✓ CSS bundles exist
- ✓ Bundle size is reasonable

**When to run**: Before committing, after dependency changes

### 2. Dev Validation (`npm run test:validate`)

Fast all-page sweep (<30s). Visits every panel landing page and reports:
- Console errors, uncaught exceptions
- HTTP 4xx/5xx responses, CORS failures
- Auth redirects, blank pages

Outputs structured ASCII summary showing pass/fail per page.

**When to run**: After every CMS change (first thing)

### 3. Smoke Tests (`npm run test:smoke`)

Critical path verification (7 tests):
- ✓ App loads and shows login form
- ✓ Login works with valid credentials
- ✓ Homepage/Dashboard loads after login
- ✓ Gallery page is accessible
- ✓ Content list page is accessible
- ✓ Old paths redirect correctly
- ✓ Auth persists after page reload

**When to run**: After code changes, before pushing

### 4. PIM Smoke Tests (`npm run test:pim`)

PIM panel validation (6 tests):
- ✓ Sidebar shows PIM nav links
- ✓ Products list page loads with DataTable
- ✓ Categories list page loads
- ✓ Feature Sets list page loads
- ✓ Features list page loads
- ✓ Features create action accessible

**When to run**: After PIM view/API changes

### 5. API Tests (`02-api.spec.js`)

Backend health checks:
- ✓ API responds to languages endpoint

**When to run**: After API changes, deployment verification

## Configuration

### Environment Variables

Create `.env.test` file (optional):

```bash
VUE_APP_API_URL=http://localhost:8000
VUE_APP_USERNAME=admin
VUE_APP_PASSWORD=admin
```

Tests will use default credentials if not set. Never put the pair into `.env`: a production build (`npm run build`,
so `npm test` too) fails when either is set, because every `VUE_APP_*` value is compiled into the bundle.

### Playwright Configuration

See `playwright.config.js` for:
- Test timeouts
- Browser settings
- Screenshot/video capture
- Development server setup

## Debugging Failed Tests

### Option 1: Visual Debugging (Headed Mode)

```bash
npm run test:e2e:headed
```

See the browser while tests run. Browser stays open on failure.

### Option 2: Playwright Inspector

```bash
npm run test:e2e:debug
```

Step through tests line-by-line, inspect selectors, see network requests.

### Option 3: Chrome MCP (Claude Integration)

For Claude Code to investigate failures:

1. **Setup Chrome MCP** (see `chrome-mcp-setup.md`)
2. **Start Chrome with debugging**:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir="/Users/kloczi/Library/Application Support/Google/Chrome/Kloczidev"
   ```
3. **Run tests**
4. **Ask Claude**: "Check the browser state using Chrome MCP"

Claude can then inspect the DOM, console logs, network requests, etc.

### Option 4: Test Artifacts

After test failures, check:

```bash
# Screenshots (only on failure)
playwright-report/screenshots/

# Videos (only on failure)
playwright-report/videos/

# Traces (only on failure)
playwright-report/trace.zip

# View HTML report
npx playwright show-report
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Build check
  run: npm run test:build

# The credentials go to the e2e step only: a production build fails when either is set.
- name: Run e2e tests
  run: npm run test:e2e
  env:
    VUE_APP_USERNAME: ${{ secrets.TEST_USERNAME }}
    VUE_APP_PASSWORD: ${{ secrets.TEST_PASSWORD }}

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Error Collector

The `helpers/error-collector.js` module captures runtime errors during page navigation:

```javascript
const { createErrorCollector } = require('../helpers/error-collector');

test('page loads cleanly', async ({ page }) => {
  const collector = createErrorCollector(page);
  await page.goto('/my-page');
  await page.waitForLoadState('networkidle');
  collector.assertNoErrors(expect, 'My Page');
});
```

**What it captures:**
- `console.error` messages
- Uncaught JS exceptions (`pageerror`)
- HTTP 4xx/5xx responses
- CORS/network request failures

**API:** `reset()`, `hasErrors()`, `getErrors()`, `getSummary()`, `assertNoErrors(expect, context)`

Default whitelist: `favicon.ico`, `hot-update`, `sockjs-node`, `__webpack_hmr`

## Interactive Browser (Layer 2)

When automated tests fail and text output isn't clear enough, use `/browser`:

```
/browser http://localhost:8080/pim/features
```

Claude gets MCP tools: `browser_navigate`, `browser_snapshot`, `browser_screenshot`,
`browser_click`, `browser_type`, `browser_console_messages`.

**Setup:** Run `/browser-setup` once per machine.
**Verify:** `claude mcp list` should show `playwright-firefox: ✓ Connected`.

## Adding Tests for New Panels

1. Add page to `PANEL_PAGES` array in `00-dev-validate.spec.js`
2. Create `08-{panel}-smoke.spec.js` following `07-pim-smoke.spec.js` pattern
3. Add `test:{panel}` script to `package.json`

No changes needed to `error-collector.js` or MCP setup.

## Writing New Tests

### Example: Add a new smoke test

```javascript
// tests/e2e/01-smoke.spec.js
const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

test('New feature works', async ({ page }) => {
  await login(page);

  // Your test logic
  await page.goto('/new-feature');
  await expect(page.locator('.new-element')).toBeVisible();
});
```

### Test Naming Convention

- Prefix with numbers for execution order: `01-`, `02-`, `03-`
- Use descriptive names: `smoke`, `api`, `builder`, `gallery`
- Keep test descriptions clear and specific

## Test Guidelines

1. **Keep tests fast**: Smoke tests should run in < 2 minutes
2. **Make tests independent**: Each test should work in isolation
3. **Use selectors wisely**: Prefer `data-testid` over CSS selectors
4. **Wait for elements**: Use Playwright's auto-waiting, avoid `waitForTimeout`
5. **Clean up**: No need - tests run in isolation
6. **Handle flakiness**: Use proper waits, avoid hardcoded delays

## Troubleshooting

### Tests fail with "Timeout"

- Increase timeout in `playwright.config.js`
- Check if dev server is starting (port 8080)
- Verify `.env` variables are set

### Login test fails

- Check username/password in `.env` or use defaults
- Inspect selectors in login form (they might have changed)
- Run in headed mode to see what's happening

### API test fails

- Verify `VUE_APP_API_URL` is correct
- Check if backend is running
- API tests are optional - they skip if API is down

### Build test fails

- Run `npm run build` manually to see full error
- Check for syntax errors in code
- Verify all dependencies are installed

## Performance Tips

1. **Run smoke tests first**: Fast feedback loop
2. **Use headed mode during development**: See what's happening
3. **Run full suite before push**: Comprehensive check
4. **Use `test.only()`**: Debug single test
5. **Disable videos in dev**: Set `video: 'off'` in config

## Next Steps

1. ✅ Setup complete
2. ✅ Basic smoke tests implemented
3. ⏭️ Add more test scenarios as needed
4. ⏭️ Integrate with CI/CD
5. ⏭️ Add visual regression testing (optional)

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Chrome MCP Setup](./chrome-mcp-setup.md)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)

---

**Need help?** Check the Playwright docs or ask Claude to debug using Chrome MCP!
