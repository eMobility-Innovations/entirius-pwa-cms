# Configuration System -- CMS Blueprint

JSON configs in `__client/` drive the builder UI dynamically. `__client/` is gitignored -- each deployment has its own.

## Auto-init

`__client_default/` (committed) contains skeleton configs. On `npm run serve` or `npm run build`, `scripts/init-client.js` copies missing files. Run `npm run init:client` manually to repair.

## Core Files

| File | Purpose |
|---|---|
| `__client/configs/__core_config.json` | Section/tile types (core_type, variant) |
| `__client/configs/__hidden_config.json` | Internal configs (doc_type, section_core_type) |
| `__client/configs/__optional_config.json` | Optional configs (grid layout, etc.) |
| `__client/configs/__config_options.json` | Config field definitions (max_tiles) |
| `__client/props/__props.json` | Property definitions |
| `__client/props/__props_handlers.json` | Maps prop types to components |
| `__client/props/__props_options.json` | Field config for complex props |

## Key Concepts

**Configs:** Structural properties with `_for` targeting (`section_configs` or `tile_configs`).

**Props:** Content properties with controller types: `text`->BasicInput, `wysiwyg`->BasicWysiwyg, `dropdown`->Dropdown, `buttons`->ButtonsController, `images`->ImagesController, `group-fields`->GroupFieldsController, `date-picker`->BasicDatePicker.

**Document Types:** `static-page`, `blog-post`, `product-rich-content`, `category-rich-content`, `header`.

## Variant System

Conditional visibility based on config values. Format: `"prop:value"` strings.

```json
// AND: all conditions in one array
"variants": [["doc_type:static-page", "core_type:section-hero"]]

// OR: multiple arrays
"variants": [["doc_type:static-page"], ["doc_type:blog-post"]]
```

Variant strings must EXACTLY match `prop:value` format. Typos cause silent failures.

## Adding New Section Type

1. Add option to `__core_config.json` `_for.section_configs` with `variants`
2. Add new type to existing props' `variants_group` in `__props.json`
3. Add optional configs in `__optional_config.json` if needed
4. Set `max_tiles` in `__config_options.json`
5. If tiles supported: add tile type to `__core_config.json` `_for.tile_configs`

## Adding New Prop

**Simple:**
```json
{ "prop": "subtitle", "type": "text", "label": "Subtitle", "__value": "",
  "_for": { "section_configs": [{ "variants_group": [["doc_type:static-page", "core_type:section-hero"]], "related_options": null }] } }
```

**Complex:** Same but with `"type": "group-fields"`, `"__value": []`, and `"related_options": "config-key"` pointing to `__props_options.json`.

## Environment Validation

**Build-time:** `EnvCheckPlugin` in `vue.config.js` prints warnings for missing vars. A production build fails when
`VUE_APP_USERNAME` or `VUE_APP_PASSWORD` is set (`scripts/build-env.js`): every `VUE_APP_*` value is compiled into the
bundle, and the pair is for the dev server only (`.env.development.local`). It ships no source maps
(`productionSourceMap: false`).

**Runtime:** `src/utils/env-check.js` validates at import. Exports `envStatus = { valid, errors[], warnings[] }`.

**Fallback screen:** `src/components/EnvMissing.vue` renders when `envStatus.valid === false`.

**Adding new required env var:**
1. Add to `ENV_VARS` in `src/utils/env-check.js`
2. Add to `REQUIRED_ENV` in `vue.config.js`
3. Add to `.env.example`

## Builder Controllers

Vue components that handle configuration UI:

- **InputFieldController** - Text inputs
- **GroupFieldsController** - Repeatable field groups
- **ButtonsController** - Button configuration
- **ImagesController** - Image selection/upload

Located in: `src/configs/builder/components/`

## In-app Documentation

Additional documentation available in the app:

- Navigate to the `/pages/doc` route after login (`/doc` and `/docs` redirect there)
- Config system: `src/views/Docs/config_docs.md`
- Props system: `src/views/Docs/props_docs.md`
