const { execFileSync } = require('node:child_process');
const path = require('node:path');
const REQUIRED_ENV = ['VUE_APP_API_URL', 'VUE_APP_CHANNEL'];

class EnvCheckPlugin {
  constructor(env = process.env) { this.env = env; }

  apply(compiler) {
    compiler.hooks.afterCompile.tap('EnvCheckPlugin', compilation => {
      const missing = REQUIRED_ENV.filter(key => !String(this.env[key] || '').trim());
      if (!missing.length) return;
      const error = new Error(`[env-check] Missing required environment variables: ${missing.join(', ')}`);
      const issues = compiler.options.mode === 'production' ? compilation.errors : compilation.warnings;
      issues.push(error);
    });
  }
}

function buildInfo(env = process.env) {
  // Match src/configs/sso.js: an explicit fork flag overrides the upstream base.
  const ssoEnabled = env.VUE_APP_SSO_ENABLED !== undefined
    ? String(env.VUE_APP_SSO_ENABLED).toLowerCase() === 'true'
    : Boolean(env.VUE_APP_SSO_API_BASE);
  return {
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim(),
    version: require('../package.json').version,
    apiUrl: env.VUE_APP_API_URL || '',
    channel: env.VUE_APP_CHANNEL || '',
    ssoEnabled,
    ssoOnly: ssoEnabled && String(env.VUE_APP_SSO_ONLY || 'false').toLowerCase() === 'true',
  };
}

class BuildInfoPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('BuildInfoPlugin', compilation => {
      compilation.hooks.processAssets.tap({ name: 'BuildInfoPlugin', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
        compilation.emitAsset('build-info.json', new compiler.webpack.sources.RawSource(JSON.stringify(buildInfo(), null, 2) + '\n'));
      });
    });
  }
}

module.exports = { EnvCheckPlugin, BuildInfoPlugin, buildInfo };
