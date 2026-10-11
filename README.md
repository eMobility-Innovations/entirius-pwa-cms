# entirius-pwa-cms

The admin CMS of Entirius, the open-source modular ecommerce platform: a single-page app where staff manage the
catalog, content and orders of a store. It talks to the backend over its REST API and shows only the
panels whose backend modules are enabled.

## What it does

- Builds pages visually: static pages, blog posts, product and category content, from sections and tiles.
- Manages the catalog, prices and stock, orders, customer accounts, forms, FAQ, agreements and mail templates in
  self-contained panels.
- Turns panels on and off at runtime from the backend's module registry; a missing module leaves a dormant panel,
  never a broken one.
- Follows the signed-in user's roles: hides what the backend would refuse and shows read-only pages as read-only.
- Adapts per deployment through JSON configs (`__client/`) and environment files, from one codebase.

## Installation

```bash
git clone https://github.com/entirius/entirius-pwa-cms.git
cd entirius-pwa-cms
npm ci
cp .env.example .env
```

Set the two required values in `.env`: `VUE_APP_API_URL` (the backend base URL) and `VUE_APP_CHANNEL` (the active
sales channel). Without them the app shows a "Configuration Required" screen that lists what is missing.

## Quick start

```bash
npm run serve
```

The dev server answers on http://localhost:8080. Sign in with a staff account of the backend. The first run
generates the `__client/` configs from `__client_default/`; edit the JSON files there to customise the page builder
(`npm run init:client` regenerates missing ones).

## Requirements

- Node.js 20.19 or newer and npm.
- A running Entirius backend with the module registry (django-munin); the entirius-zeno harness
  (https://github.com/entirius/entirius-zeno) starts one, seeded.
- For the end-to-end tests: Playwright browsers and a running backend.

## Documentation

- Repository docs (panels and routing, access, config system, deployment, UI rules, testing):
  https://github.com/entirius/entirius-pwa-cms/tree/develop/docs
- Environment variables and deployment modes:
  https://github.com/entirius/entirius-pwa-cms/blob/develop/docs/deployment.md
- Page builder configuration (`__client/`):
  https://github.com/entirius/entirius-pwa-cms/blob/develop/docs/config-system.md
- Tests: https://github.com/entirius/entirius-pwa-cms/blob/develop/docs/testing.md
- Entirius documentation: https://docs.entirius.com/
- Changelog: https://github.com/entirius/entirius-pwa-cms/blob/develop/CHANGELOG.md

## Part of Entirius

The CMS is the staff-facing frontend of the platform; the storefront is the shopper-facing one.

- Backend service: https://github.com/entirius/entirius-service-volkanos
- Docker harness: https://github.com/entirius/entirius-zeno
- Storefront: https://github.com/entirius/entirius-pwa-storefront
- Test package (end-to-end suites that drive this CMS): https://github.com/entirius/entirius-test-package-emporium

## Development

```bash
npm run serve        # dev server
npm run test:unit    # Vitest unit suite
npm run test:smoke   # quick Playwright sanity (needs a running backend)
npm test             # build check + full Playwright suite
npm run lint:ui      # stylelint + eslint + UI audits
npm run pretty       # Prettier over *.vue
npm run build        # production build
```

Adding a feature: read the agent instructions and the `docs/` reference first, run `npm run test:smoke` before
you change anything, add tests for the new behaviour, then run `npm test` and `npm run pretty`. Development and
agent instructions: https://github.com/entirius/entirius-pwa-cms/blob/develop/AGENTS.md

## License

Mozilla Public License 2.0 (MPL-2.0) — see https://github.com/entirius/entirius-pwa-cms/blob/develop/LICENSE.
