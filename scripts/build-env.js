/**
 * Build-time environment rules shared by vue.config.js and its unit test.
 * Every VUE_APP_* value is compiled into the bundle, so the dev auto-login pair must never reach a production build.
 */

const DEV_ONLY_ENV = ['VUE_APP_USERNAME', 'VUE_APP_PASSWORD'];

function assertNoDevCredentials(env) {
  if (env.NODE_ENV !== 'production') return;
  const set = DEV_ONLY_ENV.filter((key) => env[key]);
  if (!set.length) return;
  throw new Error(
    `[env-check] ${set.join(', ')} set for a production build. Every VUE_APP_* value is compiled into the bundle: ` +
      'these are for the dev server only (keep them in .env.development.local) and must be unset to build.'
  );
}

module.exports = { DEV_ONLY_ENV, assertNoDevCredentials };
