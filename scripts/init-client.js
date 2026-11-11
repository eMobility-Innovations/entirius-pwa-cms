#!/usr/bin/env node

/**
 * Client config initializer.
 * Ensures __client/ (or VUE_APP_CLIENT) directory has all required JSON files.
 * Copies missing files from __client_default/ template.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIR = path.join(ROOT, '__client_default');

const REQUIRED_FILES = [
  'configs/__core_config.json',
  'configs/__hidden_config.json',
  'configs/__optional_config.json',
  'configs/__config_options.json',
  'configs/__enrichment_config.json',
  'props/__props.json',
  'props/__props_handlers.json',
  'props/__props_options.json',
];

function getTargetDir() {
  const clientEnv = process.env.VUE_APP_CLIENT;
  if (clientEnv) {
    return path.isAbsolute(clientEnv)
      ? clientEnv
      : path.join(ROOT, clientEnv);
  }
  return path.join(ROOT, '__client');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function run() {
  const targetDir = getTargetDir();
  const relTarget = path.relative(ROOT, targetDir);

  const missing = REQUIRED_FILES.filter(
    (f) => !fs.existsSync(path.join(targetDir, f))
  );

  if (missing.length === 0) {
    console.log(
      '\x1b[32m%s\x1b[0m',
      `[init-client] Client configs OK at ./${relTarget}`
    );
    return;
  }

  // Copy missing files from __client_default/
  for (const file of missing) {
    const src = path.join(DEFAULT_DIR, file);
    const dest = path.join(targetDir, file);

    if (!fs.existsSync(src)) {
      console.log(
        '\x1b[31m%s\x1b[0m',
        `[init-client] Template missing: __client_default/${file}`
      );
      continue;
    }

    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }

  const allExisted = missing.length < REQUIRED_FILES.length;
  if (allExisted) {
    console.log(
      '\x1b[33m%s\x1b[0m',
      `[init-client] Copied ${missing.length} missing config(s) to ./${relTarget}:`
    );
  } else {
    console.log(
      '\x1b[33m%s\x1b[0m',
      `[init-client] Generated default client configs at ./${relTarget} -- customize for your deployment:`
    );
  }
  missing.forEach((f) => console.log('  \x1b[33m+\x1b[0m %s', f));
}

run();
