# Entirius CMS

A Vue 3 content management system with visual page builder for managing static pages, blog posts, product content, and categories. Features JSON-based dynamic UI configuration and multi-client deployment support.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Deployment Modes](#deployment-modes)
- [Testing](#testing)
- [Development](#development)


## Quick Start

```bash
# Install dependencies
npm ci

# Start development server
npm run serve
# On first run, this auto-generates __client/ configs from defaults.
# Customize __client/ JSON files for your deployment.

# Production build
npm run build

# Run tests
npm test              # Full test suite (build + e2e)
npm run test:smoke    # Quick smoke tests (1.5 min)

# Code formatting
npm run pretty
```

## Client Configuration (`__client/`)

The CMS uses JSON config files in `__client/` to define section types, tile types, properties, and builder UI. This directory is `.gitignore`d -- each deployment has its own configs.

On `npm run serve` or `npm run build`, missing configs are auto-generated from `__client_default/` (a minimal skeleton). To generate or repair manually:

```bash
npm run init:client
```

To customize, edit the 7 JSON files in `__client/`. See `__client_default/` for the template structure and `docs/config-system.md` for the full config reference.

## Environment Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Then fill in the required values:

```bash
# Required
VUE_APP_API_URL=http://localhost:8100
VUE_APP_CHANNEL=your-channel-name

# Optional
VUE_APP_PANELS=pages,pim,points
VUE_APP_DEBUG=false
VUE_APP_LANG=EN
VUE_APP_USERNAME=your-username
VUE_APP_PASSWORD=your-password
VUE_APP_SSO_API_BASE=
```

### Environment Variables Reference

| Variable           | Required | Default | Description                                |
|--------------------|----------|---------|--------------------------------------------|
| `VUE_APP_API_URL`  | Yes      | --      | Backend API base URL                       |
| `VUE_APP_CHANNEL`  | Yes      | --      | Active sales channel                       |
| `VUE_APP_DEBUG`    | No       | `false` | Enable API debug logging                   |
| `VUE_APP_LANG`     | No       | `EN`    | Language (EN or PL)                        |
| `VUE_APP_USERNAME` | No       | --      | Dev auto-login username                    |
| `VUE_APP_PASSWORD` | No       | --      | Dev auto-login password                    |
| `VUE_APP_SSO_API_BASE` | No   | --      | Path of the backend SSO endpoints. Set it to show "Log in with SSO"; see `docs/sso-login.md` |
| `VUE_APP_PANELS`   | No       | --      | Fallback panel IDs when the backend module registry is unavailable. See `docs/panels-routing.md` for the full 15-panel registry and gating model |

If required variables are missing, the app shows a "Configuration Required" screen listing what needs to be set. Build output also prints warnings in the terminal.

Which panels are actually usable is decided at runtime by the backend's
django-munin module registry, not by `VUE_APP_PANELS` alone — see
`docs/panels-routing.md`.

## Deployment Modes

The CMS supports multiple deployment targets using Vue CLI modes. Each mode loads environment-specific variables from `.env.[mode]` files, allowing single codebase for multiple clients.

### Default Mode

```bash
npm run serve
```

Uses `.env` and `.env.local` files.

### Custom Deployment Modes

Create client-specific deployments by adding mode scripts to `package.json`:

```json
{
  "scripts": {
    "serve": "vue-cli-service serve",
    "start:project1": "vue-cli-service serve --mode project1",
    "start:project2": "vue-cli-service serve --mode project2",
    "build": "vue-cli-service build"
  }
}
```

Then run with:

```bash
npm run start:project1  # Uses .env.project1
npm run start:project2  # Uses .env.project2
```

### Setting Up a New Deployment

1. **Create environment file** - `.env.project1`
   ```bash
   VUE_APP_API_URL=https://project1-api.com
   VUE_APP_CHANNEL=project1
   ```

2. **Add npm script** to `package.json`:
   ```json
   "start:project1": "vue-cli-service serve --mode project1"
   ```

3. **Run the deployment**:
   ```bash
   npm run start:project1
   ```

## Testing

Comprehensive test suite using Playwright for E2E testing.

### Running Tests

```bash
# Full test suite (build + e2e tests)
npm test

# Quick smoke tests (5 critical path tests)
npm run test:smoke

# Comprehensive tests (content builder + gallery)
npm run test:comprehensive

# Build verification only
npm run test:build

# Visual debugging (see browser)
npm run test:e2e:headed

# Step-by-step debugging
npm run test:e2e:debug
```

### Test Coverage

- Authentication flow
- Navigation accessibility
- Content builder workflow
- Gallery upload workflow
- Build integrity

### Extending Tests

See `docs/testing.md` for a detailed guide on:
- Adding new test scenarios
- Creating test helpers
- Debugging failed tests
- Test maintenance

## Development

### Project Structure

```
src/
├── boots/              # Global UI components
├── configs/            # Configuration system
│   ├── access.js       # Role-based access control
│   └── builder/        # Config controllers
├── api/                # API clients (ContentDB, PIM)
├── views/              # Route components
├── composables/        # Reusable Composition API logic
├── stores/             # Pinia stores
├── functionals/        # Functional components
└── utils/              # Utilities and directives

__client/
├── configs/            # JSON configuration files
└── props/              # Property definitions
```

### Key Directories

- **boots/** - Globally registered UI components
- **configs/** - Configuration system and builder controllers
- **views/** - Main route components (Home, Builder, Gallery, etc.)
- **composables/** - Reusable Composition API logic
- **stores/** - Pinia state management
- **__client/** - JSON-based dynamic configuration

### Configuration System

The CMS uses JSON-based configuration for dynamic UI generation:

- `__client/configs/__core_config.json` - Section/tile type definitions
- `__client/configs/__config_options.json` - Configuration field definitions
- `__client/props/__props.json` - Property definitions
- `__client/props/__props_handlers.json` - Property handler mappings

### Builder Controllers

Vue components that handle configuration UI:

- **InputFieldController** - Text inputs
- **GroupFieldsController** - Repeatable field groups
- **ButtonsController** - Button configuration
- **ImagesController** - Image selection/upload

Located in: `src/configs/builder/components/`

### Multi-App Architecture

The system supports 15 self-contained panels (Pages, PIM, Points, Forms,
Accounts, Checkout, Agreements, Emails, FAQ, Pricing, Stock, Translation,
Suppliers, Enricher, Promo), each enabled per backend deployment via the
django-munin module registry. Panels are configured in `src/configs/access.js`
and filtered based on user permissions. See `docs/panels-routing.md` for the
full registry and gating model.

### Adding New Features

1. Read `AGENTS.md` and the `docs/` reference files for architectural guidelines
2. Run tests before making changes: `npm run test:smoke`
3. Make your changes following the patterns in `AGENTS.md` and `docs/`
4. Add tests for new functionality
5. Run full test suite: `npm test`
6. Format code: `npm run pretty`

### Internal Documentation

Additional documentation available in the app:

- Navigate to `/doc` route after login
- Config system: `src/views/Docs/config_docs.md`
- Props system: `src/views/Docs/props_docs.md`

## Architecture

For detailed architectural guidelines, component patterns, and development rules, refer to `AGENTS.md` and the `docs/` directory:

- `AGENTS.md` - Development rules and patterns
- `docs/panels-routing.md` - Panel registry and routing/gating model
- `docs/stores-composables.md` - Pinia stores and composables
- `docs/ui-components.md` - Boot components, theming, RWD
- `docs/config-system.md` - `__client/` config reference
- `docs/testing.md` - Test commands and suite structure
- `docs/gotchas.md` - Repo-specific traps

## Version

Current version: 1.0.0

### Recent Features

- Deduplicated section titles
- Drag & drop in slider elements
- Accordion and table icons
- Tile configuration improvements
- Rebuilt document header bar
- Hero banner text positioning options
- Handy kit: metadata editing, section management
- Expand/collapse all sections
- UX/UI improvements and refactoring

## Support

For questions and feedback, open an issue on GitHub.

## License

Licensed under the Mozilla Public License 2.0 (MPL-2.0). See [LICENSE](LICENSE).
