const { defineConfig } = require('@vue/cli-service');
const webpack = require('webpack');

const path = require('path');
const fs = require('fs');

const REQUIRED_ENV = ['VUE_APP_API_URL', 'VUE_APP_CHANNEL', 'VUE_APP_PANELS'];
const OPTIONAL_ENV = ['VUE_APP_DEBUG', 'VUE_APP_LANG', 'VUE_APP_USERNAME', 'VUE_APP_PASSWORD', 'VUE_APP_SSO_API_BASE'];

const CLIENT_CONFIG_FILES = [
  'configs/__core_config.json',
  'configs/__hidden_config.json',
  'configs/__optional_config.json',
  'configs/__config_options.json',
  'props/__props.json',
  'props/__props_handlers.json',
  'props/__props_options.json',
];

class ClientConfigCheckPlugin {
  apply(compiler) {
    compiler.hooks.afterCompile.tap('ClientConfigCheckPlugin', () => {
      const clientDir = path.resolve(
        __dirname,
        process.env.VUE_APP_CLIENT || '__client'
      );
      const defaultDir = path.resolve(__dirname, '__client_default');
      const missing = CLIENT_CONFIG_FILES.filter(
        (f) => !fs.existsSync(path.join(clientDir, f))
      );

      if (missing.length) {
        console.log('\n\x1b[31m%s\x1b[0m', '[client-config] Missing client config files:');
        missing.forEach((f) => console.log('  \x1b[31m✗\x1b[0m %s', f));
        console.log('\x1b[36m%s\x1b[0m\n', 'Run: npm run init:client');
        return;
      }

      // Detect skeleton defaults by comparing __config_options.json content
      try {
        const optionsPath = path.join(clientDir, 'configs/__config_options.json');
        const defaultPath = path.join(defaultDir, 'configs/__config_options.json');
        const current = fs.readFileSync(optionsPath, 'utf8').trim();
        const defaults = fs.readFileSync(defaultPath, 'utf8').trim();
        if (current === defaults) {
          console.log(
            '\n\x1b[33m%s\x1b[0m\n',
            '[client-config] Using skeleton default configs -- customize __client/ for your deployment'
          );
        }
      } catch (_) {
        // ignore read errors
      }
    });
  }
}

class EnvCheckPlugin {
  apply(compiler) {
    compiler.hooks.afterCompile.tap('EnvCheckPlugin', () => {
      const missing = REQUIRED_ENV.filter(k => !process.env[k]);
      const optional = OPTIONAL_ENV.filter(k => !process.env[k]);

      if (missing.length) {
        console.log('\n\x1b[31m%s\x1b[0m', '[env-check] Missing REQUIRED env vars:');
        missing.forEach(k => console.log('  \x1b[31m✗\x1b[0m %s', k));
      }
      if (optional.length) {
        console.log('\n\x1b[33m%s\x1b[0m', '[env-check] Missing optional env vars:');
        optional.forEach(k => console.log('  \x1b[33m-\x1b[0m %s', k));
      }
      if (missing.length) {
        console.log('\n\x1b[36m%s\x1b[0m\n', 'Run: cp .env.example .env  -- then fill in the required values.');
      }
    });
  }
}

module.exports = defineConfig({
  transpileDependencies: true,

  css: {
    extract: {
      ignoreOrder: true
    }
  },

  configureWebpack: {
    plugins: [
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
      }),
      new EnvCheckPlugin(),
      new ClientConfigCheckPlugin()
    ],
    module: {
      rules: [
        {
          test: /\.md$/,
          use: 'raw-loader'
        }
      ]
    }
  }
});
