# Deployment

Environment files, the variables the build reads, and one codebase serving several deployments through Vue CLI
modes. The short table agents need is in `AGENTS.md` § Settings.

## Environment configuration

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
VUE_APP_SSO_API_BASE=
```

The dev auto-login pair goes into `.env.development.local` (the dev server only), never into `.env`: every
`VUE_APP_*` value is compiled into the bundle, and a production build refuses to start with either set.

```bash
VUE_APP_USERNAME=your-username
VUE_APP_PASSWORD=your-password
```

## Environment variables reference

| Variable           | Required | Default | Description                                |
|--------------------|----------|---------|--------------------------------------------|
| `VUE_APP_API_URL`  | Yes      | --      | Backend API base URL                       |
| `VUE_APP_CHANNEL`  | Yes      | --      | Active sales channel                       |
| `VUE_APP_DEBUG`    | No       | `false` | Enable API debug logging                   |
| `VUE_APP_LANG`     | No       | `EN`    | Language (EN or PL)                        |
| `VUE_APP_USERNAME` | No       | --      | Dev auto-login username (development only; a production build fails when set) |
| `VUE_APP_PASSWORD` | No       | --      | Dev auto-login password (development only; a production build fails when set) |
| `VUE_APP_SSO_API_BASE` | No   | --      | Path of the backend SSO endpoints. Set it to show "Log in with SSO"; see `docs/sso-login.md` |
| `VUE_APP_PANELS`   | No       | --      | Fallback panel IDs when the backend module registry is unavailable. See `docs/panels-routing.md` for the panel registry and gating model |

If required variables are missing, the app shows a "Configuration Required" screen listing what needs to be set. Build output also prints warnings in the terminal.

Which panels are actually usable is decided at runtime by the backend's
django-munin module registry, not by `VUE_APP_PANELS` alone — see
`docs/panels-routing.md`.

## Deployment modes

The CMS supports multiple deployment targets using Vue CLI modes. Each mode loads environment-specific variables from `.env.[mode]` files, allowing single codebase for multiple clients.

### Default mode

```bash
npm run serve
```

Uses `.env` and `.env.local` files.

### Custom deployment modes

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

### Setting up a new deployment

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
